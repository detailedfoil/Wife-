-- Database setup for the play stats (run once in the Supabase SQL editor).
-- 1. The events table, run first:
--    create table events (id bigint generated always as identity primary key, created_at timestamptz default now(), player_id text not null, session_id text, event text not null, game text, duration_sec int, coins int, score int, lang text);
--    alter table events enable row level security;
--    create policy "anyone can add events" on events for insert to anon with check (true);
-- 2. Then this file, after replacing CHANGE-ME with your own passcode.

-- Limits on what the game can add (stops junk being sent in)
alter table events add constraint events_sane check (
  event in ('session_start','session_end','game_end','game_quit')
  and length(player_id) <= 64
  and (session_id is null or length(session_id) <= 64)
  and (game is null or length(game) <= 32)
  and (lang is null or length(lang) <= 5)
  and (duration_sec is null or duration_sec between 0 and 86400)
  and (coins is null or coins between 0 and 1000000000)
  and (score is null or score between 0 and 1000000000)
);

-- The passcode for the stats page (stored scrambled, nobody can read it back)
create table stats_key (hash text not null);
alter table stats_key enable row level security;
insert into stats_key values (encode(sha256(convert_to('CHANGE-ME', 'UTF8')), 'hex'));

-- The stats page asks this question; it only answers if the passcode is right
create or replace function get_stats(pass text)
returns json
language plpgsql
security definer
set search_path = public
as $fn$
declare res json;
begin
  if not exists (select 1 from stats_key where hash = encode(sha256(convert_to(coalesce(pass, ''), 'UTF8')), 'hex')) then
    raise exception 'wrong passcode';
  end if;
  select json_build_object(
    'generated', now(),
    'players', (select count(distinct player_id) from events),
    'players_24h', (select count(distinct player_id) from events where created_at > now() - interval '24 hours'),
    'players_7d', (select count(distinct player_id) from events where created_at > now() - interval '7 days'),
    'sessions', (select count(distinct session_id) from events),
    'avg_session_secs', (select round(avg(s)) from (select sum(duration_sec) s from events where event = 'session_end' group by session_id) x),
    'returning_players', (select count(*) from (select player_id from events group by player_id having count(distinct (created_at at time zone 'Europe/London')::date) > 1) x),
    'games_played', (select count(*) from events where event in ('game_end','game_quit')),
    'avg_play_secs_per_player', (select round(avg(t)) from (select sum(duration_sec) t from events where event in ('game_end','game_quit') group by player_id) x),
    'avg_earned_per_player', (select round(avg(t)) from (select sum(coins) t from events where event in ('game_end','game_quit') group by player_id) x),
    'coins', (select json_build_object('avg', round(avg(coins)), 'median', round((percentile_cont(0.5) within group (order by coins))::numeric), 'max', max(coins))
              from (select distinct on (player_id) coins from events where event = 'session_end' and coins is not null order by player_id, created_at desc) x),
    'per_game', coalesce((select json_agg(g order by g.plays desc) from (
        select game,
               count(*) as plays,
               count(*) filter (where event = 'game_quit') as quits,
               count(distinct player_id) as players,
               round(avg(duration_sec)) as avg_secs,
               coalesce(sum(duration_sec), 0) as total_secs,
               round(avg(coins), 1) as avg_coins,
               coalesce(sum(coins), 0) as total_coins,
               round(avg(score), 1) as avg_score,
               max(score) as best_score
        from events where event in ('game_end','game_quit') and game is not null group by game) g), '[]'::json),
    'daily', coalesce((select json_agg(d order by d.day) from (
        select day::text as day,
               (select count(distinct player_id) from events e where (e.created_at at time zone 'Europe/London')::date = day) as players,
               (select count(*) from (select player_id from events group by player_id having min((created_at at time zone 'Europe/London')::date) = day) f) as new_players,
               (select count(distinct session_id) from events e where (e.created_at at time zone 'Europe/London')::date = day) as sessions
        from (select (now() at time zone 'Europe/London')::date - n as day from generate_series(0, 29) n) days) d), '[]'::json),
    'hours', coalesce((select json_agg(json_build_object('hour', h, 'plays', c) order by h) from (
        select extract(hour from created_at at time zone 'Europe/London')::int as h, count(*) as c from events where event in ('game_end','game_quit') group by 1) x), '[]'::json),
    'langs', coalesce((select json_agg(json_build_object('lang', lang, 'players', c)) from (
        select lang, count(distinct player_id) as c from events where lang is not null group by lang) x), '[]'::json)
  ) into res;
  return res;
end
$fn$;

grant execute on function get_stats(text) to anon;

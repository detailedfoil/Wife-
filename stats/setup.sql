-- Database setup for the play stats (run once in the Supabase SQL editor; safe to run again).
-- First make the events table:
--    create table events (id bigint generated always as identity primary key, created_at timestamptz default now(), player_id text not null, session_id text, event text not null, game text, duration_sec int, coins int, score int, lang text);
--    alter table events enable row level security;
--    create policy "anyone can add events" on events for insert to anon with check (true);
-- Then run this file, after replacing CHANGE-ME with your own passcode.

-- New columns used for balancing the games
alter table events add column if not exists joy int;
alter table events add column if not exists energy int;
alter table events add column if not exists taste int;
alter table events add column if not exists bonus int;
alter table events add column if not exists muck int;

-- Limits on what the game can add (stops junk being sent in)
alter table events drop constraint if exists events_sane;
alter table events add constraint events_sane check (
  event in ('session_start','session_end','game_end','game_quit')
  and length(player_id) <= 64
  and (session_id is null or length(session_id) <= 64)
  and (game is null or length(game) <= 32)
  and (lang is null or length(lang) <= 5)
  and (duration_sec is null or duration_sec between 0 and 86400)
  and (coins is null or coins between 0 and 1000000000)
  and (score is null or score between 0 and 1000000000)
  and (joy is null or joy between -1000 and 1000)
  and (energy is null or energy between 0 and 1000)
  and (taste is null or taste between -1000 and 1000)
  and (bonus is null or bonus between 0 and 1000)
  and (muck is null or muck between 0 and 1000)
);

-- The passcode for the stats page (stored scrambled, nobody can read it back)
create table if not exists stats_key (hash text not null);
alter table stats_key enable row level security;
delete from stats_key;
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
    'coins_per_min_all', (select round(sum(coins)::numeric / nullif(sum(duration_sec), 0) * 60, 1) from events where event = 'game_end' and game is not null and game <> 'sauna'),
    'per_game', coalesce((select json_agg(g order by g.plays desc) from (
        select game,
               count(*) as plays,
               count(*) filter (where event = 'game_end') as completed,
               count(*) filter (where event = 'game_quit') as quits,
               count(distinct player_id) as players,
               round(avg(duration_sec) filter (where event = 'game_end')) as avg_secs,
               round((percentile_cont(0.5) within group (order by duration_sec) filter (where event = 'game_end'))::numeric) as median_secs,
               round((percentile_cont(0.1) within group (order by duration_sec) filter (where event = 'game_end'))::numeric) as p10_secs,
               round((percentile_cont(0.9) within group (order by duration_sec) filter (where event = 'game_end'))::numeric) as p90_secs,
               round(sum(coins) filter (where event = 'game_end')::numeric / nullif(sum(duration_sec) filter (where event = 'game_end'), 0) * 60, 1) as coins_per_min,
               round(avg(coins) filter (where event = 'game_end'), 1) as avg_coins,
               round(avg(joy) filter (where event = 'game_end'), 1) as avg_joy,
               round(sum(joy) filter (where event = 'game_end')::numeric / nullif(sum(duration_sec) filter (where event = 'game_end'), 0) * 60, 1) as joy_per_min,
               round(avg(energy) filter (where event = 'game_end'), 1) as avg_energy,
               round(sum(energy) filter (where event = 'game_end')::numeric / nullif(sum(duration_sec) filter (where event = 'game_end'), 0) * 60, 1) as energy_per_min,
               round(avg(score) filter (where event = 'game_end'), 1) as avg_score,
               max(score) as best_score,
               round(avg(taste) filter (where event = 'game_end'), 1) as avg_taste,
               round(avg(bonus) filter (where event = 'game_end'), 1) as avg_bonus,
               round(avg(muck) filter (where event = 'game_end'), 1) as avg_muck
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

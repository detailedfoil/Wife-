-- Database setup for the play stats (run once in the Supabase SQL editor; safe to run again).
-- First make the events table:
--    create table events (id bigint generated always as identity primary key, created_at timestamptz default now(), player_id text not null, session_id text, event text not null, game text, duration_sec int, coins int, score int, lang text);
--    alter table events enable row level security;
--    create policy "anyone can add events" on events for insert to anon with check (true);
-- Then run this file, after replacing CHANGE-ME with your own passcode.

-- Columns the game fills in (balancing numbers, progress, device)
alter table events add column if not exists joy int;
alter table events add column if not exists energy int;
alter table events add column if not exists taste int;
alter table events add column if not exists bonus int;
alter table events add column if not exists muck int;
alter table events add column if not exists info text;
alter table events add column if not exists level int;
alter table events add column if not exists age_days int;
alter table events add column if not exists n_food int;
alter table events add column if not exists n_joy int;
alter table events add column if not exists n_energy int;
alter table events add column if not exists n_clean int;
alter table events add column if not exists fps int;
alter table events add column if not exists screen text;
alter table events add column if not exists installed int;

-- Limits on what the game can add (stops junk being sent in)
alter table events drop constraint if exists events_sane;
alter table events add constraint events_sane check (
  event in ('session_start','session_end','game_end','game_quit','unlock','purchase','blocked','error')
  and length(player_id) <= 64
  and (session_id is null or length(session_id) <= 64)
  and (game is null or length(game) <= 32)
  and (lang is null or length(lang) <= 5)
  and (info is null or length(info) <= 64)
  and (screen is null or screen ~ '^[0-9]{2,5}x[0-9]{2,5}$')
  and (duration_sec is null or duration_sec between 0 and 86400)
  and (coins is null or coins between 0 and 1000000000)
  and (score is null or score between 0 and 1000000000)
  and (joy is null or joy between -1000 and 1000)
  and (energy is null or energy between 0 and 1000)
  and (taste is null or taste between -1000 and 1000)
  and (bonus is null or bonus between 0 and 1000)
  and (muck is null or muck between 0 and 1000)
  and (level is null or level between 0 and 1000)
  and (age_days is null or age_days between 0 and 100000)
  and (n_food is null or n_food between 0 and 100)
  and (n_joy is null or n_joy between 0 and 100)
  and (n_energy is null or n_energy between 0 and 100)
  and (n_clean is null or n_clean between 0 and 100)
  and (fps is null or fps between 0 and 1000)
  and (installed is null or installed in (0, 1))
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
    'coins_per_min_all', (select round(avg(c), 1) from (select sum(coins)::numeric / nullif(sum(duration_sec), 0) * 60 as c from events where event = 'game_end' and game is not null and game <> 'sauna' group by player_id) x),
    'mix', (select json_build_object('players', count(*), 'coins_per_min', round(avg(c), 1), 'joy_per_min', round(avg(j), 1), 'energy_per_min', round(avg(e), 1))
            from (select sum(coins)::numeric / nullif(sum(duration_sec), 0) * 60 as c, sum(joy)::numeric / nullif(sum(duration_sec), 0) * 60 as j, sum(energy)::numeric / nullif(sum(duration_sec), 0) * 60 as e
                  from events where event = 'game_end' and game is not null and game <> 'sauna' group by player_id) x),
    'per_game', coalesce((select json_agg(g order by g.players desc, g.plays desc) from (
        select game,
               sum(n_all) as plays,
               sum(n_done) as completed,
               sum(n_quit) as quits,
               count(*) as players,
               round(100 * avg(n_quit::numeric / n_all)) as quit_pct,
               round(avg(secs)) as avg_secs,
               round((percentile_cont(0.5) within group (order by secs))::numeric) as median_secs,
               round((percentile_cont(0.1) within group (order by secs))::numeric) as p10_secs,
               round((percentile_cont(0.9) within group (order by secs))::numeric) as p90_secs,
               round(avg(tcoins::numeric / nullif(tsecs, 0) * 60), 1) as coins_per_min,
               round(avg(acoins), 1) as avg_coins,
               round(avg(ajoy), 1) as avg_joy,
               round(avg(tjoy::numeric / nullif(tsecs, 0) * 60), 1) as joy_per_min,
               round(avg(aenergy), 1) as avg_energy,
               round(avg(tenergy::numeric / nullif(tsecs, 0) * 60), 1) as energy_per_min,
               round(avg(ascore), 1) as avg_score,
               max(bscore) as best_score,
               round(avg(ataste), 1) as avg_taste,
               round(avg(abonus), 1) as avg_bonus,
               round(avg(amuck), 1) as avg_muck,
               round((percentile_cont(0.1) within group (order by ascore))::numeric, 1) as score_p10,
               round((percentile_cont(0.5) within group (order by ascore))::numeric, 1) as score_p50,
               round((percentile_cont(0.9) within group (order by ascore))::numeric, 1) as score_p90,
               round((percentile_cont(0.1) within group (order by tcoins::numeric / nullif(tsecs, 0) * 60))::numeric, 1) as cpm_p10,
               round((percentile_cont(0.5) within group (order by tcoins::numeric / nullif(tsecs, 0) * 60))::numeric, 1) as cpm_p50,
               round((percentile_cont(0.9) within group (order by tcoins::numeric / nullif(tsecs, 0) * 60))::numeric, 1) as cpm_p90,
               round(avg(afps)) as avg_fps
        from (select game, player_id,
                     count(*) as n_all,
                     count(*) filter (where event = 'game_end') as n_done,
                     count(*) filter (where event = 'game_quit') as n_quit,
                     avg(duration_sec) filter (where event = 'game_end') as secs,
                     sum(duration_sec) filter (where event = 'game_end') as tsecs,
                     sum(coins) filter (where event = 'game_end') as tcoins,
                     sum(joy) filter (where event = 'game_end') as tjoy,
                     sum(energy) filter (where event = 'game_end') as tenergy,
                     avg(coins) filter (where event = 'game_end') as acoins,
                     avg(joy) filter (where event = 'game_end') as ajoy,
                     avg(energy) filter (where event = 'game_end') as aenergy,
                     avg(score) filter (where event = 'game_end') as ascore,
                     max(score) filter (where event = 'game_end') as bscore,
                     avg(taste) filter (where event = 'game_end') as ataste,
                     avg(bonus) filter (where event = 'game_end') as abonus,
                     avg(muck) filter (where event = 'game_end') as amuck,
                     avg(fps) filter (where event = 'game_end') as afps
              from events where event in ('game_end','game_quit') and game is not null group by game, player_id) pg
        group by game) g), '[]'::json),
    'visits_per_active_day', (select round(avg(c), 1) from (select count(distinct session_id) c from events where event = 'session_start' group by player_id, (created_at at time zone 'Europe/London')::date) x),
    'retention', (select json_build_object('d1_eligible', count(*) filter (where d0 <= t - 1), 'd1', count(*) filter (where d0 <= t - 1 and r1),
                                           'd7_eligible', count(*) filter (where d0 <= t - 7), 'd7', count(*) filter (where d0 <= t - 7 and r7))
                  from (select f.player_id, f.d0, (now() at time zone 'Europe/London')::date as t,
                               exists (select 1 from events e where e.player_id = f.player_id and (e.created_at at time zone 'Europe/London')::date = f.d0 + 1) as r1,
                               exists (select 1 from events e where e.player_id = f.player_id and (e.created_at at time zone 'Europe/London')::date between f.d0 + 1 and f.d0 + 7) as r7
                        from (select distinct on (player_id) player_id, (created_at at time zone 'Europe/London')::date as d0, age_days from events order by player_id, created_at) f
                        where coalesce(f.age_days, 0) <= 1) z),
    'needs', (select json_build_object('visits', sum(v), 'players', count(*), 'avg_food', round(avg(f)), 'avg_joy', round(avg(j)), 'avg_energy', round(avg(e)), 'avg_clean', round(avg(c)),
                        'pct_hungry', round(100 * avg(hf)), 'pct_sad', round(100 * avg(hj)), 'pct_dirty', round(100 * avg(hc)), 'pct_low_energy', round(100 * avg(he)), 'pct_full_joy', round(100 * avg(hfull)))
              from (select count(*) as v, avg(n_food) as f, avg(n_joy) as j, avg(n_energy) as e, avg(n_clean) as c,
                           avg((n_food < 25)::int) as hf, avg((n_joy < 30)::int) as hj, avg((n_clean < 25)::int) as hc, avg((n_energy < 20)::int) as he, avg((n_joy >= 95)::int) as hfull
                    from events where event = 'session_start' and n_food is not null group by player_id) p),
    'blocked_total', (select count(*) from events where event = 'blocked'),
    'blocked', coalesce((select json_agg(b order by b.n desc) from (select info as why, count(*) as n, count(distinct player_id) as players from events where event = 'blocked' group by info) b), '[]'::json),
    'unlocks', coalesce((select json_agg(u order by u.n desc) from (
        select game, count(*) as n, count(distinct player_id) as players,
               round((percentile_cont(0.5) within group (order by age_days))::numeric, 1) as median_age_days, round(avg(coins)) as price
        from events where event = 'unlock' group by game) u), '[]'::json),
    'purchases', coalesce((select json_agg(p order by p.n desc) from (
        select info as item, game as kind, count(*) as n, count(distinct player_id) as players, coalesce(sum(coins), 0) as total
        from events where event = 'purchase' group by info, game order by count(*) desc limit 15) p), '[]'::json),
    'coins_spent', (select coalesce(sum(coins), 0) from events where event in ('purchase', 'unlock')),
    'coins_earned_games', (select coalesce(sum(coins), 0) from events where event = 'game_end'),
    'levels', coalesce((select json_agg(l order by l.level) from (
        select v.level,
               (select count(distinct player_id) from events where events.level >= v.level) as reached,
               (select round((percentile_cont(0.5) within group (order by a))::numeric, 1)
                  from (select min(e.age_days) as a from events e
                        where e.level >= v.level and e.age_days is not null
                          and e.player_id in (select player_id from (select distinct on (player_id) player_id, age_days from events order by player_id, created_at) f where coalesce(f.age_days, 0) <= 1)
                        group by e.player_id) y) as median_age_days
        from (values (3), (6), (10)) v(level)) l), '[]'::json),
    'levels_now', coalesce((select json_agg(json_build_object('level', lvl, 'players', c) order by lvl) from (
        select lvl, count(*) as c from (select max(level) as lvl from events where level is not null group by player_id) m group by lvl) x), '[]'::json),
    'coffee_fails', coalesce((select json_agg(f order by f.share desc) from (
        select info as step, count(*) as players, sum(c) as n, round(100 * sum(c::numeric / tot) / (select count(distinct player_id) from events where event = 'game_end' and game = 'coffee' and info is not null)) as share, round(avg(s), 1) as avg_served
        from (select info, player_id, c, s, sum(c) over (partition by player_id) as tot
              from (select info, player_id, count(*) as c, avg(score) as s from events where event = 'game_end' and game = 'coffee' and info is not null group by info, player_id) a) b
        group by info) f), '[]'::json),
    'devices', (select json_build_object(
        'installed_pct', (select round(100.0 * avg(installed)) from (select distinct on (player_id) installed from events where event = 'session_start' and installed is not null order by player_id, created_at desc) i),
        'screens', coalesce((select json_agg(json_build_object('bucket', b, 'players', c) order by b) from (
            select case when w < 360 then 1 when w < 400 then 2 when w < 480 then 3 when w < 768 then 4 else 5 end as b, count(*) as c
            from (select distinct on (player_id) split_part(screen, 'x', 1)::int as w from events where event = 'session_start' and screen is not null order by player_id, created_at desc) s group by 1) q), '[]'::json),
        'fps_avg', (select round(avg(a)) from (select avg(fps) as a from events where event = 'game_end' and fps is not null group by player_id) x),
        'fps_p10', (select round((percentile_cont(0.1) within group (order by a))::numeric) from (select avg(fps) as a from events where event = 'game_end' and fps is not null group by player_id) x))),
    'errors', (select json_build_object(
        'total', (select count(*) from events where event = 'error'),
        'per_100_visits', (select round(100.0 * count(*) filter (where event = 'error') / nullif(count(*) filter (where event = 'session_start'), 0), 1) from events),
        'top', coalesce((select json_agg(e order by e.n desc) from (select info as msg, count(*) as n, count(distinct player_id) as players from events where event = 'error' group by info order by count(*) desc limit 8) e), '[]'::json))),
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

-- Supabase (Postgres) schema for the game. Mirrors the BigQuery marts it is exported from, plus the gameplay
-- tables and functions the browser calls.
-- Apply: `python -m warehouse.export_supabase --init` (safe to re-run), or paste into the Supabase SQL editor.
--
-- Access: the browser uses the publishable/anon key, so Row Level Security is on for every table.
--   public read : franchises, anime, anime_characters, search_titles, game_clues, higher_lower_cards
--   private     : game_items, puzzle_candidates, daily_puzzles, game_sessions, guess_events
-- Answers never reach the browser before a game ends: the browser only calls the security definer functions
-- start_game / submit_guess / reveal_hint / get_game, which read the private tables and return feedback.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------------------------------------------
-- Exported from BigQuery (export_supabase.py replaces their rows on every run)
-- ---------------------------------------------------------------------------------------------------------------

create table if not exists franchises (
    franchise_id          text primary key,
    main_anilist_id       bigint not null,
    franchise_name        text not null,
    franchise_name_romaji text,
    franchise_name_native text,
    cover_image_url       text,
    year                  int,
    first_year_any_entry  int,
    source_material       text,
    country_of_origin     text,
    score                 double precision,
    popularity            int,
    genres                text[] not null default '{}',
    studios               text[] not null default '{}',
    age_rating_code       text not null,
    is_adult              boolean,
    is_ongoing            boolean,
    has_movie             boolean,
    is_movie_only         boolean,
    format_label          text,
    episodes              int,
    episodes_unit         text,
    entry_count           int,
    tv_count              int,
    movie_count           int,
    aliases               text[] not null default '{}',
    is_game_eligible      boolean not null
);

create table if not exists anime (
    anilist_id            bigint primary key,
    mal_id                bigint,
    kitsu_id              text,
    shikimori_id          bigint,
    franchise_id          text not null,
    display_title         text not null,
    title_english         text,
    title_romaji          text,
    title_native          text,
    synonyms              text[] not null default '{}',
    format                text not null,
    status                text,
    is_ongoing            boolean,
    season                text not null,
    is_season_derived     boolean,
    season_year           int,
    start_year            int,
    start_date            date,
    end_date              date,
    source_material       text not null,
    genres                text[] not null default '{}',
    episodes              int,
    episode_duration_min  int,
    country_of_origin     text,
    is_adult              boolean,
    score                 double precision,
    score_source          text,
    shikimori_score       double precision,
    anilist_score         int,
    popularity            int,
    favourites            int,
    age_rating_code       text not null,
    age_rating            text not null,
    studios               text[] not null default '{}',
    cover_image_url       text not null,
    is_game_eligible      boolean not null
);
create index if not exists anime_franchise_id_idx on anime (franchise_id);

create table if not exists anime_characters (
    anilist_id            bigint not null,
    mal_id                bigint,
    anime_title           text,
    anime_genres          text[] not null default '{}',
    anime_format          text,
    anime_year            int,
    is_adult_anime        boolean,
    character_id          bigint not null,
    character_name        text,
    character_name_native text,
    character_role        text,
    favourites            int,
    gender                text not null,
    gender_raw            text,
    age_text              text,
    character_image_url   text,
    is_game_eligible      boolean not null,
    primary key (anilist_id, character_id)
);
create index if not exists anime_characters_character_id_idx on anime_characters (character_id);

create table if not exists search_titles (
    kind          text not null,       -- franchise | anime | character
    target_id     text not null,
    display_name  text not null,
    title         text not null,
    popularity    int
);
-- trigram index: fast fuzzy / substring autocomplete ("shingeki", "attack on t")
create index if not exists search_titles_title_trgm_idx on search_titles using gin (title gin_trgm_ops);
create index if not exists search_titles_kind_idx on search_titles (kind);

-- the guess pool: every guessable item per mode with its clue values (dbt dim_game_items)
create table if not exists game_items (
    mode              text not null,   -- franchise | anime | character
    item_id           text not null,
    name              text,
    image_url         text,
    franchise_id      text not null,
    popularity        int,
    is_adult          boolean,
    is_game_eligible  boolean not null,
    clues             jsonb not null,
    primary key (mode, item_id)
);

-- clue columns per mode and how a guess is graded (dbt seed game_clues). The UI reads it for its columns
-- and the hint menu.
create table if not exists game_clues (
    mode               text not null,
    clue_key           text not null,
    label              text not null,
    compare            text not null,  -- exact | set | number
    close_within       double precision,
    close_is_relative  boolean,
    sort_order         int not null,
    primary key (mode, clue_key)
);

-- answer pool with difficulty tiers (dbt fct_puzzle_candidates)
create table if not exists puzzle_candidates (
    mode              text not null,
    answer_id         text not null,
    answer_name       text not null,
    pool_metric       int,
    is_adult          boolean,
    popularity_rank   int not null,
    difficulty_tier   int not null,
    primary key (mode, answer_id)
);
create index if not exists puzzle_candidates_tier_idx on puzzle_candidates (mode, difficulty_tier);

create table if not exists higher_lower_cards (
    kind          text not null,       -- anime | character
    item_id       text not null,
    name          text not null,
    subtitle      text,
    image_url     text not null,
    value         int not null,
    franchise_id  text,
    is_adult      boolean,
    primary key (kind, item_id)
);

-- One-time pre-launch migration (2026-10-19): daily_puzzles changed shape (answer_attributes -> answer_clues,
-- + image / franchise). Drops the old table if it is still there; a no-op afterwards.
do $$
begin
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'daily_puzzles' and column_name = 'answer_attributes') then
        drop table daily_puzzles;
    end if;
end $$;

create table if not exists daily_puzzles (
    puzzle_id            text primary key,
    puzzle_date          date not null,
    mode                 text not null,
    answer_id            text not null,
    answer_name          text not null,
    answer_image_url     text not null,
    answer_franchise_id  text not null,
    answer_clues         jsonb not null,
    frozen_at            timestamptz not null
);
create index if not exists daily_puzzles_date_mode_idx on daily_puzzles (puzzle_date, mode);

-- ---------------------------------------------------------------------------------------------------------------
-- Gameplay (written by the functions below; never truncated by the export)
-- ---------------------------------------------------------------------------------------------------------------

-- One row per game a player starts. The answer is copied in at start (daily: the frozen snapshot), so a game
-- in progress is unaffected by a re-export.
create table if not exists game_sessions (
    session_id           uuid primary key default gen_random_uuid(),
    player_id            uuid not null,          -- random id the browser keeps in localStorage; no accounts
    mode                 text not null check (mode in ('franchise', 'anime', 'character')),
    play_type            text not null check (play_type in ('daily', 'random')),
    puzzle_date          date,                   -- daily only
    difficulty_tier      int,                    -- random only
    answer_id            text not null,
    answer_name          text not null,
    answer_image_url     text,
    answer_franchise_id  text not null,
    answer_clues         jsonb not null,
    attempts             int not null default 0,
    hints_revealed       text[] not null default '{}',
    status               text not null default 'playing' check (status in ('playing', 'won', 'lost')),
    started_at           timestamptz not null default now(),
    finished_at          timestamptz
);
-- added after first release; idempotent for databases that already have the table
alter table game_sessions add column if not exists gave_up boolean not null default false;
-- one daily game per player per mode per day: reopening the page resumes it
create unique index if not exists game_sessions_daily_idx
    on game_sessions (player_id, mode, puzzle_date) where play_type = 'daily';

-- One row per guess. Later batch-loaded to BigQuery fct_guess_events to calibrate difficulty.
create table if not exists guess_events (
    event_id      bigint generated always as identity primary key,
    session_id    uuid not null references game_sessions (session_id),
    attempt_no    int not null,
    guess_id      text not null,
    result        text not null check (result in ('correct', 'same_franchise', 'wrong')),
    hints_before  int not null,              -- hints the player had revealed before this guess
    created_at    timestamptz not null default now(),
    unique (session_id, guess_id)            -- the same item can't be guessed twice in a game
);
create index if not exists guess_events_session_idx on guess_events (session_id, attempt_no);

-- ---------------------------------------------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------------------------------------------

alter table franchises          enable row level security;
alter table anime               enable row level security;
alter table anime_characters    enable row level security;
alter table search_titles       enable row level security;
alter table game_items          enable row level security;
alter table game_clues          enable row level security;
alter table puzzle_candidates   enable row level security;
alter table higher_lower_cards  enable row level security;
alter table daily_puzzles       enable row level security;
alter table game_sessions       enable row level security;
alter table guess_events        enable row level security;

do $$
declare t text;
begin
    foreach t in array array['franchises', 'anime', 'anime_characters', 'search_titles', 'game_clues',
                             'higher_lower_cards'] loop
        if not exists (select 1 from pg_policies where tablename = t and policyname = 'public read') then
            execute format('create policy "public read" on %I for select to anon, authenticated using (true)', t);
        end if;
    end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- Functions the browser calls: supabase.rpc('<name>', {...})
-- ---------------------------------------------------------------------------------------------------------------

-- Autocomplete: supabase.rpc('search_game_titles', { q: 'shinge', k: 'franchise' })
-- Best-matching title per target, then the most relevant and popular targets first.
create or replace function search_game_titles(q text, k text, max_results int default 10)
returns table (target_id text, display_name text, matched_title text, popularity int)
language sql stable
as $$
    select target_id, display_name, title, popularity
    from (
        select distinct on (target_id)
            target_id, display_name, title, popularity,
            similarity(title, q) as sim
        from search_titles
        where kind = k and title ilike '%' || q || '%'
        order by target_id, similarity(title, q) desc
    ) best
    order by (lower(title) like lower(q) || '%') desc,  -- prefix matches first
             popularity desc nulls last,                -- then what players most likely mean
             sim desc
    limit max_results
$$;

-- Grade one guess against an answer, clue by clue, using game_clues.
--   exact : match | miss
--   set   : match (same set) | partial (overlap) | miss          e.g. genres, studios
--   number: match | close (within close_within) | miss, plus direction up/down = the answer is higher/lower
--   a null on either side (e.g. episodes of an ongoing show) is match if both are null, else unknown
-- result: correct | same_franchise (hard mode: another entry of the answer's franchise) | wrong
-- Internal: not callable from the browser (execute revoked below).
create or replace function grade_guess(p_mode text, p_answer_id text, p_answer_franchise_id text,
                                       p_answer_clues jsonb, p_guess_id text)
returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
    g game_items%rowtype;
    feedback jsonb := '[]'::jsonb;
    c record;
    gv jsonb; av jsonb;
    gn numeric; an numeric;
    v_status text; v_direction text;
begin
    select * into g from game_items where mode = p_mode and item_id = p_guess_id;
    if not found then
        raise exception 'unknown % guess: %', p_mode, p_guess_id using errcode = 'P0002';
    end if;

    for c in select * from game_clues where mode = p_mode order by sort_order loop
        gv := g.clues -> c.clue_key;
        av := p_answer_clues -> c.clue_key;
        v_direction := null;

        if coalesce(jsonb_typeof(gv), 'null') = 'null' or coalesce(jsonb_typeof(av), 'null') = 'null' then
            v_status := case when coalesce(jsonb_typeof(gv), 'null') = coalesce(jsonb_typeof(av), 'null')
                             then 'match' else 'unknown' end;
        elsif c.compare = 'set' then
            v_status := case
                when (select coalesce(array_agg(x order by x), '{}') from jsonb_array_elements_text(gv) x)
                   = (select coalesce(array_agg(x order by x), '{}') from jsonb_array_elements_text(av) x) then 'match'
                when exists (select 1 from jsonb_array_elements_text(gv) x
                             where x in (select jsonb_array_elements_text(av))) then 'partial'
                else 'miss' end;
        elsif c.compare = 'number' then
            gn := gv::text::numeric;
            an := av::text::numeric;
            v_direction := case when an > gn then 'up' when an < gn then 'down' end;
            v_status := case
                when an = gn then 'match'
                when c.close_within is not null and abs(an - gn) <=
                     c.close_within * case when c.close_is_relative then abs(an) else 1 end then 'close'
                else 'miss' end;
        else
            v_status := case when gv = av then 'match' else 'miss' end;
        end if;

        feedback := feedback || jsonb_build_object(
            'key', c.clue_key, 'label', c.label, 'value', gv, 'status', v_status, 'direction', v_direction);
    end loop;

    return jsonb_build_object(
        'guess', jsonb_build_object('id', g.item_id, 'name', g.name, 'image_url', g.image_url),
        'result', case
            when g.item_id = p_answer_id then 'correct'
            when p_mode = 'anime' and g.franchise_id = p_answer_franchise_id then 'same_franchise'
            else 'wrong' end,
        'clues', feedback);
end $$;

-- Full state of a game: guesses so far (graded), revealed hints, and the answer once the game is over.
-- The browser calls it to resume after a reload; start_game / submit_guess / reveal_hint return it too.
create or replace function get_game(p_session_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
    s game_sessions%rowtype;
begin
    select * into s from game_sessions where session_id = p_session_id;
    if not found then
        raise exception 'unknown game %', p_session_id using errcode = 'P0002';
    end if;

    return jsonb_build_object(
        'session_id', s.session_id,
        'mode', s.mode,
        'play_type', s.play_type,
        'puzzle_date', s.puzzle_date,
        'difficulty_tier', s.difficulty_tier,
        'status', s.status,
        'gave_up', s.gave_up,
        'attempts', s.attempts,
        'max_attempts', 15,
        -- one hint unlocks after every 5th guess (turns 5 and 10); the name is revealed at 15 (game over)
        'hints_available', case when s.status = 'playing'
                                then least(s.attempts / 5, 2) - cardinality(s.hints_revealed) else 0 end,
        'hints', coalesce((
            select jsonb_agg(jsonb_build_object('key', c.clue_key, 'label', c.label,
                                                'value', s.answer_clues -> c.clue_key) order by h.ord)
            from unnest(s.hints_revealed) with ordinality as h(clue_key, ord)
            join game_clues c on c.mode = s.mode and c.clue_key = h.clue_key), '[]'::jsonb),
        'guesses', coalesce((
            select jsonb_agg(grade_guess(s.mode, s.answer_id, s.answer_franchise_id, s.answer_clues, e.guess_id)
                             || jsonb_build_object('attempt_no', e.attempt_no) order by e.attempt_no)
            from guess_events e where e.session_id = s.session_id), '[]'::jsonb),
        'answer', case when s.status != 'playing' then jsonb_build_object(
            'id', s.answer_id, 'name', s.answer_name, 'image_url', s.answer_image_url, 'clues', s.answer_clues) end);
end $$;

-- Start a game. Daily: today's puzzle (UTC date); a player who already started today's game gets it back.
-- Random: a random answer from difficulty tiers <= p_tier (1 easy, 2 normal, 3 hard).
--   supabase.rpc('start_game', { p_mode: 'franchise', p_play_type: 'daily', p_player_id: '<uuid>' })
create or replace function start_game(p_mode text, p_play_type text, p_player_id uuid, p_tier int default 2)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
    v_today date := (now() at time zone 'utc')::date;
    v_session uuid;
begin
    if p_mode not in ('franchise', 'anime', 'character') then
        raise exception 'unknown mode %', p_mode using errcode = '22023';
    end if;

    if p_play_type = 'daily' then
        select session_id into v_session from game_sessions
        where player_id = p_player_id and mode = p_mode and play_type = 'daily' and puzzle_date = v_today;

        if v_session is null then
            insert into game_sessions (player_id, mode, play_type, puzzle_date, answer_id, answer_name,
                                       answer_image_url, answer_franchise_id, answer_clues)
            select p_player_id, mode, 'daily', puzzle_date, answer_id, answer_name,
                   answer_image_url, answer_franchise_id, answer_clues
            from daily_puzzles
            where mode = p_mode and puzzle_date = v_today
            returning session_id into v_session;
        end if;
        if v_session is null then
            raise exception 'no daily % puzzle for %', p_mode, v_today using errcode = 'P0002';
        end if;

    elsif p_play_type = 'random' then
        if p_tier not in (1, 2, 3) then
            raise exception 'tier must be 1, 2 or 3' using errcode = '22023';
        end if;
        insert into game_sessions (player_id, mode, play_type, difficulty_tier, answer_id, answer_name,
                                   answer_image_url, answer_franchise_id, answer_clues)
        select p_player_id, i.mode, 'random', p_tier, i.item_id, i.name, i.image_url, i.franchise_id, i.clues
        from puzzle_candidates pc
        join game_items i on i.mode = pc.mode and i.item_id = pc.answer_id
        where pc.mode = p_mode and pc.difficulty_tier <= p_tier
        order by random()
        limit 1
        returning session_id into v_session;

    else
        raise exception 'play_type must be daily or random' using errcode = '22023';
    end if;

    return get_game(v_session);
end $$;

-- Submit a guess (an item_id from search_game_titles). Returns this guess's feedback and the updated game.
--   supabase.rpc('submit_guess', { p_session_id: '<uuid>', p_guess_id: 'naruto' })
create or replace function submit_guess(p_session_id uuid, p_guess_id text)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
    s game_sessions%rowtype;
    v_grade jsonb;
begin
    select * into s from game_sessions where session_id = p_session_id for update;
    if not found then
        raise exception 'unknown game %', p_session_id using errcode = 'P0002';
    end if;
    if s.status != 'playing' then
        raise exception 'game is already over' using errcode = '22023';
    end if;
    if exists (select 1 from guess_events where session_id = p_session_id and guess_id = p_guess_id) then
        raise exception 'already guessed %', p_guess_id using errcode = '23505';
    end if;

    v_grade := grade_guess(s.mode, s.answer_id, s.answer_franchise_id, s.answer_clues, p_guess_id);

    insert into guess_events (session_id, attempt_no, guess_id, result, hints_before)
    values (p_session_id, s.attempts + 1, p_guess_id, v_grade ->> 'result', cardinality(s.hints_revealed));

    update game_sessions set
        attempts = attempts + 1,
        status = case when v_grade ->> 'result' = 'correct' then 'won'
                      when attempts + 1 >= 15 then 'lost'
                      else 'playing' end,
        finished_at = case when v_grade ->> 'result' = 'correct' or attempts + 1 >= 15 then now() end
    where session_id = p_session_id;

    return jsonb_build_object('feedback', v_grade || jsonb_build_object('attempt_no', s.attempts + 1),
                              'game', get_game(p_session_id));
end $$;

-- Reveal one clue of the answer (any clue column of the mode; never the name). One hint unlocks after
-- guesses 5 and 10.
--   supabase.rpc('reveal_hint', { p_session_id: '<uuid>', p_clue_key: 'studios' })
create or replace function reveal_hint(p_session_id uuid, p_clue_key text)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
    s game_sessions%rowtype;
begin
    select * into s from game_sessions where session_id = p_session_id for update;
    if not found then
        raise exception 'unknown game %', p_session_id using errcode = 'P0002';
    end if;
    if s.status != 'playing' then
        raise exception 'game is already over' using errcode = '22023';
    end if;
    if least(s.attempts / 5, 2) - cardinality(s.hints_revealed) <= 0 then
        raise exception 'no hint available yet' using errcode = '22023';
    end if;
    if not exists (select 1 from game_clues where mode = s.mode and clue_key = p_clue_key) then
        raise exception 'unknown clue % for %', p_clue_key, s.mode using errcode = '22023';
    end if;
    if p_clue_key = any (s.hints_revealed) then
        raise exception 'clue % already revealed', p_clue_key using errcode = '22023';
    end if;

    update game_sessions set hints_revealed = hints_revealed || p_clue_key where session_id = p_session_id;
    return get_game(p_session_id);
end $$;

-- Give up: end the game early. Counts as lost (gave_up = true) and the answer is revealed by get_game.
--   supabase.rpc('give_up', { p_session_id: '<uuid>' })
create or replace function give_up(p_session_id uuid)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
    s game_sessions%rowtype;
begin
    select * into s from game_sessions where session_id = p_session_id for update;
    if not found then
        raise exception 'unknown game %', p_session_id using errcode = 'P0002';
    end if;
    if s.status != 'playing' then
        raise exception 'game is already over' using errcode = '22023';
    end if;

    update game_sessions set status = 'lost', gave_up = true, finished_at = now()
    where session_id = p_session_id;
    return get_game(p_session_id);
end $$;

-- Higher or Lower: a shuffled deck of cards. 20 correct in a row wins, so 50 cards is plenty.
--   supabase.rpc('higher_lower_deck', { p_kind: 'anime' })
create or replace function higher_lower_deck(p_kind text, p_size int default 50)
returns setof higher_lower_cards
language sql volatile
set search_path = public
as $$
    select * from higher_lower_cards where kind = p_kind order by random() limit least(p_size, 200)
$$;

-- grade_guess is a helper for the functions above, not part of the browser API
revoke execute on function grade_guess(text, text, text, jsonb, text) from public;
do $$
begin
    if exists (select 1 from pg_roles where rolname = 'anon') then
        revoke execute on function grade_guess(text, text, text, jsonb, text) from anon, authenticated;
    end if;
end $$;

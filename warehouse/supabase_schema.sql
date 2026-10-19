-- Supabase (Postgres) schema for the game. Mirrors the BigQuery marts it is exported from.
-- Apply once: `python -m warehouse.export_supabase --init` (safe to re-run), or paste into the Supabase SQL editor.
--
-- Access: the browser uses the publishable/anon key, so Row Level Security is on for every table.
-- Game tables get a read-only policy for anon. daily_puzzles has NO anon policy: answers are read server-side only
-- (Next.js route handlers with the secret key), so players can't look up tomorrow's answer.

create extension if not exists pg_trgm;

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

create table if not exists daily_puzzles (
    puzzle_id          text primary key,
    puzzle_date        date not null,
    mode               text not null,
    answer_id          text not null,
    answer_name        text not null,
    answer_attributes  jsonb not null,
    frozen_at          timestamptz not null
);
create index if not exists daily_puzzles_date_mode_idx on daily_puzzles (puzzle_date, mode);

-- Row Level Security
alter table franchises       enable row level security;
alter table anime            enable row level security;
alter table anime_characters enable row level security;
alter table search_titles    enable row level security;
alter table daily_puzzles    enable row level security;

do $$
declare t text;
begin
    foreach t in array array['franchises', 'anime', 'anime_characters', 'search_titles'] loop
        if not exists (select 1 from pg_policies where tablename = t and policyname = 'public read') then
            execute format('create policy "public read" on %I for select to anon, authenticated using (true)', t);
        end if;
    end loop;
end $$;

-- Autocomplete in one call from the browser:
--   supabase.rpc('search_game_titles', { q: 'shinge', k: 'franchise' })
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

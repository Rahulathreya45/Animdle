{{ config(
    materialized = 'incremental',
    unique_key = 'puzzle_id',
    full_refresh = false,
    on_schema_change = 'fail'
) }}

-- One row per (date, mode): the daily answer and its attributes, frozen when the day is first built.
-- Incremental runs only add dates after the newest one already stored and never recompute old days, so a published
-- puzzle never changes even when scores drift or the candidate pool changes (CLAUDE.md: freeze the snapshot).
-- full_refresh = false: `dbt build --full-refresh` skips this model, protecting the published history.
--
-- Picking: each mode's candidates get a fixed shuffled order (hash of answer + seed); day N of the schedule takes
-- position N mod pool size. Deterministic, so a rerun or backfill picks the same answer for the same day.

with dates as (
    select puzzle_date
    from unnest(generate_date_array(
        date('{{ var("puzzle_start_date") }}'),
        date_add(current_date(), interval {{ var('puzzle_days_ahead') }} day)
    )) as puzzle_date
    {% if is_incremental() %}
    where puzzle_date > (select max(puzzle_date) from {{ this }})
    {% endif %}
),

candidates as (
    select
        *,
        row_number() over (
            partition by mode
            order by farm_fingerprint(concat(mode, ':', answer_id, ':', '{{ var("puzzle_seed") }}'))
        ) - 1 as position
    from {{ ref('fct_puzzle_candidates') }}
),

pools as (
    select distinct mode, pool_size from candidates
),

schedule as (
    select
        d.puzzle_date,
        p.mode,
        mod(date_diff(d.puzzle_date, date('{{ var("puzzle_start_date") }}'), day), p.pool_size) as position
    from dates as d
    cross join pools as p
),

picked as (
    select s.puzzle_date, s.mode, c.answer_id, c.answer_name, c.character_anilist_id
    from schedule as s
    inner join candidates as c using (mode, position)
)

select
    concat(p.mode, '-', cast(p.puzzle_date as string)) as puzzle_id,
    p.puzzle_date,
    p.mode,
    p.answer_id,
    p.answer_name,
    case p.mode
        when 'franchise' then to_json(struct(
            f.franchise_name as name, f.cover_image_url, f.year, f.score, f.popularity, f.genres, f.studios,
            f.source_material, f.country_of_origin, f.age_rating_code, f.is_ongoing, f.has_movie, f.is_movie_only,
            f.format_label, f.episodes, f.episodes_unit
        ))
        when 'anime' then to_json(struct(
            a.display_title as name, a.cover_image_url, a.season_year as year, a.season, a.`format`, a.score,
            a.popularity, a.genres, a.studios, a.source_material, a.country_of_origin, a.age_rating_code, a.is_ongoing,
            a.episodes, a.franchise_id
        ))
        when 'character' then to_json(struct(
            c.character_name as name, c.character_image_url as image_url, c.character_name_native, c.character_role,
            c.gender, c.favourites, c.anime_title, c.anime_genres, c.anime_format, c.anime_year
        ))
    end as answer_attributes,
    current_timestamp() as frozen_at
from picked as p
left join {{ ref('dim_franchise') }} as f
    on p.mode = 'franchise' and f.franchise_id = p.answer_id
left join {{ ref('dim_anime') }} as a
    on p.mode = 'anime' and cast(a.anilist_id as string) = p.answer_id
left join {{ ref('dim_anime_characters') }} as c
    on p.mode = 'character' and cast(c.character_id as string) = p.answer_id and c.anilist_id = p.character_anilist_id

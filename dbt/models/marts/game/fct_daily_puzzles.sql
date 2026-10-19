{{ config(
    materialized = 'incremental',
    unique_key = 'puzzle_id',
    full_refresh = false,
    on_schema_change = 'fail'
) }}

-- One row per (date, mode): the daily answer and its clue values, frozen when the day is first built.
-- Incremental runs only add dates after the newest one already stored and never recompute old days, so a published
-- puzzle never changes even when scores drift or the candidate pool changes (CLAUDE.md: freeze the snapshot).
-- full_refresh = false: `dbt build --full-refresh` skips this model, protecting the published history.
--
-- Picking: the daily pool is difficulty tiers 1-2 of fct_puzzle_candidates. Each mode's pool gets a fixed shuffled
-- order (hash of answer + seed); day N of the schedule takes position N mod pool size. Deterministic, so a rerun or
-- backfill picks the same answer for the same day.

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
        mode,
        answer_id,
        row_number() over (
            partition by mode
            order by farm_fingerprint(concat(mode, ':', answer_id, ':', '{{ var("puzzle_seed") }}'))
        ) - 1 as position,
        count(*) over (partition by mode) as pool_size
    from {{ ref('fct_puzzle_candidates') }}
    where difficulty_tier <= 2
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
)

select
    concat(s.mode, '-', cast(s.puzzle_date as string)) as puzzle_id,
    s.puzzle_date,
    s.mode,
    i.item_id as answer_id,
    i.name as answer_name,
    i.image_url as answer_image_url,
    i.franchise_id as answer_franchise_id,
    i.clues as answer_clues,
    current_timestamp() as frozen_at
from schedule as s
inner join candidates as c using (mode, position)
inner join {{ ref('dim_game_items') }} as i on i.mode = c.mode and i.item_id = c.answer_id

-- The answer pool: one row per (mode, possible answer), with a difficulty tier.
-- Answers must be game-eligible (every clue known, real image); the guess pool (autocomplete) is all of
-- dim_game_items.
--
-- Tiers, by popularity (favourites for characters) within the mode:
--   1 easy   = the puzzle_easy_pool_size most popular
--   2 normal = at least puzzle_min_popularity / puzzle_min_character_favourites (the daily pool is tiers 1-2)
--   3 hard   = every other eligible answer above puzzle_hard_min_popularity / puzzle_hard_min_character_favourites
-- Random mode at tier N draws from tiers <= N. Below the hard floor an item is guessable but never an answer.
-- popularity_rank is a placeholder difficulty signal until the solver simulation exists.

with ranked as (
    select
        mode,
        item_id as answer_id,
        name as answer_name,
        popularity as pool_metric,
        is_adult,
        row_number() over (partition by mode order by popularity desc, item_id) as popularity_rank
    from {{ ref('dim_game_items') }}
    where is_game_eligible
        and popularity >= if(mode = 'character',
            {{ var('puzzle_hard_min_character_favourites') }}, {{ var('puzzle_hard_min_popularity') }})
)

select
    *,
    case
        when popularity_rank <= {{ var('puzzle_easy_pool_size') }} then 1
        when pool_metric >= if(mode = 'character',
            {{ var('puzzle_min_character_favourites') }}, {{ var('puzzle_min_popularity') }}) then 2
        else 3
    end as difficulty_tier
from ranked

-- The answer pool: one row per (mode, possible answer).
-- Answers must be game-eligible (every clue known) and well known enough to be fair; the guess pool (autocomplete)
-- is the full catalog in dim_franchise / dim_anime / dim_anime_characters.
-- popularity_rank is a placeholder difficulty signal until the solver simulation exists.

with franchise as (
    select
        'franchise' as mode,
        franchise_id as answer_id,
        franchise_name as answer_name,
        cast(null as int64) as character_anilist_id,
        popularity as pool_metric,
        is_adult
    from {{ ref('dim_franchise') }}
    where is_game_eligible
        and popularity >= {{ var('puzzle_min_popularity') }}
),

anime as (
    select
        'anime' as mode,
        cast(anilist_id as string) as answer_id,
        display_title as answer_name,
        cast(null as int64) as character_anilist_id,
        popularity as pool_metric,
        is_adult
    from {{ ref('dim_anime') }}
    where is_game_eligible
        and popularity >= {{ var('puzzle_min_popularity') }}
),

-- one row per character: the appearance in its most popular anime gives the anime-side clues
characters as (
    select
        'character' as mode,
        cast(c.character_id as string) as answer_id,
        c.character_name as answer_name,
        c.anilist_id as character_anilist_id,
        c.favourites as pool_metric,
        c.is_adult_anime as is_adult
    from {{ ref('dim_anime_characters') }} as c
    inner join {{ ref('dim_anime') }} as a using (anilist_id)
    where c.is_game_eligible
        and c.favourites >= {{ var('puzzle_min_character_favourites') }}
    qualify row_number() over (partition by c.character_id order by a.popularity desc, c.anilist_id) = 1
),

unioned as (
    select * from franchise
    union all
    select * from anime
    union all
    select * from characters
)

select
    *,
    row_number() over (partition by mode order by pool_metric desc, answer_id) as popularity_rank,
    count(*) over (partition by mode) as pool_size
from unioned

-- One row per guessable item per mode: the full guess pool, with every clue value in one JSON object.
-- `clues` keys match seeds/game_clues.csv (one row per clue: label, how to compare). The Supabase check_guess
-- function compares a guess's clues with the answer's key by key using that seed, and fct_daily_puzzles freezes
-- the answer's `clues` on the day, so the JSON shape is defined only here.
--
-- Modes: franchise (normal), anime (hard: individual entries), character.

with franchise as (
    select
        'franchise' as mode,
        franchise_id as item_id,
        franchise_name as name,
        cover_image_url as image_url,
        franchise_id,
        popularity,
        is_adult,
        is_game_eligible,
        to_json(struct(
            genres,
            year,
            is_ongoing as ongoing,
            score,
            format_label as `format`,
            studios,
            source_material as source,
            country_of_origin as country,
            age_rating_code as age_rating,
            episodes,
            episodes_unit
        )) as clues
    from {{ ref('dim_franchise') }}
),

anime as (
    select
        'anime' as mode,
        cast(anilist_id as string) as item_id,
        display_title as name,
        cover_image_url as image_url,
        franchise_id,
        popularity,
        is_adult,
        is_game_eligible,
        to_json(struct(
            genres,
            season_year as year,
            season,
            `format`,
            is_ongoing as ongoing,
            score,
            studios,
            source_material as source,
            country_of_origin as country,
            age_rating_code as age_rating,
            episodes
        )) as clues
    from {{ ref('dim_anime') }}
),

characters as (
    select
        'character' as mode,
        cast(character_id as string) as item_id,
        character_name as name,
        character_image_url as image_url,
        franchise_id,
        favourites as popularity,
        is_adult_franchise as is_adult,
        is_game_eligible,
        to_json(struct(
            gender,
            character_role as role,
            franchise_name as franchise,
            franchise_genres as genres,
            franchise_year as year,
            franchise_format_label as `format`,
            franchise_studios as studios,
            favourites
        )) as clues
    from {{ ref('dim_character') }}
)

select * from franchise
union all
select * from anime
union all
select * from characters

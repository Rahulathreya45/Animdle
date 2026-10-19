-- One row per searchable title, for autocomplete: every English / romaji / native title and synonym, pointing at
-- the franchise, anime entry or character it belongs to. `display_name` is what the dropdown shows;
-- `popularity` ranks matches (favourites for characters).

with franchise as (
    select
        'franchise' as kind,
        franchise_id as target_id,
        franchise_name as display_name,
        title,
        popularity
    from {{ ref('dim_franchise') }},
        unnest(aliases) as title
),

anime as (
    select
        'anime' as kind,
        cast(anilist_id as string) as target_id,
        display_title as display_name,
        title,
        popularity
    from {{ ref('dim_anime') }},
        unnest(array_concat([display_title, title_english, title_romaji, title_native], synonyms)) as title
),

-- labelled with the character's home franchise (dim_character), so it matches the clues a guess returns
characters as (
    select
        'character' as kind,
        cast(character_id as string) as target_id,
        concat(coalesce(character_name, character_name_native), ' (', franchise_name, ')') as display_name,
        title,
        favourites as popularity
    from {{ ref('dim_character') }},
        unnest([character_name, character_name_native]) as title
)

select distinct kind, target_id, display_name, trim(title) as title, popularity
from (
    select * from franchise
    union all
    select * from anime
    union all
    select * from characters
)
where title is not null and trim(title) != ''

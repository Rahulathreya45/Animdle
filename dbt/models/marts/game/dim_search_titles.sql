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

-- a character appears in several anime; label it with its most popular one
character_label as (
    select c.character_id, c.character_name, c.character_name_native, c.favourites, c.anime_title
    from {{ ref('dim_anime_characters') }} as c
    inner join {{ ref('dim_anime') }} as a using (anilist_id)
    qualify row_number() over (partition by c.character_id order by a.popularity desc, c.anilist_id) = 1
),

characters as (
    select
        'character' as kind,
        cast(character_id as string) as target_id,
        concat(character_name, ' (', anime_title, ')') as display_name,
        title,
        favourites as popularity
    from character_label,
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

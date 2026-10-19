-- Cards for Higher or Lower: one row per (kind, item). The player sees two cards and guesses whether the second
-- has a higher or lower value.
--   anime     = individual AniList entries (each season has its own popularity), value = AniList members
--   character = one row per character, value = favourites
-- Floors keep the cards recognisable: comparing two titles nobody has heard of is a coin flip.

select
    'anime' as kind,
    cast(anilist_id as string) as item_id,
    display_title as name,
    -- small line under the name so seasons of one show can be told apart
    concat(
        case `format`
            when 'TV' then 'TV' when 'TV_SHORT' then 'TV Short' when 'MOVIE' then 'Movie' when 'SPECIAL' then 'Special'
            when 'OVA' then 'OVA' when 'ONA' then 'ONA' else 'Other'
        end,
        coalesce(concat(' · ', cast(season_year as string)), '')
    ) as subtitle,
    cover_image_url as image_url,
    popularity as value,
    franchise_id,
    is_adult
from {{ ref('dim_anime') }}
where popularity >= {{ var('higher_lower_min_popularity') }}
    and cover_image_url is not null
    and not ends_with(cover_image_url, '/default.jpg')

union all

select
    'character' as kind,
    cast(character_id as string) as item_id,
    character_name as name,
    franchise_name as subtitle,
    character_image_url as image_url,
    favourites as value,
    franchise_id,
    is_adult_franchise as is_adult
from {{ ref('dim_character') }}
where favourites >= {{ var('higher_lower_min_favourites') }}
    and has_image
    and character_name is not null

-- One row per (anime, character): AniList's top 25 characters of each anime in dim_anime.
-- A character in several anime (e.g. a sequel) has one row per anime; `favourites` is per character,
-- so it is the same on each of those rows.
-- The anime's genres / format / year are carried along so "guess the character" can give the same
-- per-attribute feedback as "guess the anime".

select
    a.anilist_id,
    a.mal_id,
    a.display_title as anime_title,
    a.genres as anime_genres,
    a.`format` as anime_format,
    a.season_year as anime_year,
    a.is_adult as is_adult_anime,
    c.character_id,
    coalesce(c.character_name, c.character_name_native) as character_name,
    c.character_name_native,
    c.character_role,
    c.favourites,
    -- AniList gender is free text ("Female (Varies)", "Male (past life) → Agender"); normalised for comparing
    case
        when c.gender is null then 'Unknown'
        when lower(trim(c.gender)) = 'male' then 'Male'
        when lower(trim(c.gender)) = 'female' then 'Female'
        when lower(trim(c.gender)) = 'non-binary' then 'Non-binary'
        else 'Other'
    end as gender,
    c.gender as gender_raw,
    c.age_text,
    c.character_image_url,
    -- usable as a "guess the character" answer: has a name and picture, and every anime attribute is known
    coalesce(c.character_name, c.character_name_native) is not null
        and c.character_image_url is not null
        and a.display_title is not null
        and array_length(a.genres) > 0
        and a.`format` != 'UNKNOWN'
        and a.season_year is not null
        as is_game_eligible
from {{ ref('stg_anilist__characters') }} as c
inner join {{ ref('dim_anime') }} as a using (anilist_id)  -- inner: drops MUSIC entries, like dim_anime

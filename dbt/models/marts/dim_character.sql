-- One row per character: the grain of "guess the character".
-- dim_anime_characters has a row per (anime, character), so Naruto has 27 rows with 17 different years. Here each
-- character gets one **home franchise** and takes its clues (year, genres, format, studios) from dim_franchise,
-- so a guess always compares one set of values.
--
-- Home franchise = where the character has their biggest role (MAIN > SUPPORTING > BACKGROUND), then where they
-- appear in the most entries, then the most popular franchise. This drops cameos and crossovers
-- (Luffy in a Dragon Ball crossover special, Lelouch in Gintama).

with appearances as (
    select
        c.character_id,
        a.franchise_id,
        min(case c.character_role when 'MAIN' then 1 when 'SUPPORTING' then 2 else 3 end) as role_rank,
        count(*) as entries_in_franchise
    from {{ ref('dim_anime_characters') }} as c
    inner join {{ ref('dim_anime') }} as a using (anilist_id)
    group by c.character_id, a.franchise_id
),

home as (
    select ap.*
    from appearances as ap
    inner join {{ ref('dim_franchise') }} as f using (franchise_id)
    qualify row_number() over (
        partition by ap.character_id
        order by ap.role_rank, ap.entries_in_franchise desc, f.popularity desc nulls last, ap.franchise_id
    ) = 1
),

-- per-character fields are the same on every row of dim_anime_characters; take them once
character_info as (
    select
        character_id,
        any_value(character_name) as character_name,
        any_value(character_name_native) as character_name_native,
        any_value(gender) as gender,
        any_value(gender_raw) as gender_raw,
        max(favourites) as favourites,
        any_value(character_image_url) as character_image_url
    from {{ ref('dim_anime_characters') }}
    group by character_id
),

final as (
    select
        ci.character_id,
        ci.character_name,
        ci.character_name_native,
        ci.gender,
        ci.gender_raw,
        case h.role_rank when 1 then 'MAIN' when 2 then 'SUPPORTING' else 'BACKGROUND' end as character_role,
        ci.favourites,
        ci.character_image_url,
        ci.character_image_url is not null
            and not ends_with(ci.character_image_url, '/default.jpg') as has_image,
        h.franchise_id,
        h.entries_in_franchise,
        f.franchise_name,
        f.year as franchise_year,
        f.genres as franchise_genres,
        f.format_label as franchise_format_label,
        f.studios as franchise_studios,
        f.is_adult as is_adult_franchise
    from character_info as ci
    inner join home as h using (character_id)
    inner join {{ ref('dim_franchise') }} as f using (franchise_id)
)

select
    *,
    -- usable as an answer: has a name, a real picture and every franchise clue
    character_name is not null
        and has_image
        and franchise_year is not null
        and array_length(franchise_genres) > 0
        and franchise_studios[offset(0)] != 'UNKNOWN'
        as is_game_eligible
from final

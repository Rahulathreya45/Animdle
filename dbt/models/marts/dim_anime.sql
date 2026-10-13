-- One row per anime (AniList entry). The guess pool for the game: every non-MUSIC title.
-- Columns the game guesses on are never null; where a source has no value we fall back to another
-- source, or to an explicit label ('UNKNOWN', 'Not rated'). `is_game_eligible` marks rows that have a
-- real value for every game attribute, so they can be picked as answers.

with media as (
    select * from {{ ref('stg_anilist__media') }}
    where `format` is distinct from 'MUSIC'  -- keeps null-format rows; `!= 'MUSIC'` would drop them
),

kitsu as (
    select * from {{ ref('stg_kitsu__anime') }}
),

shikimori as (
    select
        mal_id,
        shikimori_id,
        title_english,
        title_romaji,
        nullif(score, 0) as score,  -- Shikimori returns 0 for "no score yet"
        array(select s.name from unnest(studios) as s where s.name is not null) as studio_names
    from {{ ref('stg_shikimori__anime') }}
),

anilist_main_studios as (
    select
        anilist_id,
        array_agg(studio_name order by studio_name) as studio_names
    from {{ ref('stg_anilist__studios') }}
    where is_main and is_animation_studio
    group by anilist_id
),

joined as (
    select
        m.*,
        k.kitsu_id,
        k.title_english as kitsu_title_english,
        k.canonical_title as kitsu_canonical_title,
        k.age_rating,
        k.age_rating_guide,
        s.shikimori_id,
        s.title_english as shikimori_title_english,
        s.title_romaji as shikimori_title_romaji,
        s.score as shikimori_score,
        s.studio_names as shikimori_studios,
        st.studio_names as anilist_studios,
        fm.franchise_id
    from media as m
    left join kitsu as k using (mal_id)
    left join shikimori as s using (mal_id)
    left join anilist_main_studios as st using (anilist_id)
    left join {{ ref('int_franchise_members') }} as fm using (anilist_id)
),

final as (
    select
        anilist_id,
        mal_id,
        kitsu_id,
        shikimori_id,
        franchise_id,

        -- titles: English from any source first, then romaji
        coalesce(title_english, kitsu_title_english, shikimori_title_english,
                 title_romaji, shikimori_title_romaji, kitsu_canonical_title) as display_title,
        title_english,
        title_romaji,
        title_native,
        coalesce(synonyms, []) as synonyms,

        coalesce(`format`, 'UNKNOWN') as `format`,
        status,
        status = 'RELEASING' as is_ongoing,

        -- season: AniList's value, else derived from the start month with AniList's own rule
        -- (checked against the data: Jan-Feb WINTER, Mar-May SPRING, Jun-Aug SUMMER, Sep-Dec FALL)
        coalesce(season, case
            when start_month in (1, 2) then 'WINTER'
            when start_month in (3, 4, 5) then 'SPRING'
            when start_month in (6, 7, 8) then 'SUMMER'
            when start_month in (9, 10, 11, 12) then 'FALL'
        end, 'UNKNOWN') as season,
        season is null and start_month is not null as is_season_derived,
        coalesce(season_year, start_year) as season_year,
        start_year,
        start_date,
        end_date,

        coalesce(source_material, 'UNKNOWN') as source_material,
        coalesce(genres, []) as genres,
        episodes,
        episode_duration_min,
        country_of_origin,
        is_adult,

        -- score on the MAL 0-10 scale: Shikimori (mirrors MAL), else AniList / 10, else null (NA)
        coalesce(shikimori_score, round(average_score / 10, 1)) as score,
        case
            when shikimori_score is not null then 'shikimori'
            when average_score is not null then 'anilist'
        end as score_source,
        shikimori_score,
        average_score as anilist_score,
        popularity,
        favourites,

        -- age rating: AniList's adult flag wins (R18), else Kitsu's code, else 'Not rated'.
        -- age_rating_code is what the game compares; Kitsu's guide text is inconsistent
        -- ("R - Violence, Profanity" vs "R - 17+ (violence & profanity)"), so it is for display only.
        case
            when is_adult then 'R18'
            when age_rating is not null then age_rating
            else 'Not rated'
        end as age_rating_code,
        case
            when is_adult and age_rating is distinct from 'R18' then 'R18 - Adult'
            when age_rating is null then 'Not rated'
            when age_rating_guide is null then age_rating
            else concat(age_rating, ' - ', age_rating_guide)
        end as age_rating,

        -- studios: Shikimori, else AniList main animation studio, else UNKNOWN
        case
            when array_length(shikimori_studios) > 0 then shikimori_studios
            when array_length(anilist_studios) > 0 then anilist_studios
            else ['UNKNOWN']
        end as studios,

        cover_image_url
    from joined
)

select
    *,
    -- has a real value for every attribute the game reveals, so it can be an answer
    status in ('FINISHED', 'RELEASING')
        and display_title is not null
        and `format` != 'UNKNOWN'
        and season != 'UNKNOWN'
        and season_year is not null
        and source_material != 'UNKNOWN'
        and array_length(genres) > 0
        and score is not null
        and studios[offset(0)] != 'UNKNOWN'
        and cover_image_url is not null
        and country_of_origin is not null
        -- ongoing shows often have no episode total yet (e.g. One Piece); the UI shows "Ongoing" for those
        and (episodes is not null or status = 'RELEASING')
        as is_game_eligible
from final

select
    id as anilist_id,
    idMal as mal_id,
    title.english as title_english,
    `format`,
    status,
    season,
    seasonYear as season_year,
    startDate.year as start_year,
    safe.date(startDate.year, startDate.month, startDate.day) as start_date,  -- null when AniList only knows the year
    safe.date(endDate.year, endDate.month, endDate.day) as end_date,
    episodes,
    duration as episode_duration_min,
    source as source_material,
    countryOfOrigin as country_of_origin,
    isAdult as is_adult,
    genres,
    averageScore as average_score,
    popularity,
    favourites,
    _loaded_at as loaded_at
from {{ source('raw', 'anilist_media') }}

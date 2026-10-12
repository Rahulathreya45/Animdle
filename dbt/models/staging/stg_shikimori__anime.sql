select
    mal_id,
    id as shikimori_id,
    name as title_romaji,
    english as title_english,
    score,
    franchise as franchise_slug,  -- null for standalone titles that belong to no franchise
    studios,
    _loaded_at as loaded_at
from {{ source('raw', 'shikimori_anime') }}

select
    mal_id,
    id as kitsu_id,
    subtype,
    title_en as title_english,
    canonical_title,
    age_rating,
    age_rating_guide,
    _loaded_at as loaded_at
from {{ source('raw', 'kitsu_anime') }}

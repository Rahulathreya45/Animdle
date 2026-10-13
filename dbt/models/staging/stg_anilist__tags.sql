-- one row per anime tag (themes like "Space", "Time Travel"); rank = how relevant the tag is, 0-100
select
    m.id as anilist_id,
    t.name as tag_name,
    t.rank as tag_rank,
    t.isMediaSpoiler as is_spoiler
from {{ source('raw', 'anilist_media') }} as m,
    unnest(m.tags) as t

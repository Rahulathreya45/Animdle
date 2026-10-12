-- top 25 characters per anime by favourites
select
    m.id as anilist_id,
    e.node.id as character_id,
    e.node.name.full as character_name,
    e.node.name.native as character_name_native,
    e.role as character_role,
    e.node.favourites as favourites
from {{ source('raw', 'anilist_media') }} as m,
    unnest(m.characters.edges) as e

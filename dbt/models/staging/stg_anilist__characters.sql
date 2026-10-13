-- top 25 characters per anime by favourites
select
    m.id as anilist_id,
    e.node.id as character_id,
    e.node.name.full as character_name,
    e.node.name.native as character_name_native,
    e.role as character_role,
    e.node.favourites as favourites,
    e.node.image.medium as character_image_url,
    e.node.gender as gender,
    e.node.age as age_text  -- free text ("17", "~13", "23 (Physical), 77 (Actual)"), mostly null
from {{ source('raw', 'anilist_media') }} as m,
    unnest(m.characters.edges) as e

select
    m.id as anilist_id,
    e.node.id as studio_id,
    e.node.name as studio_name,
    e.isMain as is_main,
    e.node.isAnimationStudio as is_animation_studio
from {{ source('raw', 'anilist_media') }} as m,
    unnest(m.studios.edges) as e

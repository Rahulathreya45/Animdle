-- one row per relation edge: anime -> related entry (anime or manga)
select
    m.id as anilist_id,
    e.relationType as relation_type,
    e.node.id as related_anilist_id,
    e.node.idMal as related_mal_id,
    e.node.type as related_type,
    e.node.`format` as related_format
from {{ source('raw', 'anilist_media') }} as m,
    unnest(m.relations.edges) as e

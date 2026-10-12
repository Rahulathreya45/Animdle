-- one row per directed edge in a franchise graph
select
    f.franchise as franchise_slug,
    l.source_id as source_mal_id,
    l.target_id as target_mal_id,
    l.relation
from {{ source('raw', 'shikimori_franchise') }} as f,
    unnest(f.links) as l
where f.status_code is null

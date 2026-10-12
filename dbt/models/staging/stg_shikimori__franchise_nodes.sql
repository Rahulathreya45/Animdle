-- one row per anime in a franchise graph (Shikimori ids are MAL ids)
select
    f.franchise as franchise_slug,
    n.id as mal_id,
    n.year as release_year,
    date(timestamp_seconds(n.date)) as aired_on
from {{ source('raw', 'shikimori_franchise') }} as f,
    unnest(f.nodes) as n
where f.status_code is null

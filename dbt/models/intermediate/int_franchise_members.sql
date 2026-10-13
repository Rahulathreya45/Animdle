-- Which franchise each AniList entry belongs to.
-- 1. Shikimori's `franchise` slug groups seasons, movies and spin-offs of one series.
-- 2. Entries with no slug (no MAL id, or too new for Shikimori to have grouped them) are joined up through
--    AniList's story relations (SEQUEL / PREQUEL / PARENT / SIDE_STORY): the connected components of that
--    graph, found with a recursive CTE. A component that touches a Shikimori franchise joins it; otherwise it
--    becomes its own franchise 'anilist-<lowest id in the component>'.
-- So every anime belongs to exactly one franchise.

with recursive

base as (
    select m.anilist_id, s.franchise_slug
    from {{ ref('stg_anilist__media') }} as m
    left join {{ ref('stg_shikimori__anime') }} as s using (mal_id)
),

-- story edges between anime, in both directions (AniList usually lists both, but not always)
story_edges as (
    select distinct src, dst
    from (
        select r.anilist_id as src, r.related_anilist_id as dst
        from {{ ref('stg_anilist__relations') }} as r
        where r.related_type = 'ANIME' and r.relation_type in ('SEQUEL', 'PREQUEL', 'PARENT', 'SIDE_STORY')
        union all
        select r.related_anilist_id, r.anilist_id
        from {{ ref('stg_anilist__relations') }} as r
        where r.related_type = 'ANIME' and r.relation_type in ('SEQUEL', 'PREQUEL', 'PARENT', 'SIDE_STORY')
    )
),

-- edges among entries Shikimori did not group
unassigned_edges as (
    select e.src, e.dst
    from story_edges as e
    inner join base as a on a.anilist_id = e.src and a.franchise_slug is null
    inner join base as b on b.anilist_id = e.dst and b.franchise_slug is null
),

-- every unassigned entry reaches itself, then walks the edges (depth cap guards against cycles)
reach as (
    select anilist_id, anilist_id as reached, 0 as depth
    from base
    where franchise_slug is null
    union all
    select r.anilist_id, e.dst, r.depth + 1
    from reach as r
    inner join unassigned_edges as e on e.src = r.reached
    where r.depth < 10
),

components as (
    select anilist_id, min(reached) as component_root
    from reach
    group by anilist_id
),

component_sizes as (
    select component_root, count(*) as component_size
    from components
    group by component_root
),

-- a component that is linked to a Shikimori franchise joins it
component_slugs as (
    select c.component_root, min(t.franchise_slug) as franchise_slug  -- min() only for determinism
    from components as c
    inner join story_edges as e on e.src = c.anilist_id
    inner join base as t on t.anilist_id = e.dst
    where t.franchise_slug is not null
    group by c.component_root
)

select
    b.anilist_id,
    coalesce(
        b.franchise_slug,
        cs.franchise_slug,
        concat('anilist-', cast(c.component_root as string))
    ) as franchise_id,
    case
        when b.franchise_slug is not null then 'shikimori'
        when cs.franchise_slug is not null then 'anilist_relation'
        when sz.component_size > 1 then 'anilist_component'
        else 'standalone'
    end as membership_source
from base as b
left join components as c using (anilist_id)
left join component_sizes as sz on sz.component_root = c.component_root
left join component_slugs as cs on cs.component_root = c.component_root

-- One row per franchise: the grain of the main "guess the anime" game.
-- Built from dim_anime, so every attribute already has its null handling.
--
-- "Series" = TV, TV short and ONA (web series: Blue Box season 1 is an ONA, Saiki K. season 1 a TV short).
-- "Significant" = popularity at least 10% of the franchise's most popular entry. This keeps promo videos,
-- early one-off specials and loosely related titles Shikimori groups in (Tsukihime under Fate, Chaos;Head
-- under Steins;Gate) from deciding what the franchise looks like.
--
-- Main entry = earliest released significant series, else movie, else anything (unless overridden in
-- seeds/franchise_main_entry_overrides.csv). It gives the franchise its name, cover image, year, source
-- material and country.
-- "Core" entries = significant series and movies; genres, studios, age rating and episodes come from those.

with members as (
    select
        *,
        `format` in ('TV', 'TV_SHORT', 'ONA') as is_series,
        status in ('FINISHED', 'RELEASING') as is_released,
        popularity >= 0.1 * max(popularity) over (partition by franchise_id) as is_significant
    from {{ ref('dim_anime') }}
),

members_flagged as (
    select *, is_significant and (is_series or `format` = 'MOVIE') as is_core
    from members
),

franchise_flags as (
    select franchise_id, logical_or(is_core) as has_core
    from members_flagged
    group by franchise_id
),

-- entries used for genres / studios / age rating: core entries, or every entry if the franchise has none
basis as (
    select m.*
    from members_flagged as m
    inner join franchise_flags as f using (franchise_id)
    where m.is_core or not f.has_core
),

-- hand-picked overrides (seeds/franchise_main_entry_overrides.csv) win over the rule
main_entry as (
    select m.*
    from members_flagged as m
    left join {{ ref('franchise_main_entry_overrides') }} as o using (franchise_id)
    qualify row_number() over (
        partition by franchise_id
        order by
            coalesce(m.anilist_id = o.main_anilist_id, false) desc,
            is_released desc,
            is_significant desc,
            case when is_series then 0 when `format` = 'MOVIE' then 1 else 2 end,
            coalesce(start_date, date(season_year, 1, 1)) nulls last,
            popularity desc,
            anilist_id
    ) = 1
),

-- genres that appear in at least half of the basis entries
genre_counts as (
    select franchise_id, genre, count(*) as n
    from basis, unnest(genres) as genre
    group by franchise_id, genre
),

basis_sizes as (
    select franchise_id, count(*) as n_basis
    from basis
    group by franchise_id
),

common_genres as (
    select g.franchise_id, array_agg(g.genre order by g.genre) as genres
    from genre_counts as g
    inner join basis_sizes as b using (franchise_id)
    where g.n * 2 >= b.n_basis
    group by g.franchise_id
),

all_studios as (
    select franchise_id, array_agg(distinct studio order by studio) as studios
    from basis, unnest(studios) as studio
    where studio != 'UNKNOWN'
    group by franchise_id
),

-- strictest age rating among the basis entries; 'Not rated' only when none of them is rated
strictest_rating as (
    select
        franchise_id,
        max(case age_rating_code when 'G' then 1 when 'PG' then 2 when 'R' then 3 when 'R18' then 4 end) as rating_rank
    from basis
    group by franchise_id
),

aggregates as (
    select
        franchise_id,
        count(*) as entry_count,
        countif(is_series and is_significant) as tv_count,
        countif(`format` = 'MOVIE') as movie_count,
        max(popularity) as popularity,
        logical_or(is_ongoing) as is_ongoing,
        logical_or(`format` = 'MOVIE') as has_movie,
        logical_and(`format` = 'MOVIE') as is_movie_only,
        min(season_year) as first_year_any_entry,

        -- popularity-weighted average score: main seasons dominate, obscure specials barely count
        round(safe_divide(
            sum(if(score is not null, score * popularity, 0)),
            sum(if(score is not null, popularity, 0))
        ), 2) as weighted_score,
        round(avg(score), 2) as avg_score,

        -- released TV episodes; null when a released TV entry has no total yet (ongoing, e.g. One Piece),
        -- because a partial sum would give the up/down arrow the wrong answer
        if(countif(is_series and is_significant and is_released and episodes is null) > 0, null,
           sum(if(is_series and is_significant and is_released, episodes, 0))) as tv_episodes,
        -- franchises with neither TV nor movies (OVA / ONA only): their released episodes
        if(countif(is_released and episodes is null) > 0, null,
           sum(if(is_released, episodes, 0))) as released_episodes
    from members_flagged
    group by franchise_id
),

-- every title of every entry, for autocomplete ("Shingeki no Kyojin" finds Attack on Titan).
-- Separate from `aggregates`: unnesting titles there would multiply the rows and inflate the sums.
aliases as (
    select franchise_id, array_agg(distinct t ignore nulls order by t) as aliases
    from members,
        unnest(array_concat([display_title, title_english, title_romaji, title_native], synonyms)) as t
    group by franchise_id
),

final as (
    select
        a.franchise_id,
        mi.anilist_id as main_anilist_id,
        -- strip "Season 1" style suffixes from the main entry's title
        trim(regexp_replace(mi.display_title,
            r'(?i)\s*[:\-]?\s*(season\s*1|1st\s+season|part\s*1|cour\s*1|\(tv\))\s*$', '')) as franchise_name,
        mi.title_romaji as franchise_name_romaji,
        mi.title_native as franchise_name_native,
        mi.cover_image_url,
        mi.season_year as year,
        a.first_year_any_entry,
        mi.source_material,
        mi.country_of_origin,

        coalesce(a.weighted_score, a.avg_score) as score,
        a.popularity,
        coalesce(cg.genres, mi.genres) as genres,
        coalesce(st.studios, ['UNKNOWN']) as studios,
        case r.rating_rank when 1 then 'G' when 2 then 'PG' when 3 then 'R' when 4 then 'R18' else 'Not rated' end
            as age_rating_code,
        coalesce(r.rating_rank = 4, false) as is_adult,

        a.is_ongoing,
        a.has_movie,
        a.is_movie_only,
        case
            when a.is_movie_only then 'Movie only'
            when a.tv_count > 0 and a.has_movie then 'TV + Movies'
            when a.tv_count > 0 then 'TV only'
            when a.has_movie then 'Movies + OVA/ONA'
            else 'OVA/ONA only'
        end as format_label,

        -- episode clue: TV episodes; movie-only franchises count movies; OVA/ONA-only count their episodes
        case
            when a.is_movie_only then a.movie_count
            when a.tv_count > 0 then a.tv_episodes
            else a.released_episodes
        end as episodes,
        if(a.is_movie_only, 'movies', 'episodes') as episodes_unit,

        a.entry_count,
        a.tv_count,
        a.movie_count,
        al.aliases
    from aggregates as a
    inner join main_entry as mi using (franchise_id)
    inner join aliases as al using (franchise_id)
    left join common_genres as cg using (franchise_id)
    left join all_studios as st using (franchise_id)
    left join strictest_rating as r using (franchise_id)
)

select
    *,
    -- has a real value for every clue the franchise game reveals, so it can be an answer
    franchise_name is not null
        and cover_image_url is not null
        and not ends_with(cover_image_url, '/default.jpg')  -- AniList's placeholder, not real art
        and year is not null
        and score is not null
        and array_length(genres) > 0
        and studios[offset(0)] != 'UNKNOWN'
        and source_material != 'UNKNOWN'
        and (episodes is not null or is_ongoing)
        as is_game_eligible
from final

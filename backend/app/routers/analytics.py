import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, Integer, cast
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.db import get_db
from app.models.models import Event, Site
from app.schemas.schemas import ActiveVisitor, OverviewStats, RealtimeStats, TimeseriesPoint, TopItem

router = APIRouter(prefix="/sites/{site_id}/analytics", tags=["analytics"])


async def _owned_site_or_404(site_id: uuid.UUID, user: CurrentUser, db: AsyncSession) -> Site:
    site = await db.get(Site, site_id)
    if site is None or site.owner_id != user.id:
        raise HTTPException(404, "Site not found")
    return site


def _range_start(range_: str) -> datetime:
    now = datetime.now(timezone.utc)
    days = {"24h": 1, "7d": 7, "30d": 30, "90d": 90}.get(range_, 7)
    return now - timedelta(days=days)


@router.get("/overview", response_model=OverviewStats)
async def overview(
    site_id: uuid.UUID,
    range: str = Query("7d", pattern="^(24h|7d|30d|90d)$"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _owned_site_or_404(site_id, user, db)
    since = _range_start(range)
    base = Event.site_id == site_id, Event.created_at >= since

    # Pageviews
    pageviews = (
        await db.execute(
            select(func.count()).where(*base, Event.event_type == "pageview")
        )
    ).scalar_one()

    # Unique visitors / sessions
    unique_visitors = (
        await db.execute(select(func.count(func.distinct(Event.visitor_id))).where(*base))
    ).scalar_one()
    sessions = (
        await db.execute(select(func.count(func.distinct(Event.session_id))).where(*base))
    ).scalar_one()

    # Avg scroll depth (expects properties.depth on scroll events, 0-100)
    scroll_avg_row = (
        await db.execute(
            select(func.avg(cast(Event.properties["depth"].as_string(), Integer)))
            .where(*base, Event.event_type == "scroll")
        )
    ).scalar_one_or_none()

    # Bounce rate: % of sessions that recorded exactly one pageview.
    # A session with only 1 pageview and no further interaction "bounced".
    session_pageview_counts = (
        select(Event.session_id, func.count().label("pv_count"))
        .where(*base, Event.event_type == "pageview")
        .group_by(Event.session_id)
        .subquery()
    )
    total_sessions_with_pv = (
        await db.execute(select(func.count()).select_from(session_pageview_counts))
    ).scalar_one()
    bounced_sessions = (
        await db.execute(
            select(func.count())
            .select_from(session_pageview_counts)
            .where(session_pageview_counts.c.pv_count == 1)
        )
    ).scalar_one()
    bounce_rate = (bounced_sessions / total_sessions_with_pv * 100) if total_sessions_with_pv else None

    # Avg session duration: per session, (last event time - first event time),
    # across all event types (not just pageviews) — a session that scrolls
    # and clicks without a second pageview still has real duration.
    session_spans = (
        select(
            Event.session_id,
            (func.max(Event.created_at) - func.min(Event.created_at)).label("span"),
        )
        .where(*base)
        .group_by(Event.session_id)
        .subquery()
    )
    avg_duration_row = (
        await db.execute(select(func.avg(func.extract("epoch", session_spans.c.span))))
    ).scalar_one_or_none()

    # Top pages
    top_pages_rows = (
        await db.execute(
            select(Event.url, func.count().label("c"))
            .where(*base, Event.event_type == "pageview")
            .group_by(Event.url)
            .order_by(func.count().desc())
            .limit(10)
        )
    ).all()

    # Top referrers
    top_referrers_rows = (
        await db.execute(
            select(Event.referrer, func.count().label("c"))
            .where(*base, Event.event_type == "pageview", Event.referrer.is_not(None))
            .group_by(Event.referrer)
            .order_by(func.count().desc())
            .limit(10)
        )
    ).all()

    # Top clicked elements
    top_clicks_rows = (
        await db.execute(
            select(Event.name, func.count().label("c"))
            .where(*base, Event.event_type == "click", Event.name.is_not(None))
            .group_by(Event.name)
            .order_by(func.count().desc())
            .limit(10)
        )
    ).all()

    # Device breakdown
    device_rows = (
        await db.execute(
            select(Event.device_type, func.count().label("c"))
            .where(*base, Event.device_type.is_not(None))
            .group_by(Event.device_type)
            .order_by(func.count().desc())
        )
    ).all()

    # Pageviews over time, bucketed hourly for 24h range, daily otherwise
    bucket_unit = "hour" if range == "24h" else "day"
    timeseries_rows = (
        await db.execute(
            select(
                func.date_trunc(bucket_unit, Event.created_at).label("bucket"),
                func.count().label("c"),
            )
            .where(*base, Event.event_type == "pageview")
            .group_by("bucket")
            .order_by("bucket")
        )
    ).all()

    return OverviewStats(
        pageviews=pageviews,
        unique_visitors=unique_visitors,
        sessions=sessions,
        avg_scroll_depth=float(scroll_avg_row) if scroll_avg_row is not None else None,
        bounce_rate=round(bounce_rate, 1) if bounce_rate is not None else None,
        avg_session_duration_seconds=float(avg_duration_row) if avg_duration_row is not None else None,
        top_pages=[TopItem(label=r[0], count=r[1]) for r in top_pages_rows],
        top_referrers=[TopItem(label=r[0], count=r[1]) for r in top_referrers_rows],
        top_clicks=[TopItem(label=r[0], count=r[1]) for r in top_clicks_rows],
        device_breakdown=[TopItem(label=r[0] or "unknown", count=r[1]) for r in device_rows],
        pageviews_over_time=[TimeseriesPoint(bucket=r[0], count=r[1]) for r in timeseries_rows],
    )


# "Active now" window — the standard GA-style definition: anyone with an
# event in the last 5 minutes counts as currently on the site.
REALTIME_WINDOW = timedelta(minutes=5)


@router.get("/realtime", response_model=RealtimeStats)
async def realtime(
    site_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _owned_site_or_404(site_id, user, db)
    since = datetime.now(timezone.utc) - REALTIME_WINDOW

    # Most recent event per visitor within the window, so we can show what
    # page they're currently on (not every event they've fired).
    latest_per_visitor = (
        select(
            Event.visitor_id,
            func.max(Event.created_at).label("last_seen"),
        )
        .where(Event.site_id == site_id, Event.created_at >= since)
        .group_by(Event.visitor_id)
        .subquery()
    )

    rows = (
        await db.execute(
            select(Event.visitor_id, Event.url, latest_per_visitor.c.last_seen)
            .join(
                latest_per_visitor,
                (Event.visitor_id == latest_per_visitor.c.visitor_id)
                & (Event.created_at == latest_per_visitor.c.last_seen),
            )
            .where(Event.site_id == site_id)
            .order_by(latest_per_visitor.c.last_seen.desc())
            .limit(50)
        )
    ).all()

    pageviews_last_5min = (
        await db.execute(
            select(func.count()).where(
                Event.site_id == site_id,
                Event.event_type == "pageview",
                Event.created_at >= since,
            )
        )
    ).scalar_one()

    # de-dupe visitor_id in case the join produced ties on identical timestamps
    seen = set()
    visitors: list[ActiveVisitor] = []
    for visitor_id, url, last_seen in rows:
        if visitor_id in seen:
            continue
        seen.add(visitor_id)
        visitors.append(ActiveVisitor(visitor_id=visitor_id, current_url=url, last_seen=last_seen))

    return RealtimeStats(
        active_visitors=len(visitors),
        visitors=visitors,
        pageviews_last_5min=pageviews_last_5min,
    )

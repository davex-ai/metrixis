from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from app.core.db import get_db
from app.models.models import Event, Site
from app.schemas.schemas import EventBatchIn, IngestResult

router = APIRouter(prefix="/ingest", tags=["ingest"])

MAX_BATCH_SIZE = 200


def _parse_device_type(user_agent: str | None) -> str | None:
    if not user_agent:
        return None
    ua = user_agent.lower()
    if "mobile" in ua and "tablet" not in ua:
        return "mobile"
    if "tablet" in ua or "ipad" in ua:
        return "tablet"
    return "desktop"


@router.post("", response_model=IngestResult)
async def ingest_events(
    batch: EventBatchIn,
    db: AsyncSession = Depends(get_db),
):
    if len(batch.events) > MAX_BATCH_SIZE:
        raise HTTPException(400, f"Batch too large (max {MAX_BATCH_SIZE} events)")

    result = await db.execute(select(Site).where(Site.tracking_key == batch.tracking_key))
    site = result.scalar_one_or_none()
    if site is None:
        # Don't leak whether a key exists or not — just reject uniformly.
        raise HTTPException(401, "Invalid tracking key")

    accepted = 0
    rejected = 0

    for evt in batch.events:
        if not site.tracked_events.get(evt.event_type, True):
            rejected += 1
            continue

        db.add(
            Event(
                site_id=site.id,
                event_type=evt.event_type,
                name=evt.name,
                visitor_id=evt.visitor_id,
                session_id=evt.session_id,
                url=evt.url,
                referrer=evt.referrer,
                properties=evt.properties,
                device_type=evt.device_type,
                browser=evt.browser,
            )
        )
        accepted += 1

    await db.commit()
    return IngestResult(accepted=accepted, rejected=rejected)

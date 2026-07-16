import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.db import get_db
from app.models.models import Site
from app.schemas.schemas import SiteCreate, SiteOut, SiteUpdate

router = APIRouter(prefix="/sites", tags=["sites"])


async def _get_owned_site(site_id: uuid.UUID, user: CurrentUser, db: AsyncSession) -> Site:
    site = await db.get(Site, site_id)
    if site is None or site.owner_id != user.id:
        # 404, not 403 — don't reveal that a site id exists under another account.
        raise HTTPException(404, "Site not found")
    return site


@router.get("", response_model=list[SiteOut])
async def list_sites(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Site).where(Site.owner_id == user.id).order_by(Site.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=SiteOut, status_code=201)
async def create_site(
    payload: SiteCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    site = Site(owner_id=user.id, name=payload.name, domain=payload.domain)
    if payload.tracked_events:
        site.tracked_events = {**site.tracked_events, **payload.tracked_events}
    db.add(site)
    await db.commit()
    await db.refresh(site)
    return site


@router.get("/{site_id}", response_model=SiteOut)
async def get_site(
    site_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_owned_site(site_id, user, db)


@router.patch("/{site_id}", response_model=SiteOut)
async def update_site(
    site_id: uuid.UUID,
    payload: SiteUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    site = await _get_owned_site(site_id, user, db)
    if payload.name is not None:
        site.name = payload.name
    if payload.domain is not None:
        site.domain = payload.domain
    if payload.tracked_events is not None:
        site.tracked_events = {**site.tracked_events, **payload.tracked_events}
    await db.commit()
    await db.refresh(site)
    return site


@router.delete("/{site_id}", status_code=204)
async def delete_site(
    site_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    site = await _get_owned_site(site_id, user, db)
    await db.delete(site)
    await db.commit()

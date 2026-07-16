import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# --- Sites ---

class SiteCreate(BaseModel):
    name: str
    domain: str
    tracked_events: dict[str, bool] | None = None


class SiteUpdate(BaseModel):
    name: str | None = None
    domain: str | None = None
    tracked_events: dict[str, bool] | None = None


class SiteOut(BaseModel):
    id: uuid.UUID
    name: str
    domain: str
    tracking_key: str
    tracked_events: dict[str, bool]
    created_at: datetime

    class Config:
        from_attributes = True


# --- Events (ingestion) ---

EventType = Literal["pageview", "click", "scroll", "custom"]


class EventIn(BaseModel):
    event_type: EventType
    name: str | None = None
    visitor_id: str
    session_id: str
    url: str
    referrer: str | None = None
    properties: dict[str, Any] = Field(default_factory=dict)
    device_type: str | None = None
    browser: str | None = None
    timestamp: datetime | None = None  # client-recorded time; server time used if absent


class EventBatchIn(BaseModel):
    tracking_key: str
    events: list[EventIn]


class IngestResult(BaseModel):
    accepted: int
    rejected: int


# --- Analytics query results ---

class TimeseriesPoint(BaseModel):
    bucket: datetime
    count: int


class TopItem(BaseModel):
    label: str
    count: int


class OverviewStats(BaseModel):
    pageviews: int
    unique_visitors: int
    sessions: int
    avg_scroll_depth: float | None = None
    bounce_rate: float | None = None  # % of sessions with exactly 1 pageview
    avg_session_duration_seconds: float | None = None
    top_pages: list[TopItem]
    top_referrers: list[TopItem]
    top_clicks: list[TopItem]
    device_breakdown: list[TopItem]
    pageviews_over_time: list[TimeseriesPoint]


class ActiveVisitor(BaseModel):
    visitor_id: str
    current_url: str
    last_seen: datetime


class RealtimeStats(BaseModel):
    active_visitors: int
    visitors: list[ActiveVisitor]
    pageviews_last_5min: int

import uuid
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB 
from sqlalchemy import  DateTime, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Site(Base):
    """A tracked website/project, owned by an account (owner_id = trustlyx user id)."""

    __tablename__ = "sites"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    domain: Mapped[str] = mapped_column(String, nullable=False)

    # Public key embedded in the tracker snippet. Not secret — scoping and
    # abuse prevention happen via domain allow-listing + rate limiting, the
    # same trust model Google Analytics / Plausible use for their tracking IDs.
    tracking_key: Mapped[str] = mapped_column(
        String, unique=True, index=True, default=lambda: f"mtx_{uuid.uuid4().hex}"
    )

    # Which interaction types this site wants collected. Lets an account
    # enable/disable click tracking, scroll depth, etc. per project.
    tracked_events: Mapped[dict] = mapped_column(
        JSONB, default=lambda: {"pageview": True, "click": True, "scroll": True, "custom": True}
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    events: Mapped[list["Event"]] = relationship(back_populates="site", cascade="all, delete-orphan")


class Event(Base):
    """A single tracked interaction: pageview, click, scroll, or custom event."""

    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    site_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), index=True)

    event_type: Mapped[str] = mapped_column(String, index=True)  # pageview | click | scroll | custom
    name: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. "signup_button", custom event name

    # Anonymous, rotates daily — no cross-site tracking, no PII.
    visitor_id: Mapped[str] = mapped_column(String, index=True)
    session_id: Mapped[str] = mapped_column(String, index=True)

    url: Mapped[str] = mapped_column(String)
    referrer: Mapped[str | None] = mapped_column(String, nullable=True)

    # Flexible bag for event-specific data: selector/text for clicks,
    # depth percentage for scrolls, arbitrary props for custom events.
    properties: Mapped[dict] = mapped_column(JSONB, default=dict)

    device_type: Mapped[str | None] = mapped_column(String, nullable=True)  # desktop | mobile | tablet
    browser: Mapped[str | None] = mapped_column(String, nullable=True)
    country: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    site: Mapped["Site"] = relationship(back_populates="events")

    __table_args__ = (
        Index("ix_events_site_type_created", "site_id", "event_type", "created_at"),
    )

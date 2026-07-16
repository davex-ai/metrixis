"""Run once to create all tables: python init_db.py"""
import asyncio

from app.core.db import Base, engine
from app.models import models  # noqa: F401 — ensures models are registered on Base


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created.")


if __name__ == "__main__":
    asyncio.run(main())

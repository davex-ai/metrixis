from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import analytics, ingest, sites

app = FastAPI(title="Metrixis API", version="1.0.0")

# Dashboard routes (sites, analytics) live on the main app and are
# restricted to our own frontend origin, with credentials allowed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(sites.router)
app.include_router(analytics.router)

# /ingest is called from arbitrary customer websites embedding the tracker
# snippet, so it needs an open CORS policy. Starlette applies CORSMiddleware
# per-app, not per-route, so ingestion is mounted as its own sub-app with
# its own (permissive, credential-less) policy.
ingest_app = FastAPI()
ingest_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)
ingest_app.include_router(ingest.router)
app.mount("/api", ingest_app)


@app.get("/health")
async def health():
    return {"ok": True}

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from contextlib import asynccontextmanager
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
import sys
import asyncio
from dotenv import load_dotenv
import logging
import uuid

# Ensure compatible event loop policy on Windows for subprocess/greenlet in threadpool
if sys.platform.startswith("win"):
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass

from .scrapers import parser as indeed_parser_module
from .routers.keywords import router as keywords_router
from .routers.indeed import router as indeed_router
from .routers.dayforce import router as dayforce_router
from .routers.automation import router as automation_router
from .services.keywords import KeywordsService
from .services.indeed import IndeedService
from .services.dayforce import DayforceService
from .services.automation import AutomationService


# Load environment variables from .env at startup
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Minimal startup: prepare helpers; Chrome is managed externally.
    app.state.seen_request_ids = set()
    app.state.indeed_parser_module = indeed_parser_module
    app.state.keywords_service = KeywordsService()
    app.state.search_service = IndeedService()
    app.state.dayforce_service = DayforceService()
    app.state.automation_service = AutomationService(
        dayforce_service=app.state.dayforce_service,
        keywords_service=app.state.keywords_service,
        indeed_service=app.state.search_service,
    )
    try:
        yield
    finally:
        # No teardown needed; we connect to an already running Chrome via CDP per-request.
        pass


app = FastAPI(title="Indeed Scraper API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Basic logging configuration (let Uvicorn manage handlers; just set our logger level)
logger = logging.getLogger("app")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)
logger.setLevel(logging.INFO)


@app.middleware("http")
async def error_logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    try:
        response = await call_next(request)
        if response.status_code >= 500:
            logger.error(
                "%s %s -> %s (request_id=%s, client=%s)",
                request.method,
                str(request.url),
                response.status_code,
                request_id,
                request.client.host if request.client else "-",
            )
        response.headers["x-request-id"] = request_id
        return response
    except Exception as exc:
        logger.exception(
            "Unhandled error for %s %s (request_id=%s, client=%s): %s",
            request.method,
            str(request.url),
            request_id,
            request.client.host if request.client else "-",
            exc,
        )
        # Re-raise so default handlers produce a 500; header added by Starlette later is fine
        raise

# Routers
app.include_router(keywords_router)
app.include_router(indeed_router)
app.include_router(dayforce_router)
app.include_router(automation_router)


@app.get("/", include_in_schema=False)
def read_root():
    return RedirectResponse(url="/docs")


@app.get("/health")
def health_check():
    return {"status": "ok"}



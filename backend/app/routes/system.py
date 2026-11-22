from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.container import Container, get_container

router = APIRouter(prefix="/api", tags=["System"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/system/info", summary="Storage location, record counts and configuration")
def system_info(c: Container = Depends(get_container)):
    return {
        "app_name": c.settings.app_name,
        "version": c.settings.version,
        "data_dir": str(c.data_dir.resolve()),
        "expiry_warning_days": c.settings.expiry_warning_days,
        "counts": {
            "members": c.members_repo.count(),
            "plans": c.plans_repo.count(),
            "payments": c.payments_repo.count(),
        },
    }


@router.get("/system/export", summary="Download all records as one JSON file")
def export_data(c: Container = Depends(get_container)):
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    body = {
        "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "members": c.members_repo.list_all(),
        "memberships": c.plans_repo.list_all(),
        "payments": c.payments_repo.list_all(),
    }
    return JSONResponse(
        body,
        headers={"Content-Disposition": f'attachment; filename="gym-export-{stamp}.json"'},
    )

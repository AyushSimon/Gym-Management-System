import os
import tempfile
from datetime import date

# Configure the app before it is imported so tests can never touch the real data files.
_TEST_DIR = tempfile.mkdtemp(prefix="gym-tests-")
os.environ["GYM_DATA_DIR"] = _TEST_DIR
os.environ["GYM_SEED_DEMO_DATA"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.container import Container, get_container  # noqa: E402
from app.main import app  # noqa: E402

TODAY = date(2026, 6, 15)


@pytest.fixture()
def container(tmp_path):
    return Container(tmp_path, get_settings(), clock=lambda: TODAY)


@pytest.fixture()
def client(container):
    app.dependency_overrides[get_container] = lambda: container
    # No context manager: the startup seeding hook is intentionally not run in tests.
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def plan(client):
    res = client.post(
        "/api/memberships",
        json={"name": "Quarterly", "duration_days": 90, "price": 4000, "description": "3 months"},
    )
    assert res.status_code == 201
    return res.json()


@pytest.fixture()
def member(client, plan):
    res = client.post(
        "/api/members",
        json={
            "full_name": "Aarav Sharma",
            "age": 27,
            "phone": "98765 43210",
            "plan_id": plan["id"],
            "start_date": "2026-06-01",
            "payment_status": "paid",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()

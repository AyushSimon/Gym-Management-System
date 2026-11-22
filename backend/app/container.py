"""Dependency container: wires repositories and services to a data directory and a clock."""
from __future__ import annotations

from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Callable

from app.config import Settings, get_settings
from app.repositories.member_repository import MemberRepository
from app.repositories.membership_repository import MembershipRepository
from app.repositories.payment_repository import PaymentRepository
from app.services.dashboard_service import DashboardService
from app.services.member_service import MemberService
from app.services.membership_service import MembershipService
from app.services.payment_service import PaymentService


class Container:
    def __init__(
        self,
        data_dir: Path | str,
        settings: Settings | None = None,
        clock: Callable[[], date] = date.today,
    ):
        self.settings = settings or get_settings()
        self.data_dir = Path(data_dir)
        self.clock = clock

        self.members_repo = MemberRepository(self.data_dir / "members.json")
        self.plans_repo = MembershipRepository(self.data_dir / "memberships.json")
        self.payments_repo = PaymentRepository(self.data_dir / "payments.json")

        self.members = MemberService(
            self.members_repo, self.plans_repo, self.payments_repo, self.clock,
            self.settings.expiry_warning_days,
        )
        self.plans = MembershipService(self.plans_repo, self.members_repo)
        self.payments = PaymentService(self.payments_repo, self.members_repo, self.clock)
        self.dashboard = DashboardService(
            self.members, self.plans_repo, self.payments_repo, self.clock,
            self.settings.expiry_warning_days,
        )


@lru_cache
def _default_container() -> Container:
    settings = get_settings()
    return Container(settings.data_dir, settings)


def get_container() -> Container:
    """FastAPI dependency. Tests override this to use an isolated temporary directory."""
    return _default_container()

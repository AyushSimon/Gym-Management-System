"""Input normalisation and date rules shared across services."""
from __future__ import annotations

import re
from datetime import date, timedelta

NAME_PATTERN = re.compile(r"^[A-Za-z][A-Za-z .'\-]*$")
PHONE_PATTERN = re.compile(r"^\+?\d{10,13}$")


def clean_text(value: str) -> str:
    """Trim and collapse internal whitespace."""
    return re.sub(r"\s+", " ", value).strip()


def validate_person_name(value: str) -> str:
    value = clean_text(value)
    if not NAME_PATTERN.match(value):
        raise ValueError("Name may contain only letters, spaces, apostrophes, periods and hyphens")
    return value


def normalise_phone(value: str) -> str:
    """Strip spaces, dashes and brackets, then require 10-13 digits (optional leading +)."""
    cleaned = re.sub(r"[\s\-()]", "", value)
    if not PHONE_PATTERN.match(cleaned):
        raise ValueError("Contact number must contain 10 to 13 digits (optional leading +)")
    return cleaned


# --------------------------------------------------------------------- dates
def compute_end_date(start: date, duration_days: int) -> date:
    """A membership is valid from ``start`` through ``end`` inclusive."""
    return start + timedelta(days=duration_days - 1)


def membership_status(start: date, end: date, today: date) -> str:
    if today < start:
        return "upcoming"
    if today > end:
        return "expired"
    return "active"


def days_remaining(end: date, today: date) -> int:
    """Days until the last valid day (0 means it expires today; negative means expired)."""
    return (end - today).days


def last_n_months(today: date, n: int) -> list[tuple[int, int]]:
    months: list[tuple[int, int]] = []
    for offset in range(n - 1, -1, -1):
        month = today.month - offset
        year = today.year
        while month <= 0:
            month += 12
            year -= 1
        months.append((year, month))
    return months


def month_end(year: int, month: int) -> date:
    if month == 12:
        return date(year, 12, 31)
    return date(year, month + 1, 1) - timedelta(days=1)

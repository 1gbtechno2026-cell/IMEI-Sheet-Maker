"""Role constants and permission maps for IMEI Data Maker."""

from __future__ import annotations

from enum import StrEnum


class Role(StrEnum):
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"
    OPERATOR = "OPERATOR"
    VIEWER = "VIEWER"


# Nav / feature gates mirrored in the frontend.
ROLE_PERMISSIONS: dict[str, set[str]] = {
    Role.ADMIN: {
        "dashboard",
        "onboarding",
        "invoicing",
        "history",
        "all_invoices",
        "settings",
        "users",
    },
    Role.MANAGER: {
        "dashboard",
        "onboarding",
        "invoicing",
        "history",
        "all_invoices",
    },
    Role.OPERATOR: {
        "dashboard",
        "invoicing",
        "history",
    },
    Role.VIEWER: {
        "dashboard",
        "history",
    },
}


def role_allowed(role: str, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, set())

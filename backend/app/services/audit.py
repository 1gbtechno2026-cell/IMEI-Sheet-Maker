"""Audit log helpers."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditLog, User


def write_audit(
    db: Session,
    *,
    user: User | None,
    action: str,
    entity: str,
    entity_id: str | int | None,
    before: Any = None,
    after: Any = None,
) -> AuditLog:
    row = AuditLog(
        user_id=user.id if user else None,
        action=action,
        entity=entity,
        entity_id=str(entity_id) if entity_id is not None else None,
        before_json=None if before is None else json.dumps(before, default=str),
        after_json=None if after is None else json.dumps(after, default=str),
    )
    db.add(row)
    db.flush()
    return row

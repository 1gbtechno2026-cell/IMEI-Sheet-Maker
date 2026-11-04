"""RBAC helpers for invoice edit / delete."""

from __future__ import annotations

from app.models import Invoice, User
from app.rbac import Role


def can_view_invoice(user: User, invoice: Invoice, *, all_scope: bool) -> bool:
    if invoice.is_deleted and user.role != Role.ADMIN:
        return False
    if all_scope or user.role in {Role.ADMIN, Role.MANAGER}:
        return True
    return invoice.created_by == user.id


def can_edit_invoice(user: User, invoice: Invoice) -> bool:
    if invoice.is_deleted:
        return False
    if user.role == Role.VIEWER:
        return False
    if user.role in {Role.ADMIN, Role.MANAGER}:
        return True
    if user.role == Role.OPERATOR:
        return invoice.created_by == user.id
    return False


def can_delete_invoice(user: User, _invoice: Invoice) -> bool:
    return user.role == Role.ADMIN

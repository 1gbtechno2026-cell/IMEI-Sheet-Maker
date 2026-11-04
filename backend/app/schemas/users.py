"""User management schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.auth import RoleName, UserOut


class CreateUserRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=200)
    role: RoleName


class UpdateUserRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    role: RoleName | None = None
    is_active: bool | None = None


class ResetPasswordRequest(BaseModel):
    new_password: str = Field(min_length=8, max_length=200)
    must_change_password: bool = True


class UserListOut(BaseModel):
    users: list[UserOut]

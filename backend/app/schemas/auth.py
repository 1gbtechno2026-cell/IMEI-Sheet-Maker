"""Auth request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

RoleName = Literal["ADMIN", "MANAGER", "OPERATOR", "VIEWER"]


class BootstrapStatus(BaseModel):
    needs_bootstrap: bool
    user_count: int


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=200)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=8, max_length=200)


class UserOut(BaseModel):
    id: int
    name: str
    username: str
    role: RoleName
    is_active: bool
    must_change_password: bool
    created_at: datetime
    permissions: list[str]

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class MessageOut(BaseModel):
    message: str

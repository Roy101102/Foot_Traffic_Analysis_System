import os
import smtplib
from email.message import EmailMessage
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field

from database.auth_repository import (
    admin_reset_user_password,
    authenticate_user,
    create_access_token,
    create_password_reset_token,
    create_refresh_session,
    create_user_account,
    decode_access_token,
    delete_user_account,
    get_user_by_id,
    list_audit_logs,
    list_users,
    reset_password_with_token,
    revoke_refresh_session,
    validate_refresh_session,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

ACCESS_COOKIE_NAME = "access_token"
REFRESH_COOKIE_NAME = "refresh_token"
ACCESS_TTL_SECONDS = 15 * 60                # 15 minutes
SESSION_REFRESH_TTL = 24 * 60 * 60          # 24 hours (when Remember me is unchecked)
REMEMBER_ME_REFRESH_TTL = 30 * 24 * 60 * 60 # 30 days (when Remember me is checked)

COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER or "noreply@store-analytics.local")


# ---------------------------------------------------------------------------
# Request Schemas
# ---------------------------------------------------------------------------

class LoginPayload(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)
    remember_me: bool = False


class ForgotPasswordPayload(BaseModel):
    email: str = Field(..., min_length=3)


class ResetPasswordPayload(BaseModel):
    token: str = Field(..., min_length=10)
    new_password: str = Field(..., min_length=8)


class AdminCreateUserPayload(BaseModel):
    name: str = Field(..., min_length=2)
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=8)
    role: str = Field(default="manager")


class AdminResetPasswordPayload(BaseModel):
    new_password: str = Field(..., min_length=8)


class AdminDeleteUserPayload(BaseModel):
    reason: str = Field(..., min_length=2)
    admin_password: str = Field(..., min_length=1)


# ---------------------------------------------------------------------------
# Cookie & Email Helpers
# ---------------------------------------------------------------------------

def _set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    remember_me: bool,
) -> None:
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=ACCESS_TTL_SECONDS,
        path="/",
    )
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=REMEMBER_ME_REFRESH_TTL if remember_me else None,
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(key=ACCESS_COOKIE_NAME, path="/")
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/")


def _send_reset_email(to_email: str, reset_link: str) -> None:
    if not SMTP_HOST:
        print(f"\n[DEV PASSWORD RESET] Email: {to_email} -> Link: {reset_link}\n")
        return

    msg = EmailMessage()
    msg["Subject"] = "Reset Your Password - Foot Traffic Analytics"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg.set_content(
        f"We received a request to reset your password.\n\n"
        f"Use the link below within 15 minutes:\n{reset_link}\n\n"
        f"If you did not request this reset, ignore this message."
    )

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
        server.starttls()
        if SMTP_USER and SMTP_PASSWORD:
            server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)


# ---------------------------------------------------------------------------
# Reusable Auth Dependency for Protected Routes
# ---------------------------------------------------------------------------

def get_current_user(
    response: Response,
    access_token: Optional[str] = Cookie(default=None, alias=ACCESS_COOKIE_NAME),
    refresh_token: Optional[str] = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
) -> Dict[str, Any]:
    if access_token:
        payload = decode_access_token(access_token)
        if payload and "sub" in payload:
            user = get_user_by_id(int(payload["sub"]))
            if user and user["is_active"]:
                return {
                    "id": user["id"],
                    "name": user["name"],
                    "email": user["email"],
                    "role": user["role"],
                }

    if refresh_token:
        user = validate_refresh_session(refresh_token)
        if user:
            new_access = create_access_token(
                user_id=user["id"], role=user["role"], ttl_seconds=ACCESS_TTL_SECONDS
            )
            response.set_cookie(
                key=ACCESS_COOKIE_NAME,
                value=new_access,
                httponly=True,
                secure=COOKIE_SECURE,
                samesite=COOKIE_SAMESITE,
                max_age=ACCESS_TTL_SECONDS,
                path="/",
            )
            return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
    )


def require_roles(allowed_roles: List[str]):
    def _dependency(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _dependency


# ---------------------------------------------------------------------------
# Auth Endpoints
# ---------------------------------------------------------------------------

@router.post("/login")
def login(body: LoginPayload, response: Response):
    user = authenticate_user(body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    refresh_ttl = REMEMBER_ME_REFRESH_TTL if body.remember_me else SESSION_REFRESH_TTL
    access_token = create_access_token(
        user_id=user["id"], role=user["role"], ttl_seconds=ACCESS_TTL_SECONDS
    )
    refresh_token = create_refresh_session(user_id=user["id"], ttl_seconds=refresh_ttl)

    _set_auth_cookies(
        response=response,
        access_token=access_token,
        refresh_token=refresh_token,
        remember_me=body.remember_me,
    )
    return user


@router.post("/logout")
def logout(
    response: Response,
    refresh_token: Optional[str] = Cookie(default=None, alias=REFRESH_COOKIE_NAME),
):
    if refresh_token:
        revoke_refresh_session(refresh_token)
    _clear_auth_cookies(response)
    return {"message": "Logged out successfully"}


@router.get("/me")
def me(current_user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "name": current_user["name"],
        "email": current_user["email"],
        "role": current_user["role"],
    }


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordPayload):
    raw_token = create_password_reset_token(body.email, ttl_minutes=15)
    if raw_token:
        reset_link = f"{FRONTEND_URL}/reset-password?token={raw_token}"
        _send_reset_email(body.email, reset_link)

    return {
        "message": "If that email exists in our system, a password reset link has been sent."
    }


@router.post("/reset-password")
def reset_password(body: ResetPasswordPayload):
    success = reset_password_with_token(body.token, body.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid, expired, or already used password reset token",
        )
    return {"message": "Password has been reset successfully"}


# ---------------------------------------------------------------------------
# Admin User & Password Management Endpoints
# ---------------------------------------------------------------------------

@router.get("/admin/users")
def admin_list_users(
    current_user: Dict[str, Any] = Depends(require_roles(["admin"])),
):
    return {
        "users": list_users(),
        "audit_logs": list_audit_logs(),
    }


@router.post("/admin/users", status_code=status.HTTP_201_CREATED)
def admin_create_user(
    body: AdminCreateUserPayload,
    current_user: Dict[str, Any] = Depends(require_roles(["admin"])),
):
    try:
        actor = f"{current_user['name']} ({current_user['email']})"
        created = create_user_account(
            name=body.name,
            email=body.email,
            password=body.password,
            role=body.role,
            added_by=actor,
        )
        return {
            "user": created,
            "users": list_users(),
            "audit_logs": list_audit_logs(),
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/admin/users/{user_id}/reset-password")
def admin_reset_password(
    user_id: int,
    body: AdminResetPasswordPayload,
    current_user: Dict[str, Any] = Depends(require_roles(["admin"])),
):
    actor = f"{current_user['name']} ({current_user['email']})"
    ok = admin_reset_user_password(
        user_id=user_id,
        new_password=body.new_password,
        performed_by=actor,
    )
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return {
        "message": "Password reset successfully",
        "audit_logs": list_audit_logs(),
    }


@router.delete("/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    body: AdminDeleteUserPayload,
    current_user: Dict[str, Any] = Depends(require_roles(["admin"])),
):
    if user_id == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot revoke your own active account",
        )

    # Verify the active admin's real password instead of a hardcoded PIN
    if not authenticate_user(current_user["email"], body.admin_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect admin password",
        )

    try:
        actor = f"{current_user['name']} ({current_user['email']})"
        ok = delete_user_account(
            user_id=user_id,
            performed_by=actor,
            reason=body.reason,
        )
        if not ok:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return {
            "users": list_users(),
            "audit_logs": list_audit_logs(),
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
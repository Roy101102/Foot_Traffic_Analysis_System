import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

DB_PATH = os.getenv("AUTH_DB_PATH", os.path.join("database", "foot_traffic.db"))
JWT_SECRET = os.getenv("JWT_SECRET", "replace-with-a-long-random-secret-in-env")


def _get_conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def _sha256_hex(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Password Hashing (PBKDF2-HMAC-SHA256)
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return f"pbkdf2_sha256$120000${base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algo, iter_str, salt_b64, hash_b64 = stored_hash.split("$")
        if algo != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64)
        expected_dk = base64.b64decode(hash_b64)
        actual_dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iter_str))
        return hmac.compare_digest(actual_dk, expected_dk)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Signed Access Token (HS256 JWT)
# ---------------------------------------------------------------------------

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_access_token(user_id: int, role: str, ttl_seconds: int = 900) -> str:
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + ttl_seconds,
    }
    h_enc = _b64url_encode(json.dumps(header, separators=(",", ":")).encode())
    p_enc = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{h_enc}.{p_enc}".encode("ascii")
    sig = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{h_enc}.{p_enc}.{_b64url_encode(sig)}"


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        h_enc, p_enc, s_enc = parts
        signing_input = f"{h_enc}.{p_enc}".encode("ascii")
        expected_sig = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
        actual_sig = _b64url_decode(s_enc)
        if not hmac.compare_digest(actual_sig, expected_sig):
            return None
        payload = json.loads(_b64url_decode(p_enc).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Database Schema & Initialization
# ---------------------------------------------------------------------------

def init_auth_tables() -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    with _get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin', 'manager', 'viewer')),
                is_active INTEGER NOT NULL DEFAULT 1,
                added_by TEXT NOT NULL DEFAULT 'System (Owner)',
                created_at TEXT NOT NULL
            )
            """
        )

        # Safe migration if users table already existed without added_by
        cols = [row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()]
        if "added_by" not in cols:
            conn.execute(
                "ALTER TABLE users ADD COLUMN added_by TEXT NOT NULL DEFAULT 'System (Owner)'"
            )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                used_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS refresh_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                revoked_at TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                target_user TEXT NOT NULL,
                performed_by TEXT NOT NULL,
                reason TEXT,
                timestamp TEXT NOT NULL
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_refresh_sessions_token ON refresh_sessions(token_hash)"
        )

        # Seed default accounts if users table is empty
        count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        if count == 0:
            conn.execute(
                """
                INSERT INTO users (name, email, password_hash, role, is_active, added_by, created_at)
                VALUES (?, ?, ?, ?, 1, 'System (Owner)', ?)
                """,
                ("System Admin", "admin@store.com", hash_password("Admin@1234"), "admin", now_iso),
            )
            conn.execute(
                """
                INSERT INTO users (name, email, password_hash, role, is_active, added_by, created_at)
                VALUES (?, ?, ?, ?, 1, 'System (Owner)', ?)
                """,
                ("Store Manager", "manager@store.com", hash_password("Manager@1234"), "manager", now_iso),
            )
            print("[AUTH] Seeded users: admin@store.com (Admin@1234) & manager@store.com (Manager@1234)")


# ---------------------------------------------------------------------------
# User & Credential Queries
# ---------------------------------------------------------------------------

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT id, name, email, password_hash, role, is_active, added_by, created_at FROM users WHERE LOWER(email) = LOWER(?)",
            (email.strip(),),
        ).fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT id, name, email, role, is_active, added_by, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        return dict(row) if row else None


def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    user = get_user_by_email(email)
    if not user or not user["is_active"]:
        return None
    if not verify_password(password, user["password_hash"]):
        return None
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
    }


def list_users() -> List[Dict[str, Any]]:
    with _get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, name, email, role, is_active, added_by, created_at
            FROM users
            ORDER BY id ASC
            """
        ).fetchall()
        return [dict(r) for r in rows]


def list_audit_logs(limit: int = 50) -> List[Dict[str, Any]]:
    with _get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, action, target_user, performed_by, reason, timestamp
            FROM admin_audit_logs
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


def create_user_account(
    name: str,
    email: str,
    password: str,
    role: str,
    added_by: str,
) -> Dict[str, Any]:
    clean_name = name.strip()
    clean_email = email.strip().lower()
    clean_role = role.strip().lower()

    if clean_role not in ("admin", "manager", "viewer"):
        raise ValueError("Invalid role specified")

    if get_user_by_email(clean_email):
        raise ValueError("An account with this email already exists")

    now_iso = datetime.now(timezone.utc).isoformat()
    pw_hash = hash_password(password)

    with _get_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO users (name, email, password_hash, role, is_active, added_by, created_at)
            VALUES (?, ?, ?, ?, 1, ?, ?)
            """,
            (clean_name, clean_email, pw_hash, clean_role, added_by, now_iso),
        )
        new_id = cursor.lastrowid
        conn.execute(
            """
            INSERT INTO admin_audit_logs (action, target_user, performed_by, reason, timestamp)
            VALUES ('ADDED', ?, ?, NULL, ?)
            """,
            (f"{clean_name} ({clean_email})", added_by, now_iso),
        )

    return {
        "id": new_id,
        "name": clean_name,
        "email": clean_email,
        "role": clean_role,
        "is_active": 1,
        "added_by": added_by,
        "created_at": now_iso,
    }


def admin_reset_user_password(user_id: int, new_password: str, performed_by: str) -> bool:
    target = get_user_by_id(user_id)
    if not target:
        return False

    now_iso = datetime.now(timezone.utc).isoformat()
    pw_hash = hash_password(new_password)

    with _get_conn() as conn:
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (pw_hash, user_id),
        )
        conn.execute(
            "UPDATE refresh_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
            (now_iso, user_id),
        )
        conn.execute(
            """
            INSERT INTO admin_audit_logs (action, target_user, performed_by, reason, timestamp)
            VALUES ('PASSWORD_RESET', ?, ?, 'Admin direct password reset', ?)
            """,
            (f"{target['name']} ({target['email']})", performed_by, now_iso),
        )
    return True


def delete_user_account(user_id: int, performed_by: str, reason: str) -> bool:
    target = get_user_by_id(user_id)
    if not target:
        return False

    with _get_conn() as conn:
        if target["role"] == "admin":
            admin_count = conn.execute(
                "SELECT COUNT(*) FROM users WHERE role = 'admin' AND is_active = 1"
            ).fetchone()[0]
            if admin_count <= 1:
                raise ValueError("Cannot remove the last remaining admin account")

        now_iso = datetime.now(timezone.utc).isoformat()
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.execute(
            """
            INSERT INTO admin_audit_logs (action, target_user, performed_by, reason, timestamp)
            VALUES ('DELETED', ?, ?, ?, ?)
            """,
            (f"{target['name']} ({target['email']})", performed_by, reason.strip(), now_iso),
        )
    return True


# ---------------------------------------------------------------------------
# Server-Side Refresh Sessions (for Logout & Revocation)
# ---------------------------------------------------------------------------

def create_refresh_session(user_id: int, ttl_seconds: int) -> str:
    raw_session_token = secrets.token_urlsafe(32)
    token_hash = _sha256_hex(raw_session_token)
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(seconds=ttl_seconds)).isoformat()

    with _get_conn() as conn:
        conn.execute(
            """
            INSERT INTO refresh_sessions (user_id, token_hash, expires_at, revoked_at, created_at)
            VALUES (?, ?, ?, NULL, ?)
            """,
            (user_id, token_hash, expires_at, now.isoformat()),
        )
    return raw_session_token


def validate_refresh_session(raw_session_token: str) -> Optional[Dict[str, Any]]:
    token_hash = _sha256_hex(raw_session_token)
    now = datetime.now(timezone.utc)

    with _get_conn() as conn:
        row = conn.execute(
            """
            SELECT rs.id AS session_id, rs.user_id, rs.expires_at, rs.revoked_at,
                   u.id, u.name, u.email, u.role, u.is_active
            FROM refresh_sessions rs
            JOIN users u ON u.id = rs.user_id
            WHERE rs.token_hash = ?
            """,
            (token_hash,),
        ).fetchone()

    if not row or row["revoked_at"] is not None or not row["is_active"]:
        return None

    if datetime.fromisoformat(row["expires_at"]) < now:
        return None

    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
    }


def revoke_refresh_session(raw_session_token: str) -> None:
    token_hash = _sha256_hex(raw_session_token)
    now_iso = datetime.now(timezone.utc).isoformat()
    with _get_conn() as conn:
        conn.execute(
            "UPDATE refresh_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
            (now_iso, token_hash),
        )


def revoke_all_user_sessions(user_id: int) -> None:
    now_iso = datetime.now(timezone.utc).isoformat()
    with _get_conn() as conn:
        conn.execute(
            "UPDATE refresh_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
            (now_iso, user_id),
        )


# ---------------------------------------------------------------------------
# Password Reset Tokens
# ---------------------------------------------------------------------------

def create_password_reset_token(email: str, ttl_minutes: int = 15) -> Optional[str]:
    user = get_user_by_email(email)
    if not user or not user["is_active"]:
        return None

    raw_token = secrets.token_urlsafe(32)
    token_hash = _sha256_hex(raw_token)
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(minutes=ttl_minutes)).isoformat()

    with _get_conn() as conn:
        conn.execute(
            "UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL",
            (now.isoformat(), user["id"]),
        )
        conn.execute(
            """
            INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used_at)
            VALUES (?, ?, ?, NULL)
            """,
            (user["id"], token_hash, expires_at),
        )

    return raw_token


def reset_password_with_token(raw_token: str, new_password: str) -> bool:
    token_hash = _sha256_hex(raw_token)
    now = datetime.now(timezone.utc)

    with _get_conn() as conn:
        row = conn.execute(
            """
            SELECT prt.id AS token_id, prt.user_id, prt.expires_at, prt.used_at, u.is_active
            FROM password_reset_tokens prt
            JOIN users u ON u.id = prt.user_id
            WHERE prt.token_hash = ?
            """,
            (token_hash,),
        ).fetchone()

        if not row or row["used_at"] is not None or not row["is_active"]:
            return False

        if datetime.fromisoformat(row["expires_at"]) < now:
            return False

        now_iso = now.isoformat()
        conn.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (hash_password(new_password), row["user_id"]),
        )
        conn.execute(
            "UPDATE password_reset_tokens SET used_at = ? WHERE id = ?",
            (now_iso, row["token_id"]),
        )
        conn.execute(
            "UPDATE refresh_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
            (now_iso, row["user_id"]),
        )

    return True
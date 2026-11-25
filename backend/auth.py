"""
Microsoft Entra ID (Azure AD) JWT validation for FastAPI.

Validates the Bearer token sent by the React frontend against Microsoft's
public JWKS, checking signature, expiry, issuer and audience.

Configuration is read from environment variables (typically loaded from
/data/project_documents/stockbot/.env via load_dotenv() in api.py):

    AZURE_TENANT_ID   - Directory (tenant) ID
    AZURE_CLIENT_ID   - Application (client) ID of the SPA
    AZURE_AUDIENCE    - Optional. Expected `aud` claim. Defaults to AZURE_CLIENT_ID
                        (correct for ID tokens, and for access tokens when no
                        custom scope is exposed). Set to `api://<CLIENT_ID>` if
                        you exposed a custom scope on your App Registration.
"""

from __future__ import annotations

import os
import time
from typing import Optional

import httpx
from fastapi import Header, HTTPException, status
from jose import jwt
from jose.exceptions import JWTError, ExpiredSignatureError

DEFAULT_TENANT_ID = "6f3490a2-b3a6-4ce5-ad92-168d3089f968"
DEFAULT_CLIENT_ID = "e0f1d804-c8de-47e0-b0a8-5af76df1d1dd"


def _config() -> tuple[str, str, str]:
    tenant = os.getenv("AZURE_TENANT_ID") or DEFAULT_TENANT_ID
    client = os.getenv("AZURE_CLIENT_ID") or DEFAULT_CLIENT_ID
    audience = os.getenv("AZURE_AUDIENCE") or client
    return tenant, client, audience


_JWKS_CACHE: dict = {"keys": None, "fetched_at": 0.0, "tenant": None}
_JWKS_TTL_SECONDS = 3600


def _fetch_jwks(tenant: str) -> dict:
    now = time.time()
    if (
        _JWKS_CACHE["keys"]
        and _JWKS_CACHE["tenant"] == tenant
        and (now - _JWKS_CACHE["fetched_at"] < _JWKS_TTL_SECONDS)
    ):
        return _JWKS_CACHE["keys"]

    oidc_url = f"https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration"
    with httpx.Client(timeout=10.0) as client:
        oidc = client.get(oidc_url).json()
        jwks = client.get(oidc["jwks_uri"]).json()

    _JWKS_CACHE["keys"] = jwks
    _JWKS_CACHE["fetched_at"] = now
    _JWKS_CACHE["tenant"] = tenant
    return jwks


def _signing_key_for(token: str, tenant: str) -> dict:
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token missing kid header")

    jwks = _fetch_jwks(tenant)
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key

    # kid not found — JWKS may have rotated; force-refresh once.
    _JWKS_CACHE["fetched_at"] = 0.0
    jwks = _fetch_jwks(tenant)
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key

    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Signing key not found in JWKS")


def verify_microsoft_token(authorization: Optional[str] = Header(None)) -> dict:
    """FastAPI dependency: validate the Bearer JWT and return its claims."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ", 1)[1].strip()
    tenant, _client, audience = _config()
    allowed_issuers = {
        f"https://login.microsoftonline.com/{tenant}/v2.0",
        f"https://sts.windows.net/{tenant}/",
    }

    try:
        key = _signing_key_for(token, tenant)
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=audience,
            options={"verify_at_hash": False, "verify_iss": False},
        )
    except ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token expired")
    except JWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {e}")

    if claims.get("iss") not in allowed_issuers:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token issuer")

    return claims

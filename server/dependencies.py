import asyncio
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from convex import ConvexClient
import logging
from config import settings

log = logging.getLogger("rich")

security = HTTPBearer(auto_error=False)

async def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)):
    """FastAPI dependency to authenticate the request using the Convex JWT token."""
    if not credentials:
        log.warning("auth — missing Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization token missing",
        )
    
    token = credentials.credentials
    if not token:
        log.warning("auth — Bearer token is empty")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization token missing",
        )

    if not settings.CONVEX_URL:
        log.error("auth — CONVEX_URL settings is not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server misconfigured: Convex URL missing.",
        )

    try:
        # Initialize a Convex client pointing to our deployment
        client = ConvexClient(settings.CONVEX_URL)
        
        # Set the user's JWT token
        client.set_auth(token)
        
        # Call the getSessionUser query with a timeout
        try:
            session_data = await asyncio.wait_for(
                asyncio.to_thread(client.query, "auth:getSessionUser"),
                timeout=5.0
            )
        except asyncio.TimeoutError as e:
            log.error("auth — Convex query timed out")
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Authentication service is taking too long to respond",
            ) from e
        
        if not session_data or not session_data.get("user"):
            log.warning("auth — invalid token or no session found")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token or session expired",
            )
            
        # Return the validated user details
        return session_data["user"]
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"auth — error validating Convex session: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed due to an internal error",
        ) from e

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from convex import ConvexClient
import logging
from config import settings

log = logging.getLogger("rich")

security = HTTPBearer(auto_error=False)

def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security)):
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
        
        # Call the getSessionUser query
        session_data = client.query("auth:getSessionUser")
        
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
            detail=f"Authentication failed: {str(e)}",
        )

"""
FastAPI Middleware for request/response logging and timing.
Provides request tracking, performance monitoring, and audit trails.
"""

import time
import uuid
from typing import Callable
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from loguru import logger

from core.logging import get_logger, audit_log


class RequestTimingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log request timing and add correlation IDs.
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate correlation ID for request tracking
        correlation_id = str(uuid.uuid4())[:8]
        request.state.correlation_id = correlation_id
        
        # Record start time
        start_time = time.perf_counter()
        
        # Log incoming request
        logger.bind(
            correlation_id=correlation_id,
            method=request.method,
            path=request.url.path,
            client=request.client.host if request.client else "unknown"
        ).info(f"Request started: {request.method} {request.url.path}")
        
        # Process request
        try:
            response = await call_next(request)
            
            # Calculate duration
            duration_ms = (time.perf_counter() - start_time) * 1000
            
            # Log response
            log_level = "info"
            if response.status_code >= 500:
                log_level = "error"
            elif response.status_code >= 400:
                log_level = "warning"
            
            getattr(logger.bind(
                correlation_id=correlation_id,
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=round(duration_ms, 2)
            ), log_level)(
                f"Request completed: {request.method} {request.url.path} "
                f"[{response.status_code}] {duration_ms:.2f}ms"
            )
            
            # Add headers
            response.headers["X-Correlation-ID"] = correlation_id
            response.headers["X-Response-Time-Ms"] = str(round(duration_ms, 2))
            
            # Flag slow requests
            if duration_ms > 1000:
                logger.warning(
                    f"Slow request detected: {request.method} {request.url.path} "
                    f"took {duration_ms:.2f}ms"
                )
            
            return response
            
        except Exception as e:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.bind(
                correlation_id=correlation_id,
                method=request.method,
                path=request.url.path,
                error=str(e),
                duration_ms=round(duration_ms, 2)
            ).exception(f"Request failed: {request.method} {request.url.path}")
            raise


class AuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log audit trails for write operations.
    Tracks CREATE, UPDATE, DELETE operations for compliance.
    """
    
    # Paths that trigger audit logging
    AUDIT_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
    SENSITIVE_PATHS = [
        "/api/brands",
        "/api/orders",
        "/api/config",
        "/api/integrations",
        "/api/config-management",
    ]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Only audit write operations to sensitive paths
        should_audit = (
            request.method in self.AUDIT_METHODS and
            any(request.url.path.startswith(p) for p in self.SENSITIVE_PATHS)
        )
        
        if should_audit:
            # Determine audit type
            audit_type = {
                "POST": "CREATE",
                "PUT": "UPDATE",
                "PATCH": "UPDATE",
                "DELETE": "DELETE"
            }.get(request.method, "UNKNOWN")
            
            # Get user from request (placeholder - implement with auth)
            user = getattr(request.state, "user", None)
            if not user:
                user = request.headers.get("X-User-ID", "anonymous")
            
            # Log before request
            correlation_id = getattr(request.state, "correlation_id", "unknown")
            
            response = await call_next(request)
            
            # Log audit entry after successful operation
            if response.status_code < 400:
                audit_log(
                    action=f"{audit_type} {request.url.path}",
                    user=user,
                    audit_type=audit_type,
                    method=request.method,
                    path=request.url.path,
                    status_code=response.status_code,
                    correlation_id=correlation_id
                )
            
            return response
        
        return await call_next(request)


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to catch and log unhandled exceptions.
    Provides consistent error responses.
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            return await call_next(request)
        except Exception as exc:
            correlation_id = getattr(request.state, "correlation_id", "unknown")
            
            logger.bind(
                correlation_id=correlation_id,
                path=request.url.path,
                method=request.method
            ).exception(f"Unhandled exception: {exc}")
            
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Internal server error",
                    "correlation_id": correlation_id,
                    "message": "An unexpected error occurred. Please try again."
                }
            )


def setup_middleware(app):
    """
    Add all middleware to the FastAPI app.
    Order matters - middleware is executed in reverse order.
    """
    from core.logging import configure_logging
    
    # Configure logging first
    configure_logging()
    
    # Add middleware (executed in reverse order)
    app.add_middleware(ErrorHandlingMiddleware)
    app.add_middleware(AuditMiddleware)
    app.add_middleware(RequestTimingMiddleware)
    
    logger.info("Middleware configured successfully")

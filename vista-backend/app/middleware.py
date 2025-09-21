"""
FastAPI Middleware for comprehensive request/response logging
"""
import time
import json
from typing import Callable
from fastapi import Request, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.logging_config import get_api_logger, get_performance_logger, get_security_logger
import asyncio
from starlette.types import Message


class RequestResponseLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all API requests and responses with timing"""
    
    def __init__(self, app, log_body: bool = False):
        super().__init__(app)
        self.log_body = log_body
        self.api_logger = get_api_logger()
        self.perf_logger = get_performance_logger()
        self.security_logger = get_security_logger()
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Start timing
        start_time = time.time()
        
        # Extract request info
        client_ip = self._get_client_ip(request)
        method = request.method
        url = str(request.url)
        headers = dict(request.headers)
        user_agent = headers.get('user-agent', 'Unknown')
        
        # Read request body if needed
        request_body = None
        if self.log_body and method in ['POST', 'PUT', 'PATCH']:
            try:
                body = await request.body()
                if body:
                    request_body = body.decode('utf-8')
            except Exception as e:
                request_body = f"Error reading body: {str(e)}"
        
        # Log request
        request_data = {
            'type': 'request',
            'method': method,
            'url': url,
            'client_ip': client_ip,
            'user_agent': user_agent,
            'headers': self._sanitize_headers(headers)
        }
        
        if request_body:
            request_data['body'] = self._sanitize_body(request_body)
        
        self.api_logger.info(f"API Request: {method} {url}", extra={'extra_data': request_data})
        
        # Security logging for suspicious patterns
        self._log_security_events(request, client_ip, user_agent)
        
        # Process request
        try:
            response = await call_next(request)
        except Exception as e:
            # Log unhandled exceptions
            error_data = {
                'type': 'error',
                'method': method,
                'url': url,
                'client_ip': client_ip,
                'error': str(e),
                'exception_type': type(e).__name__
            }
            self.api_logger.error(f"API Error: {method} {url} - {str(e)}", extra={'extra_data': error_data})
            raise
        
        # Calculate timing
        process_time = time.time() - start_time
        
        # Extract response info
        status_code = response.status_code
        response_headers = dict(response.headers)
        
        # Read response body if needed (careful with streaming responses)
        response_body = None
        if self.log_body and not isinstance(response, StreamingResponse):
            try:
                # This is tricky - we need to read the response without consuming it
                response_body = await self._get_response_body(response)
            except Exception as e:
                response_body = f"Error reading response body: {str(e)}"
        
        # Log response
        response_data = {
            'type': 'response',
            'method': method,
            'url': url,
            'client_ip': client_ip,
            'status_code': status_code,
            'process_time_ms': round(process_time * 1000, 2),
            'response_headers': self._sanitize_headers(response_headers)
        }
        
        if response_body:
            response_data['body'] = self._sanitize_body(response_body)
        
        # Choose log level based on status code
        if status_code >= 500:
            log_level = 'error'
        elif status_code >= 400:
            log_level = 'warning'
        else:
            log_level = 'info'
        
        getattr(self.api_logger, log_level)(
            f"API Response: {method} {url} - {status_code} ({process_time*1000:.2f}ms)",
            extra={'extra_data': response_data}
        )
        
        # Performance logging for slow requests
        if process_time > 1.0:  # Log requests taking more than 1 second
            perf_data = {
                'type': 'slow_request',
                'method': method,
                'url': url,
                'client_ip': client_ip,
                'process_time_ms': round(process_time * 1000, 2),
                'status_code': status_code
            }
            self.perf_logger.warning(
                f"Slow API Request: {method} {url} took {process_time:.2f}s",
                extra={'extra_data': perf_data}
            )
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP considering proxy headers"""
        forwarded_for = request.headers.get('X-Forwarded-For')
        if forwarded_for:
            return forwarded_for.split(',')[0].strip()
        
        real_ip = request.headers.get('X-Real-IP')
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else 'unknown'
    
    def _sanitize_headers(self, headers: dict) -> dict:
        """Remove sensitive information from headers"""
        sensitive_headers = {'authorization', 'cookie', 'x-api-key', 'x-auth-token'}
        sanitized = {}
        
        for key, value in headers.items():
            if key.lower() in sensitive_headers:
                sanitized[key] = '[REDACTED]'
            else:
                sanitized[key] = value
        
        return sanitized
    
    def _sanitize_body(self, body: str) -> str:
        """Sanitize request/response body to remove sensitive data"""
        try:
            # Try to parse as JSON and remove sensitive fields
            data = json.loads(body)
            if isinstance(data, dict):
                sensitive_fields = {'password', 'token', 'secret', 'key', 'auth'}
                for field in sensitive_fields:
                    if field in data:
                        data[field] = '[REDACTED]'
                return json.dumps(data)
        except (json.JSONDecodeError, TypeError):
            # Not JSON or other error, return as-is (truncated if too long)
            pass
        
        # Truncate if too long
        if len(body) > 1000:
            return body[:1000] + '... [TRUNCATED]'
        
        return body
    
    def _log_security_events(self, request: Request, client_ip: str, user_agent: str):
        """Log potential security issues"""
        url = str(request.url).lower()
        
        # Suspicious patterns
        suspicious_patterns = [
            'admin', 'login', 'passwd', 'shadow', 'etc/', 'proc/',
            '../', '..\\', 'select ', 'union ', 'drop ', 'insert ',
            '<script', 'javascript:', 'eval(', 'base64'
        ]
        
        if any(pattern in url for pattern in suspicious_patterns):
            security_data = {
                'type': 'suspicious_request',
                'client_ip': client_ip,
                'user_agent': user_agent,
                'url': str(request.url),
                'method': request.method
            }
            self.security_logger.warning(
                f"Suspicious request detected from {client_ip}",
                extra={'extra_data': security_data}
            )
    
    async def _get_response_body(self, response: Response) -> str:
        """Safely extract response body"""
        # This is complex because we need to avoid consuming the response
        # For now, we'll skip response body logging to avoid issues
        return None


class RequestSizeMiddleware(BaseHTTPMiddleware):
    """Middleware to limit request size and log large requests"""
    
    def __init__(self, app, max_size: int = 10 * 1024 * 1024):  # 10MB default
        super().__init__(app)
        self.max_size = max_size
        self.security_logger = get_security_logger()
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        content_length = request.headers.get('content-length')
        
        if content_length:
            size = int(content_length)
            if size > self.max_size:
                client_ip = request.client.host if request.client else 'unknown'
                security_data = {
                    'type': 'large_request',
                    'client_ip': client_ip,
                    'size_bytes': size,
                    'max_allowed': self.max_size,
                    'url': str(request.url)
                }
                self.security_logger.error(
                    f"Request too large: {size} bytes from {client_ip}",
                    extra={'extra_data': security_data}
                )
                
                from fastapi.responses import JSONResponse
                return JSONResponse(
                    status_code=413,
                    content={"error": "Request entity too large"}
                )
        
        return await call_next(request)

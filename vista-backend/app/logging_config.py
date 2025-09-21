"""
Comprehensive Logging Configuration for Vista IoT Backend
Provides structured logging with separate files for different application concerns
"""
import logging
import os
from logging.handlers import RotatingFileHandler
from datetime import datetime
import json
from typing import Dict, Any


class JsonFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging"""
    
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            'timestamp': datetime.fromtimestamp(record.created).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno
        }
        
        # Add exception info if present
        if record.exc_info:
            log_entry['exception'] = self.formatException(record.exc_info)
        
        # Add extra fields if present
        if hasattr(record, 'extra_data'):
            log_entry.update(record.extra_data)
            
        return json.dumps(log_entry, ensure_ascii=False)


class DetailedFormatter(logging.Formatter):
    """Detailed human-readable formatter"""
    
    def __init__(self):
        super().__init__(
            fmt='%(asctime)s | %(levelname)-8s | %(name)-25s | %(funcName)-20s:%(lineno)-4d | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )


class SimpleFormatter(logging.Formatter):
    """Simple formatter for console output"""
    
    def __init__(self):
        super().__init__(
            fmt='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
            datefmt='%H:%M:%S'
        )


class LoggingManager:
    """Central logging management class"""
    
    def __init__(self, base_dir: str = None):
        self.base_dir = base_dir or "/home/ach1lles/Projects/IOT-GATEWAY/frontend-dashboard/vista-backend/logs"
        self.loggers: Dict[str, logging.Logger] = {}
        self._ensure_log_directory()
        self._configure_root_logger()
        
    def _ensure_log_directory(self):
        """Create logs directory if it doesn't exist"""
        os.makedirs(self.base_dir, exist_ok=True)
        # Fix permissions if needed
        try:
            os.chmod(self.base_dir, 0o755)
        except PermissionError:
            pass  # Ignore if we can't change permissions
    
    def _configure_root_logger(self):
        """Configure the root logger"""
        logging.basicConfig(level=logging.WARNING, handlers=[])  # Remove default handlers
    
    def _create_file_handler(self, filename: str, level: int = logging.INFO, 
                           use_json: bool = False, max_bytes: int = 10*1024*1024, 
                           backup_count: int = 5) -> RotatingFileHandler:
        """Create a rotating file handler"""
        filepath = os.path.join(self.base_dir, filename)
        handler = RotatingFileHandler(
            filename=filepath,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding='utf-8'
        )
        handler.setLevel(level)
        
        if use_json:
            handler.setFormatter(JsonFormatter())
        else:
            handler.setFormatter(DetailedFormatter())
            
        return handler
    
    def _create_console_handler(self, level: int = logging.INFO) -> logging.StreamHandler:
        """Create a console handler"""
        handler = logging.StreamHandler()
        handler.setLevel(level)
        handler.setFormatter(SimpleFormatter())
        return handler
    
    def get_logger(self, category: str, console_level: int = logging.INFO, 
                   file_level: int = logging.DEBUG, use_json: bool = False) -> logging.Logger:
        """Get or create a logger for a specific category"""
        if category in self.loggers:
            return self.loggers[category]
        
        logger_name = f"vista.{category}"
        logger = logging.getLogger(logger_name)
        logger.setLevel(logging.DEBUG)  # Capture everything, handlers will filter
        
        # Clear any existing handlers
        logger.handlers.clear()
        
        # Add file handler
        file_handler = self._create_file_handler(
            f"{category}.log", 
            level=file_level, 
            use_json=use_json
        )
        logger.addHandler(file_handler)
        
        # Add console handler for important messages
        if console_level <= logging.CRITICAL:  # Only add if we want console output
            console_handler = self._create_console_handler(console_level)
            logger.addHandler(console_handler)
        
        # Prevent propagation to root logger
        logger.propagate = False
        
        self.loggers[category] = logger
        return logger
    
    def setup_all_loggers(self):
        """Setup all application loggers"""
        loggers_config = {
            'api': {'console_level': logging.INFO, 'file_level': logging.DEBUG, 'use_json': True},
            'polling': {'console_level': logging.INFO, 'file_level': logging.DEBUG, 'use_json': False},
            'system': {'console_level': logging.INFO, 'file_level': logging.INFO, 'use_json': False},
            'errors': {'console_level': logging.ERROR, 'file_level': logging.WARNING, 'use_json': True},
            'security': {'console_level': logging.WARNING, 'file_level': logging.INFO, 'use_json': True},
            'performance': {'console_level': logging.CRITICAL + 1, 'file_level': logging.INFO, 'use_json': True},  # No console output
        }
        
        for category, config in loggers_config.items():
            self.get_logger(category, **config)
        
        print(f"✅ Comprehensive logging system initialized:")
        print(f"   📁 Base directory: {self.base_dir}")
        for category in loggers_config.keys():
            print(f"   📊 {category.upper()} logger: {category}.log")
    
    def log_startup_info(self):
        """Log application startup information"""
        system_logger = self.get_logger('system')
        system_logger.info("="*60)
        system_logger.info("Vista IoT Backend Starting Up")
        system_logger.info("="*60)
        system_logger.info(f"Log directory: {self.base_dir}")
        system_logger.info(f"Startup time: {datetime.now().isoformat()}")
        system_logger.info("Logging system initialized successfully")


# Global logging manager instance
log_manager = LoggingManager()

# Convenience functions for getting loggers
def get_api_logger() -> logging.Logger:
    """Get the API logger"""
    return log_manager.get_logger('api')

def get_polling_logger() -> logging.Logger:
    """Get the polling logger"""
    return log_manager.get_logger('polling')

def get_system_logger() -> logging.Logger:
    """Get the system logger"""
    return log_manager.get_logger('system')

def get_error_logger() -> logging.Logger:
    """Get the error logger"""
    return log_manager.get_logger('errors')

def get_security_logger() -> logging.Logger:
    """Get the security logger"""
    return log_manager.get_logger('security')

def get_performance_logger() -> logging.Logger:
    """Get the performance logger"""
    return log_manager.get_logger('performance')

def log_error_with_context(logger: logging.Logger, message: str, **context):
    """Log an error with additional context"""
    try:
        # Also log to the dedicated error logger
        error_logger = get_error_logger()
        extra_data = {'original_logger': logger.name, **context}
        error_logger.error(message, extra={'extra_data': extra_data})
        
        # Log to the original logger as well
        logger.error(message)
    except Exception as e:
        # Fallback logging if something goes wrong
        print(f"Logging error: {e}")
        logger.error(message)

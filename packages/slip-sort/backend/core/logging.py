"""
Logging configuration using loguru.
Provides structured logging with rotation and compression.
"""

import sys
from pathlib import Path
from loguru import logger

# Create logs directory
LOGS_DIR = Path(__file__).parent.parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)


def configure_logging(
    log_level: str = "INFO",
    json_logs: bool = False,
    log_file: str = "slip_sort.log",
):
    """
    Configure loguru for the application.
    
    Args:
        log_level: Minimum log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_logs: Whether to output JSON format logs
        log_file: Name of the log file
    """
    # Remove default handler
    logger.remove()
    
    # Console handler with color
    log_format = (
        "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
        "<level>{message}</level>"
    )
    
    if json_logs:
        log_format = "{message}"
    
    logger.add(
        sys.stderr,
        format=log_format,
        level=log_level,
        colorize=True,
        backtrace=True,
        diagnose=True,
    )
    
    # File handler with rotation
    logger.add(
        LOGS_DIR / log_file,
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} | {message}",
        level=log_level,
        rotation="10 MB",  # Rotate when file reaches 10MB
        retention="30 days",  # Keep logs for 30 days
        compression="zip",  # Compress rotated logs
        backtrace=True,
        diagnose=True,
        enqueue=True,  # Thread-safe logging
    )
    
    # Separate error log
    logger.add(
        LOGS_DIR / "errors.log",
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} | {message}",
        level="ERROR",
        rotation="5 MB",
        retention="60 days",
        compression="zip",
        backtrace=True,
        diagnose=True,
        enqueue=True,
    )
    
    # Audit log for sensitive operations
    logger.add(
        LOGS_DIR / "audit.log",
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {extra[audit_type]} | {extra[user]} | {message}",
        level="INFO",
        rotation="50 MB",
        retention="365 days",
        compression="zip",
        filter=lambda record: record["extra"].get("audit", False),
        enqueue=True,
    )
    
    logger.info("Logging configured successfully")
    return logger


def get_logger(name: str = __name__):
    """
    Get a logger instance with the given name.
    
    Args:
        name: Logger name (typically __name__)
    
    Returns:
        Configured logger instance
    """
    return logger.bind(name=name)


def audit_log(
    action: str,
    user: str = "system",
    audit_type: str = "GENERAL",
    **extra_data
):
    """
    Write an audit log entry.
    
    Args:
        action: Description of the action taken
        user: Username or identifier
        audit_type: Type of audit (CREATE, UPDATE, DELETE, ACCESS, CONFIG)
        **extra_data: Additional context to include
    """
    logger.bind(
        audit=True,
        audit_type=audit_type,
        user=user,
        **extra_data
    ).info(action)


# Pre-configured loggers for different modules
class Loggers:
    """Pre-configured loggers for different application modules."""
    
    @staticmethod
    def api():
        return logger.bind(module="api")
    
    @staticmethod
    def database():
        return logger.bind(module="database")
    
    @staticmethod
    def pdf():
        return logger.bind(module="pdf_parser")
    
    @staticmethod
    def integration():
        return logger.bind(module="integration")
    
    @staticmethod
    def batch():
        return logger.bind(module="batch_processing")

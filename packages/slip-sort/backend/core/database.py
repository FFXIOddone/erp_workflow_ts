"""
Database session management and initialization.
Provides dependency injection for FastAPI endpoints.
"""

from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import Session as SQLAlchemySession
from sqlalchemy.orm import sessionmaker

from database.models import Base

# Global engine and session factory
_engine = None
_SessionLocal = None


def init_database(db_path: str = "packing_slip_manager.db"):
    """
    Initialize the database engine and create all tables.

    Args:
        db_path: Path to SQLite database file

    Returns:
        SQLAlchemy engine instance
    """
    global _engine, _SessionLocal

    database_url = f"sqlite:///{db_path}"
    _engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False},
        echo=False
    )

    # Create all tables
    Base.metadata.create_all(bind=_engine)

    # Create session factory
    _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)

    return _engine


def get_session_local():
    """Get the session factory. Must call init_database first."""
    if _SessionLocal is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    return _SessionLocal


def get_db() -> Generator[SQLAlchemySession, None, None]:
    """
    Dependency injection for database sessions.

    Usage:
        @app.get("/items")
        async def get_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[SQLAlchemySession, None, None]:
    """
    Context manager for database sessions (for non-FastAPI use).

    Usage:
        with get_db_context() as db:
            items = db.query(Item).all()
    """
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def Session():
    """
    Legacy compatibility - returns a new session.
    Prefer using get_db() with Depends() or get_db_context().
    """
    return get_session_local()()


def dispose_engine():
    """Cleanup database connections on shutdown."""
    global _engine
    if _engine:
        _engine.dispose()
        _engine = None

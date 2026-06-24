from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from . import config
from .migrations import run_migrations

engine = create_engine(config.DATABASE_URL, pool_pre_ping=True) if config.USE_DB else None
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False) if engine else None
Base = declarative_base()


def init_db():
    if engine is not None:
        Base.metadata.create_all(bind=engine)
        run_migrations(engine)


def get_session():
    if SessionLocal is None:
        raise RuntimeError("DATABASE_URL is not configured")
    return SessionLocal()
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
import os

DATABASE_URL = settings.DATABASE_URL

if DATABASE_URL.startswith("postgresql"):
    try:
        engine = create_async_engine(
            DATABASE_URL,
            echo=settings.DEBUG,
            future=True,
        )
    except Exception:
        SQLITE_URL = "sqlite+aiosqlite:///./heritage.db"
        engine = create_async_engine(
            SQLITE_URL,
            echo=settings.DEBUG,
            future=True,
        )
else:
    engine = create_async_engine(
        DATABASE_URL,
        echo=settings.DEBUG,
        future=True,
    )

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

DATABASE_URL = settings.DATABASE_URL

try:
    engine = create_async_engine(
        DATABASE_URL,
        echo=settings.DEBUG,
        future=True,
    )
    logger.info(f"数据库连接成功: {DATABASE_URL.split('://')[0]}")
except Exception as e:
    logger.error(f"数据库连接失败: {e}")
    raise

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
    #from app.models.entity import Entity
    from app.models.user import User
    import app.models.chat
    import app.models.knowledge
    import app.models.graph
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    from app.utils.init_sample_data import init_sample_data
    
    async with AsyncSessionLocal() as session:
        try:
            await init_sample_data(session)
            logger.info("示例数据初始化成功")
        except Exception as e:
            logger.warning(f"初始化示例数据失败: {e}")

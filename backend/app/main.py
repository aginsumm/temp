from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from app.core.config import settings
from app.core.database import init_db
from app.api.v1 import chat, knowledge, favorite, user  # 添加用户路由
from app.models import chat as chat_models
from app.models import knowledge as knowledge_models


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="智能问答与知识图谱检索后端服务",
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router, tags=["chat"])
app.include_router(knowledge.router, tags=["knowledge"])
app.include_router(favorite.router, tags=["favorites"])
app.include_router(user.router, prefix="/api/v1", tags=["user"])  # 注册用户路由


@app.get("/")
async def root():
    return {
        "message": f"{settings.APP_NAME} API 服务运行中",
        "version": settings.APP_VERSION,
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

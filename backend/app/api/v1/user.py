from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.user import UserCreate, UserResponse,UserLogin
from app.services.user_service import UserService
from app.models.user import User
from sqlalchemy import select
from app.core.auth import get_current_user, get_optional_user
import shutil
import uuid
import os

# 内部只保留模块名 user
router = APIRouter(prefix="/user", tags=["user"])

from sqlalchemy.exc import IntegrityError

@router.post("/register")
async def register_user(user: UserCreate, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.username == user.username)
    result = await db.execute(stmt)
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="用户名已存在")

    new_user = User(username=user.username, password=user.password)
    db.add(new_user)
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        # 判断是否为唯一约束冲突（根据数据库驱动错误信息）
        if "UNIQUE constraint" in str(e) or "Duplicate entry" in str(e):
            raise HTTPException(status_code=400, detail="用户名已存在")
        else:
            raise HTTPException(status_code=500, detail="注册失败，请稍后重试")
    await db.refresh(new_user)
    return new_user


import traceback # 请确保文件顶部引入了这个，用于打印详细错误

@router.post("/login")
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
        stmt = select(User).where(User.username == user_data.username)
        result = await db.execute(stmt)
        user = result.scalars().first()
        if not user:
            raise HTTPException(status_code=400, detail="用户不存在")
        if user.password != user_data.password:
            raise HTTPException(status_code=400, detail="密码错误")
        return {
            "message": "登录成功",
            "access_token": "mock-token-for-now", 
            "user": {
                "id": str(user.id),  
                "username": user.username,
                "avatar": getattr(user, 'avatar', None), 
                "is_active": getattr(user, 'is_active', True), 
            }
        }

@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...), 
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user) # 确保有这行来验证身份
):
    # 1. 校验是不是图片
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="只能上传图片文件")

    # 2. 生成一个唯一的文件名，防止用户上传同名文件覆盖别人
    file_ext = file.filename.split(".")[-1]
    new_filename = f"{user_id}_{uuid.uuid4().hex[:8]}.{file_ext}"
    file_path = f"static/avatars/{new_filename}"

    # 3. 把文件保存到服务器硬盘
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 4. 生成可访问的 URL
    # 注意：这里的地址要和 main.py 里挂载的路径对应
    avatar_url = f"http://localhost:8000/static/avatars/{new_filename}"

    # 5. 更新数据库里的用户信息 (假设你的 User 模型有 avatar 字段)
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()
    
    if user:
        user.avatar = avatar_url
        await db.commit()

    return {"message": "头像上传成功", "avatar_url": avatar_url}
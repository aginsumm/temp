from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.user import UserCreate, UserResponse,UserLogin
from app.services.user_service import UserService
# 根据你的项目目录结构，User 模型通常在 app.models.user 里
from app.models.user import User
from sqlalchemy import select

# 内部只保留模块名 user
router = APIRouter(prefix="/user", tags=["user"])

@router.post("/register")
async def register_user(user: UserCreate, db: AsyncSession = Depends(get_db)):
    # --- 错误写法：existing_user = db.query(User)... ---
    
    # --- 正确的异步写法 ---
    # 1. 先创建一个查询语句
    stmt = select(User).where(User.username == user.username)
    
    # 2. 异步执行查询
    result = await db.execute(stmt)
    
    # 3. 获取结果
    existing_user = result.scalars().first()

    if existing_user:
        raise HTTPException(status_code=400, detail="用户名已存在")

    # --- 插入数据也要用异步写法 ---
    new_user = User(
        username=user.username,
        # password=hash_password(user.password) # 记得给密码加密
    )
    db.add(new_user)
    await db.commit() # 异步提交
    await db.refresh(new_user) # 异步刷新
    
    return new_user

@router.post("/login")
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    # --- 1. 彻底删掉关于 fake_users_db 的代码 ---
    
    # --- 2. 使用真实的异步数据库查询 ---
    stmt = select(User).where(User.username == user_data.username)
    result = await db.execute(stmt)
    user = result.scalars().first()

    # --- 3. 逻辑校验 ---
    if not user:
        raise HTTPException(status_code=400, detail="用户不存在")
    
    # 假设你的校验函数叫 verify_password
    # if not verify_password(user_data.password, user.password):
    #     raise HTTPException(status_code=400, detail="密码错误")

    # --- 4. 返回前端需要的格式 ---
    # 注意：你前端代码里用了 data.user，所以这里必须包含 user 字段
    return {
        "message": "登录成功",
        "access_token": "mock-token-for-now", # 之后再换成真实的 JWT
        "user": {
            "id": user.id,
            "username": user.username,
            "identity": getattr(user, 'identity', 'user') # 兼容如果没有 identity 字段的情况
        }
    }
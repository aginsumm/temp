from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from datetime import datetime, timedelta
from app.core.config import settings

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        if not token:
            raise credentials_exception
            
        # ==========================================
        # 🚦 临时补丁：非正式 JWT 绿色通道
        # 如果 token 里没有 "."，说明它是我们临时发给前端的 user.id 或 mock 字符串
        if "." not in token:
            if token == "mock-token-for-now":
                return "1" # 如果前端还在用这个旧字符串，随便给个 ID 防止报错
            return token   # 如果前端传的是 user.id，直接放行
        # ==========================================
            
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
            
        return user_id
        
    except JWTError:
        raise credentials_exception


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[str]:
    if credentials is None or credentials.credentials is None:
        return None
        
    try:
        token = credentials.credentials
        
        # 🚦 同理，给可选用户也加个绿色通道
        if "." not in token:
            if token == "mock-token-for-now":
                return "1"
            return token
            
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        user_id: str = payload.get("sub")
        return user_id
        
    except JWTError:
        return None

def get_mock_user_id() -> str:
    return "default_user"
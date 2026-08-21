"""
JWT 认证与密码哈希

提供：
- 密码哈希/验证
- JWT Token 生成/解析
- get_current_user 依赖注入
- require_role 角色校验装饰器
"""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import joinedload

# === bcrypt 兼容性修复 ===
# passlib 1.7.4 与 bcrypt >= 4.1 不兼容，补丁 __about__ 属性
try:
    import bcrypt as _bcrypt
    if not hasattr(_bcrypt, "__about__"):
        import types
        _bcrypt.__about__ = types.SimpleNamespace(__version__=_bcrypt.__version__)
except Exception:
    pass

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, UserRole

# ==================== 配置 ====================

SECRET_KEY = "task-mgmt-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# ==================== 密码哈希 ====================

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """生成密码哈希"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain_password, hashed_password)


# ==================== JWT Token ====================

def create_access_token(user_id: int, username: str, role: str) -> str:
    """生成 JWT Token"""
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """解析 JWT Token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token 无效或已过期",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ==================== 依赖注入 ====================

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    从 JWT Token 获取当前用户

    所有需要鉴权的接口通过 Depends(get_current_user) 注入。
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未登录，请先登录",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token 格式错误")

    user = db.query(User).options(joinedload(User.member)).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账号已被禁用")

    return user


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """可选鉴权：有 Token 就解析，没有返回 None"""
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            return None
        return db.query(User).filter(User.id == int(user_id)).first()
    except HTTPException:
        return None


def require_role(*roles: UserRole):
    """
    角色校验依赖

    用法：
        @router.get("/admin-only")
        def admin_endpoint(user: User = Depends(require_role(UserRole.MANAGER))):
            ...
    """
    def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"权限不足：需要角色 {', '.join(r.value for r in roles)}，当前角色 {user.role.value}"
            )
        return user
    return role_checker

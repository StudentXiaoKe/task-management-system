"""
认证 API 路由

提供登录、注册、获取当前用户信息的接口。
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud, schemas
from app.auth import hash_password, verify_password, create_access_token, get_current_user
from app.models import User

router = APIRouter(prefix="/api/auth", tags=["认证"])


@router.post("/login", response_model=schemas.TokenResponse, summary="用户登录")
def login(data: schemas.UserLogin, db: Session = Depends(get_db)):
    """用户名密码登录，返回 JWT Token"""
    import os
    db_url = str(db.bind.url) if db.bind else "unknown"
    print(f"[LOGIN] === 收到登录请求 ===")
    print(f"[LOGIN] 数据库: {db_url}")
    print(f"[LOGIN] 收到 username='{data.username}', password='{data.password}'")

    try:
        user = crud.get_user_by_username(db, data.username)
    except Exception as e:
        print(f"[LOGIN] 数据库查询异常: {e}")
        raise HTTPException(status_code=500, detail=f"数据库错误: {e}")

    if not user:
        # 列出所有用户帮助排查
        all_users = crud.get_users(db)
        print(f"[LOGIN] 未找到用户 '{data.username}'")
        print(f"[LOGIN] 数据库中现有用户: {[u.username for u in all_users]}")
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    print(f"[LOGIN] 找到用户: id={user.id}, username='{user.username}', role={user.role.value}")

    ok = verify_password(data.password, user.password_hash)
    print(f"[LOGIN] 密码比对结果: {ok}")

    if not ok:
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="账号已被禁用")

    token = create_access_token(user.id, user.username, user.role.value)
    print(f"[LOGIN] 登录成功, token={token[:30]}...")
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": schemas.UserResponse.model_validate(user),
    }


@router.post("/register", response_model=schemas.UserResponse, summary="注册用户")
def register(data: schemas.UserCreate, db: Session = Depends(get_db)):
    """注册新用户（开发阶段开放，生产环境应限制）"""
    existing = crud.get_user_by_username(db, data.username)
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
    password_hash = hash_password(data.password)
    user = crud.create_user(db, data.username, password_hash, data.role, data.member_id)
    return user


@router.get("/me", response_model=schemas.UserResponse, summary="获取当前用户")
def get_me(user: User = Depends(get_current_user)):
    """获取当前登录用户信息"""
    return user


@router.get("/users", response_model=List[schemas.UserResponse], summary="获取所有用户")
def list_users(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """获取所有用户列表"""
    return crud.get_users(db)

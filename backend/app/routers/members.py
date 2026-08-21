"""
成员管理 API 路由（JWT 鉴权）
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud, schemas, models
from app.auth import get_current_user, require_role, hash_password
from app.models import User, UserRole

router = APIRouter(prefix="/api/members", tags=["成员管理"])

DEFAULT_PASSWORD = "Dev@123456"


def _member_to_dict(member: models.Member, db: Session) -> dict:
    """将 Member ORM 对象转为响应字典，并附带关联的 username 和系统角色"""
    linked_user = db.query(models.User).filter(models.User.member_id == member.id).first()
    return {
        "id": member.id,
        "name": member.name,
        "title": member.title,
        "initial_password": member.initial_password,
        "username": linked_user.username if linked_user else None,
        "system_role": linked_user.role.value if linked_user else None,
        "created_at": member.created_at.isoformat() if member.created_at else None,
    }


@router.get("/", summary="获取成员列表")
def list_members(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    members = crud.get_members(db)
    return [_member_to_dict(m, db) for m in members]


@router.post("/", summary="添加成员")
def create_member(
    data: schemas.MemberCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.MANAGER)),
):
    existing = db.query(models.Member).filter(models.Member.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="该成员姓名已存在")

    pwd = data.password or DEFAULT_PASSWORD

    # 创建 Member（含 title 和 initial_password）
    member_data = data.model_dump(exclude={"username", "password"})
    member_data["initial_password"] = pwd
    member = crud.create_member(db, schemas.MemberCreate(**data.model_dump()))
    # 手动补写 initial_password（因为 model_dump 已传入 data）
    member.initial_password = pwd
    member.title = data.title
    db.commit()
    db.refresh(member)

    # 如果传了 username，同步创建 User 账号
    if data.username:
        existing_user = crud.get_user_by_username(db, data.username)
        if existing_user:
            raise HTTPException(status_code=400, detail="该登录账号已被使用")
        crud.create_user(
            db,
            username=data.username,
            password_hash=hash_password(pwd),
            role="DEVELOPER",
            member_id=member.id,
        )

    return _member_to_dict(member, db)


@router.put("/{member_id}", summary="更新成员")
def update_member(
    member_id: int, data: schemas.MemberUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.MANAGER)),
):
    member = crud.update_member(db, member_id, data)
    if not member:
        raise HTTPException(status_code=404, detail="成员不存在")
    return _member_to_dict(member, db)


@router.delete("/{member_id}", summary="删除成员")
def delete_member(
    member_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.MANAGER)),
):
    if not crud.delete_member(db, member_id):
        raise HTTPException(status_code=404, detail="成员不存在")
    return {"message": "删除成功"}


@router.post("/{member_id}/reset-password", summary="重置成员密码")
def reset_member_password(
    member_id: int,
    data: schemas.ResetPasswordRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.MANAGER)),
):
    member = crud.get_member(db, member_id)
    if not member:
        raise HTTPException(status_code=404, detail="成员不存在")

    linked_user = db.query(models.User).filter(models.User.member_id == member_id).first()
    if not linked_user:
        raise HTTPException(status_code=400, detail="该成员暂无关联账号")

    new_pwd = data.new_password or DEFAULT_PASSWORD
    crud.update_user(db, linked_user.id, password_hash=hash_password(new_pwd))
    # 同步更新 initial_password 用于前端展示
    member.initial_password = new_pwd
    db.commit()
    return {"message": "密码重置成功", "username": linked_user.username}

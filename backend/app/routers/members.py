"""
团队成员管理 API 路由

提供成员的增删改查接口。
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud, schemas

router = APIRouter(prefix="/api/members", tags=["成员管理"])


@router.get("/", response_model=List[schemas.MemberResponse], summary="获取成员列表")
def list_members(db: Session = Depends(get_db)):
    """查询所有团队成员"""
    return crud.get_members(db)


@router.post("/", response_model=schemas.MemberResponse, summary="添加成员")
def create_member(data: schemas.MemberCreate, db: Session = Depends(get_db)):
    """添加新成员"""
    return crud.create_member(db, data)


@router.put("/{member_id}", response_model=schemas.MemberResponse, summary="更新成员")
def update_member(member_id: int, data: schemas.MemberUpdate, db: Session = Depends(get_db)):
    """更新成员信息"""
    member = crud.update_member(db, member_id, data)
    if not member:
        raise HTTPException(status_code=404, detail="成员不存在")
    return member


@router.delete("/{member_id}", summary="删除成员")
def delete_member(member_id: int, db: Session = Depends(get_db)):
    """删除成员"""
    success = crud.delete_member(db, member_id)
    if not success:
        raise HTTPException(status_code=404, detail="成员不存在")
    return {"message": "删除成功"}

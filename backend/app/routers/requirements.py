"""
需求管理 API 路由

提供需求的增删改查接口。
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud, schemas, models

router = APIRouter(prefix="/api/requirements", tags=["需求管理"])


@router.get("/", response_model=List[schemas.RequirementResponse], summary="获取需求列表")
def list_requirements(
    skip: int = Query(0, ge=0, description="跳过条数"),
    limit: int = Query(100, ge=1, le=500, description="返回条数"),
    status: Optional[models.RequirementStatus] = Query(None, description="按状态过滤"),
    version: Optional[str] = Query(None, description="按版本过滤"),
    db: Session = Depends(get_db),
):
    """查询需求列表，支持分页和过滤"""
    return crud.get_requirements(db, skip=skip, limit=limit, status=status, version=version)


@router.get("/{requirement_id}", response_model=schemas.RequirementResponse, summary="获取单条需求")
def get_requirement(requirement_id: int, db: Session = Depends(get_db)):
    """根据 ID 查询需求详情（含关联任务）"""
    req = crud.get_requirement(db, requirement_id)
    if not req:
        raise HTTPException(status_code=404, detail="需求不存在")
    return req


@router.post("/", response_model=schemas.RequirementResponse, summary="创建需求")
def create_requirement(data: schemas.RequirementCreate, db: Session = Depends(get_db)):
    """创建新需求"""
    return crud.create_requirement(db, data)


@router.put("/{requirement_id}", response_model=schemas.RequirementResponse, summary="更新需求")
def update_requirement(
    requirement_id: int, data: schemas.RequirementUpdate, db: Session = Depends(get_db)
):
    """更新需求信息"""
    req = crud.update_requirement(db, requirement_id, data)
    if not req:
        raise HTTPException(status_code=404, detail="需求不存在")
    return req


@router.delete("/{requirement_id}", summary="删除需求")
def delete_requirement(requirement_id: int, db: Session = Depends(get_db)):
    """删除需求（级联删除关联任务）"""
    success = crud.delete_requirement(db, requirement_id)
    if not success:
        raise HTTPException(status_code=404, detail="需求不存在")
    return {"message": "删除成功"}

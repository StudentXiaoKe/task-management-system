"""
需求管理 API 路由（JWT 鉴权）

所有接口需要登录。创建/编辑/删除按角色鉴权。
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud, schemas, models
from app.auth import get_current_user, require_role
from app.models import User, UserRole

router = APIRouter(prefix="/api/requirements", tags=["需求管理"])


@router.get("/", summary="获取需求列表（含树形任务）")
def list_requirements(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status: Optional[models.RequirementStatus] = Query(None),
    version: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """查询需求列表。所有角色可查看。"""
    reqs = crud.get_requirements(db, skip=skip, limit=limit, status=status, version=version)
    result = []
    for req in reqs:
        req_dict = {
            "id": req.id, "title": req.title, "description": req.description,
            "department": req.department, "doc_link": req.doc_link,
            "background": req.background, "acceptance_criteria": req.acceptance_criteria,
            "needs_data_extraction": req.needs_data_extraction,
            "data_connection_info": req.data_connection_info,
            "operation_steps": req.operation_steps,
            "operation_screenshots": req.operation_screenshots,
            "version": req.version, "status": req.status.value, "priority": req.priority.value,
            "req_type": req.req_type.value if req.req_type else "feature",
            "target_date": req.target_date.isoformat() if req.target_date else None,
            "reference_links": req.reference_links,
            "created_at": req.created_at.isoformat() if req.created_at else None,
            "updated_at": req.updated_at.isoformat() if req.updated_at else None,
            "tasks": crud.build_task_tree(req.tasks),
        }
        result.append(req_dict)
    return result


@router.get("/history", summary="历史需求（已完成/已归档，分页）")
def list_history_requirements(
    page: int = Query(1, ge=1, description="当前页码"),
    limit: int = Query(10, ge=1, le=50, description="每页条数"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """分页查询已完成或已归档的需求，供工作台历史需求 Tab 使用。"""
    return crud.get_history_requirements(db, page=page, limit=limit)


@router.get("/{requirement_id}", summary="获取单条需求（含树形任务）")
def get_requirement(
    requirement_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    req = crud.get_requirement(db, requirement_id)
    if not req:
        raise HTTPException(status_code=404, detail="需求不存在")
    return {
        "id": req.id, "title": req.title, "description": req.description,
        "department": req.department, "doc_link": req.doc_link,
        "background": req.background, "acceptance_criteria": req.acceptance_criteria,
        "needs_data_extraction": req.needs_data_extraction,
        "data_connection_info": req.data_connection_info,
        "operation_screenshots": req.operation_screenshots,
        "version": req.version, "status": req.status.value, "priority": req.priority.value,
        "req_type": req.req_type.value if req.req_type else "feature",
        "target_date": req.target_date.isoformat() if req.target_date else None,
        "reference_links": req.reference_links,
        "created_at": req.created_at.isoformat() if req.created_at else None,
        "updated_at": req.updated_at.isoformat() if req.updated_at else None,
        "tasks": crud.build_task_tree(req.tasks),
    }


@router.post("/", response_model=schemas.RequirementResponse, summary="创建需求")
def create_requirement(
    data: schemas.RequirementCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.CLIENT, UserRole.MANAGER)),
):
    """仅需求方和管理方可创建需求。"""
    return crud.create_requirement(db, data)


@router.put("/{requirement_id}", response_model=schemas.RequirementResponse, summary="更新需求")
def update_requirement(
    requirement_id: int,
    data: schemas.RequirementUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.CLIENT, UserRole.MANAGER)),
):
    """仅需求方和管理方可编辑需求。"""
    req = crud.update_requirement(db, requirement_id, data)
    if not req:
        raise HTTPException(status_code=404, detail="需求不存在")
    return req


@router.get("/{requirement_id}/delivery-report", summary="生成交付报告")
def get_delivery_report(
    requirement_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """为指定需求生成 Markdown 格式的交付报告"""
    md = crud.generate_delivery_report(db, requirement_id)
    if md is None:
        raise HTTPException(status_code=404, detail="需求不存在")
    return {"markdown": md}


@router.delete("/{requirement_id}", summary="删除需求")
def delete_requirement(
    requirement_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.MANAGER)),
):
    """仅管理方可删除需求。"""
    success = crud.delete_requirement(db, requirement_id)
    if not success:
        raise HTTPException(status_code=404, detail="需求不存在")
    return {"message": "删除成功"}

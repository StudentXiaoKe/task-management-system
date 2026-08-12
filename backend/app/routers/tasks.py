"""
任务管理 API 路由

提供任务的增删改查接口。
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud, schemas, models

router = APIRouter(prefix="/api/tasks", tags=["任务管理"])


@router.get("/", response_model=List[schemas.TaskResponse], summary="获取任务列表")
def list_tasks(
    skip: int = Query(0, ge=0, description="跳过条数"),
    limit: int = Query(100, ge=1, le=500, description="返回条数"),
    requirement_id: Optional[int] = Query(None, description="按需求ID过滤"),
    assignee: Optional[str] = Query(None, description="按负责人过滤"),
    status: Optional[models.TaskStatus] = Query(None, description="按状态过滤"),
    db: Session = Depends(get_db),
):
    """查询任务列表，支持按需求、负责人、状态过滤"""
    return crud.get_tasks(
        db, skip=skip, limit=limit, requirement_id=requirement_id, assignee=assignee, status=status
    )


@router.get("/{task_id}", response_model=schemas.TaskResponse, summary="获取单条任务")
def get_task(task_id: int, db: Session = Depends(get_db)):
    """根据 ID 查询任务详情"""
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.post("/", response_model=schemas.TaskResponse, summary="创建任务")
def create_task(data: schemas.TaskCreate, db: Session = Depends(get_db)):
    """创建新任务"""
    # 校验关联的需求是否存在
    req = crud.get_requirement(db, data.requirement_id)
    if not req:
        raise HTTPException(status_code=400, detail="关联的需求不存在")
    return crud.create_task(db, data)


@router.put("/{task_id}", response_model=schemas.TaskResponse, summary="更新任务")
def update_task(task_id: int, data: schemas.TaskUpdate, db: Session = Depends(get_db)):
    """更新任务信息（含状态流转）"""
    task = crud.update_task(db, task_id, data)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.delete("/{task_id}", summary="删除任务")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    """删除任务"""
    success = crud.delete_task(db, task_id)
    if not success:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"message": "删除成功"}


@router.put("/{task_id}/status", response_model=schemas.TaskResponse, summary="更新任务状态")
def update_task_status(
    task_id: int,
    new_status: models.TaskStatus = Query(..., description="新状态"),
    db: Session = Depends(get_db),
):
    """快速更新任务状态"""
    task = crud.update_task(db, task_id, schemas.TaskUpdate(status=new_status))
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task

"""
循环任务 API 路由

提供循环任务的模板管理和打卡接口。
支持 daily / weekly / biweekly / monthly 四种周期。
"""

from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud, schemas, models

router = APIRouter(prefix="/api/recurring-tasks", tags=["循环任务"])


@router.get("/", response_model=List[schemas.RecurringTaskResponse], summary="获取循环任务列表")
def list_tasks(
    active_only: bool = Query(False, description="仅返回启用的任务"),
    db: Session = Depends(get_db),
):
    return crud.get_recurring_tasks(db, active_only=active_only)


@router.post("/", response_model=schemas.RecurringTaskResponse, summary="创建循环任务")
def create_task(data: schemas.RecurringTaskCreate, db: Session = Depends(get_db)):
    return crud.create_recurring_task(db, title=data.title, cycle=data.cycle, assignee=data.assignee)


@router.put("/{task_id}", response_model=schemas.RecurringTaskResponse, summary="更新循环任务")
def update_task(task_id: int, data: schemas.RecurringTaskUpdate, db: Session = Depends(get_db)):
    task = crud.update_recurring_task(db, task_id, data)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.delete("/{task_id}", summary="删除循环任务")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    if not crud.delete_recurring_task(db, task_id):
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"message": "删除成功"}


@router.get("/checklist", response_model=List[schemas.ChecklistItem], summary="获取当期清单")
def get_checklist(
    date_str: Optional[str] = Query(None, alias="date", description="日期 YYYY-MM-DD，默认今天"),
    db: Session = Depends(get_db),
):
    """获取指定日期到期的循环任务清单"""
    target = None
    if date_str:
        try:
            target = date.fromisoformat(date_str)
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式错误，应为 YYYY-MM-DD")
    return crud.get_checklist(db, target_date=target)


@router.put("/checklist/{log_id}/toggle", summary="切换完成状态")
def toggle_log(log_id: int, db: Session = Depends(get_db)):
    log = crud.toggle_recurring_log(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="记录不存在")
    return {
        "id": log.id,
        "completed": log.completed,
        "completed_at": log.completed_at.isoformat() if log.completed_at else None,
    }


@router.get("/history", response_model=List[schemas.HistoryItem], summary="获取历史记录")
def get_history(
    days: int = Query(14, ge=1, le=30, description="查看最近几天"),
    db: Session = Depends(get_db),
):
    return crud.get_checklist_history(db, days=days)

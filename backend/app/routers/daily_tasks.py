"""
每日任务 API 路由

提供每日任务模板管理和打卡接口。
"""

from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud, schemas

router = APIRouter(prefix="/api/daily-tasks", tags=["每日任务"])


# ---- 模板管理 ----

@router.get("/templates", response_model=List[schemas.DailyTemplateResponse], summary="获取模板列表")
def list_templates(
    active_only: bool = Query(False, description="仅返回启用的模板"),
    db: Session = Depends(get_db),
):
    return crud.get_daily_templates(db, active_only=active_only)


@router.post("/templates", response_model=schemas.DailyTemplateResponse, summary="创建模板")
def create_template(data: schemas.DailyTemplateCreate, db: Session = Depends(get_db)):
    return crud.create_daily_template(db, title=data.title, assignee=data.assignee)


@router.put("/templates/{template_id}", response_model=schemas.DailyTemplateResponse, summary="更新模板")
def update_template(
    template_id: int,
    data: schemas.DailyTemplateUpdate,
    db: Session = Depends(get_db),
):
    tpl = crud.update_daily_template(
        db, template_id, title=data.title, assignee=data.assignee, is_active=data.is_active
    )
    if not tpl:
        raise HTTPException(status_code=404, detail="模板不存在")
    return tpl


@router.delete("/templates/{template_id}", summary="删除模板")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    if not crud.delete_daily_template(db, template_id):
        raise HTTPException(status_code=404, detail="模板不存在")
    return {"message": "删除成功"}


# ---- 每日清单 ----

@router.get("/checklist", response_model=List[schemas.DailyChecklistItem], summary="获取每日清单")
def get_checklist(
    date_str: Optional[str] = Query(None, alias="date", description="日期 YYYY-MM-DD，默认今天"),
    db: Session = Depends(get_db),
):
    target = None
    if date_str:
        try:
            target = date.fromisoformat(date_str)
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式错误，应为 YYYY-MM-DD")
    return crud.get_today_checklist(db, target_date=target)


@router.put("/checklist/{log_id}/toggle", summary="切换完成状态")
def toggle_task(log_id: int, db: Session = Depends(get_db)):
    log = crud.toggle_daily_task(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="记录不存在")
    return {
        "id": log.id,
        "completed": log.completed,
        "completed_at": log.completed_at.isoformat() if log.completed_at else None,
    }


@router.get("/history", response_model=List[schemas.DailyHistoryItem], summary="获取历史记录")
def get_history(
    days: int = Query(7, ge=1, le=30, description="查看最近几天"),
    db: Session = Depends(get_db),
):
    return crud.get_daily_history(db, days=days)

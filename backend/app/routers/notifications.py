"""
站内消息通知 API 路由

提供未读消息查询、标记已读等接口。
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud, models
from app.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/api/notifications", tags=["消息通知"])


@router.get("/unread", summary="获取未读消息")
def get_unread_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """返回当前用户的未读消息列表及总数"""
    items = (
        db.query(models.Notification)
        .filter(models.Notification.recipient_id == user.id, models.Notification.is_read == False)
        .order_by(models.Notification.created_at.desc())
        .all()
    )
    return {
        "total": len(items),
        "items": [
            {
                "id": n.id,
                "title": n.title,
                "content": n.content,
                "reference_task_id": n.reference_task_id,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in items
        ],
    }


@router.put("/{notification_id}/read", summary="标记消息已读")
def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """将指定消息标记为已读"""
    n = (
        db.query(models.Notification)
        .filter(models.Notification.id == notification_id, models.Notification.recipient_id == user.id)
        .first()
    )
    if not n:
        raise HTTPException(status_code=404, detail="消息不存在")
    n.is_read = True
    db.commit()
    return {"message": "ok"}

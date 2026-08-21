"""
对齐视图 API 路由

提供目标对齐全景树数据，供前端思维导图组件渲染。
所有已登录角色均可查看。
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud
from app.auth import get_current_user

router = APIRouter(prefix="/api/alignment", tags=["对齐视图"])


@router.get("/tree", summary="获取对齐全景树")
def get_alignment_tree(
    root_id: str = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """
    返回目标对齐树（需求 → 二级任务 → 三级任务）。
    若指定 root_id（如 "req_12"），则只返回该需求的独立子树。
    """
    requirement_id = None
    if root_id and root_id.startswith("req_"):
        try:
            requirement_id = int(root_id.split("_", 1)[1])
        except ValueError:
            pass
    return crud.build_alignment_tree(db, requirement_id=requirement_id)

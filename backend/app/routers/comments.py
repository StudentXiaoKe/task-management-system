"""
评论 API 路由
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app import crud, schemas

router = APIRouter(prefix="/api/comments", tags=["评论"])


@router.get("/", response_model=List[schemas.CommentResponse], summary="获取评论")
def list_comments(
    requirement_id: Optional[int] = Query(None),
    task_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    return crud.get_comments(db, requirement_id=requirement_id, task_id=task_id)


@router.post("/", response_model=schemas.CommentResponse, summary="添加评论")
def create_comment(data: schemas.CommentCreate, db: Session = Depends(get_db)):
    return crud.create_comment(db, data)


@router.delete("/{comment_id}", summary="删除评论")
def delete_comment(comment_id: int, db: Session = Depends(get_db)):
    if not crud.delete_comment(db, comment_id):
        raise HTTPException(status_code=404, detail="评论不存在")
    return {"message": "删除成功"}

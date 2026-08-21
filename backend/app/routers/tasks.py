"""
任务管理 API 路由（三级任务架构 + JWT 鉴权）

所有接口需要登录。创建/删除操作按角色鉴权。
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app import crud, schemas, models
from app.auth import get_current_user, require_role
from app.models import User, UserRole, TaskStatus

router = APIRouter(prefix="/api/tasks", tags=["任务管理"])


@router.get("/", response_model=List[schemas.TaskResponse], summary="获取任务列表")
def list_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    requirement_id: Optional[int] = Query(None),
    assignee: Optional[str] = Query(None),
    status: Optional[TaskStatus] = Query(None),
    level: Optional[int] = Query(None, ge=2, le=3),
    parent_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """查询任务列表。执行者只能看到自己被分配的二级任务及其子任务。"""
    if user.role == UserRole.DEVELOPER and user.member:
        if assignee is None and level == 2:
            assignee = user.member.name
    return crud.get_tasks(
        db, skip=skip, limit=limit,
        requirement_id=requirement_id, assignee=assignee,
        status=status, level=level, parent_id=parent_id,
    )


@router.get("/{task_id}", response_model=schemas.TaskResponse, summary="获取单条任务")
def get_task(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.get("/{task_id}/children", response_model=List[schemas.TaskResponse], summary="获取子任务")
def get_task_children(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return crud.get_task_children(db, task_id)


@router.get("/{task_id}/progress", summary="获取任务进度")
def get_task_progress(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return crud.get_task_progress(db, task_id)


# ==================== 创建任务（重写） ====================

@router.post("/", response_model=schemas.TaskResponse, summary="创建任务")
def create_task(
    data: schemas.TaskCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """创建任务。二级任务仅管理方可创建，三级任务由执行者创建并自动继承父任务责任人。"""

    # ── 通用校验 ──
    req = crud.get_requirement(db, data.requirement_id)
    if not req:
        raise HTTPException(status_code=400, detail="关联的需求不存在")

    # ── 二级任务：仅管理方可创建，不能有 parent_id ──
    if data.level == 2:
        if user.role != UserRole.MANAGER:
            raise HTTPException(status_code=403, detail="仅管理方可创建二级任务")
        if data.parent_id is not None:
            raise HTTPException(status_code=400, detail="二级任务不能有 parent_id")

    # ── 三级任务：完整重写 ──
    if data.level == 3:
        # 上帝模式：MANAGER 可以创建任何三级任务，无需验证责任人
        # 兼容 SQLAlchemy 返回枚举或字符串的情况
        is_manager = user.role == UserRole.MANAGER or str(user.role) == "MANAGER"
        if is_manager:
            # 管理员可以创建三级任务，但仍需验证 parent_id 合法性
            if not data.parent_id:
                raise HTTPException(status_code=400, detail="三级任务必须指定 parent_id")

            parent = crud.get_task(db, data.parent_id)
            if not parent:
                raise HTTPException(status_code=404, detail="父任务不存在")
            if parent.level != 2:
                raise HTTPException(status_code=400, detail="父任务必须是二级任务")

            # 管理员创建三级任务时，允许指定 assignee 或继承父任务的 assignee
            if not data.assignee:
                data.assignee = parent.assignee
            # 管理员创建三级任务时，允许指定 requirement_id 或继承父任务的
            if not data.requirement_id:
                data.requirement_id = parent.requirement_id
        else:
            # 普通 DEVELOPER 创建三级任务的原有逻辑
            # 1) 仅 DEVELOPER 可创建
            if user.role != UserRole.DEVELOPER:
                raise HTTPException(status_code=403, detail="仅执行者可创建三级任务")

            # 2) parent_id 必填且合法
            if not data.parent_id:
                raise HTTPException(status_code=400, detail="三级任务必须指定 parent_id")

            parent = crud.get_task(db, data.parent_id)
            if not parent:
                raise HTTPException(status_code=404, detail="父任务不存在")
            if parent.level != 2:
                raise HTTPException(status_code=400, detail="父任务必须是二级任务")

            # 3) 越权拦截：当前用户必须是该父任务的责任人
            if not user.member or user.member.name != parent.assignee:
                raise HTTPException(status_code=403, detail="只有父任务的责任人才能创建三级任务")

            # 4) 强制继承：assignee 和 requirement_id 均取自父任务，忽略前端传值
            data.assignee = parent.assignee
            data.requirement_id = parent.requirement_id

    return crud.create_task(db, data)


# ==================== 更新任务（重写） ====================

@router.put("/{task_id}", response_model=schemas.TaskResponse, summary="更新任务")
def update_task(
    task_id: int, data: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """更新任务。执行者只能更新自己的三级任务，且不可更改 assignee。"""
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    # 上帝模式：MANAGER 可以更新任何任务，无需验证责任人
    if user.role != UserRole.MANAGER:
        # 普通 DEVELOPER 的权限限制
        if user.role == UserRole.DEVELOPER:
            if task.level != 3:
                raise HTTPException(status_code=403, detail="执行者只能更新三级任务")
            if user.member and task.assignee != user.member.name:
                raise HTTPException(status_code=403, detail="只能更新自己被分配的任务")

    # 上帝模式：MANAGER 可以更新三级任务的 assignee
    if user.role == UserRole.MANAGER:
        # 管理员可以修改三级任务的 assignee，打破继承关系
        pass
    elif task.level == 3 and data.assignee is not None:
        # 普通用户（DEVELOPER）不能通过此接口更改 assignee
        raise HTTPException(status_code=400, detail="三级任务的负责人由父任务决定，不可直接修改")

    return crud.update_task(db, task_id, data)


# ==================== 删除任务 ====================

@router.delete("/{task_id}", summary="删除任务")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(UserRole.MANAGER, UserRole.DEVELOPER)),
):
    """删除任务。管理方可删任意任务，执行者只能删自己的三级任务。"""
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if user.role == UserRole.DEVELOPER:
        if task.level != 3:
            raise HTTPException(status_code=403, detail="执行者只能删除三级任务")
    success = crud.delete_task(db, task_id)
    if not success:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"message": "删除成功"}


# ==================== 更新任务状态（重写） ====================

@router.put("/{task_id}/status", response_model=schemas.TaskResponse, summary="更新任务状态")
def update_task_status(
    task_id: int,
    new_status: TaskStatus = Query(..., description="新状态"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """更新任务状态。三级任务无 review 状态，二级任务 done 仅管理方可操作。"""
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    # 三级任务不能设为 review
    if task.level == 3 and new_status == TaskStatus.REVIEW:
        raise HTTPException(status_code=400, detail="三级任务没有待验收环节")

    # 二级任务 done 仅管理方可操作
    if task.level == 2 and new_status == TaskStatus.DONE:
        if user.role != UserRole.MANAGER:
            raise HTTPException(status_code=403, detail="仅管理方可验收二级任务")

    # 执行者只能改自己任务的状态
    if user.role == UserRole.DEVELOPER:
        if task.level != 3:
            raise HTTPException(status_code=403, detail="执行者只能更新三级任务状态")
        if user.member and task.assignee != user.member.name:
            raise HTTPException(status_code=403, detail="只能更新自己被分配的任务")

    return crud.update_task(db, task_id, schemas.TaskUpdate(status=new_status))

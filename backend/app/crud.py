"""
CRUD 操作（数据库增删改查）

将所有数据库操作集中管理，保持路由层的简洁。
"""

from typing import List, Optional
from datetime import date, datetime
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case, literal
from app import models, schemas


# ==================== 用户 CRUD ====================

def get_user_by_username(db: Session, username: str) -> Optional[models.User]:
    """根据用户名查询用户"""
    return db.query(models.User).filter(models.User.username == username).first()


def get_user(db: Session, user_id: int) -> Optional[models.User]:
    """根据 ID 查询用户"""
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_users(db: Session) -> List[models.User]:
    """查询所有用户"""
    return db.query(models.User).order_by(models.User.id).all()


def create_user(db: Session, username: str, password_hash: str,
                role: str = "DEVELOPER", member_id: Optional[int] = None) -> models.User:
    """创建用户"""
    user = models.User(
        username=username,
        password_hash=password_hash,
        role=role,
        member_id=member_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user_id: int, **kwargs) -> Optional[models.User]:
    """更新用户"""
    user = get_user(db, user_id)
    if not user:
        return None
    for k, v in kwargs.items():
        if v is not None and hasattr(user, k):
            setattr(user, k, v)
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> bool:
    """删除用户"""
    user = get_user(db, user_id)
    if not user:
        return False
    db.delete(user)
    db.commit()
    return True


# ==================== 成员 CRUD ====================

def get_members(db: Session) -> List[models.Member]:
    """查询所有成员"""
    return db.query(models.Member).order_by(models.Member.id).all()


def get_member(db: Session, member_id: int) -> Optional[models.Member]:
    """根据 ID 查询单个成员"""
    return db.query(models.Member).filter(models.Member.id == member_id).first()


def create_member(db: Session, data: schemas.MemberCreate) -> models.Member:
    """创建新成员"""
    db_member = models.Member(**data.model_dump())
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member


def update_member(
    db: Session, member_id: int, data: schemas.MemberUpdate
) -> Optional[models.Member]:
    """更新成员信息，同步更新关联任务和循环任务的 assignee"""
    db_member = get_member(db, member_id)
    if not db_member:
        return None
    old_name = db_member.name
    update_data = data.model_dump(exclude_unset=True)
    new_name = update_data.get("name")
    for field, value in update_data.items():
        setattr(db_member, field, value)
    # 如果改了名字，同步更新所有引用旧名字的任务
    if new_name and new_name != old_name:
        db.query(models.Task).filter(models.Task.assignee == old_name).update({"assignee": new_name})
        db.query(models.RecurringTask).filter(models.RecurringTask.assignee == old_name).update({"assignee": new_name})
    db.commit()
    db.refresh(db_member)
    return db_member


def delete_member(db: Session, member_id: int) -> bool:
    """删除成员，清空关联任务的 assignee"""
    db_member = get_member(db, member_id)
    if not db_member:
        return False
    name = db_member.name
    db.query(models.Task).filter(models.Task.assignee == name).update({"assignee": None})
    db.query(models.RecurringTask).filter(models.RecurringTask.assignee == name).update({"assignee": None})
    db.delete(db_member)
    db.commit()
    return True


# ==================== 需求 CRUD ====================

def get_requirements(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: Optional[models.RequirementStatus] = None,
    version: Optional[str] = None,
) -> List[models.Requirement]:
    """查询需求列表，支持按状态和版本过滤，自动加载子任务"""
    query = db.query(models.Requirement).options(joinedload(models.Requirement.tasks))
    if status:
        query = query.filter(models.Requirement.status == status)
    if version:
        query = query.filter(models.Requirement.version == version)
    return query.order_by(models.Requirement.updated_at.desc()).offset(skip).limit(limit).all()


def get_requirement(db: Session, requirement_id: int) -> Optional[models.Requirement]:
    """根据 ID 查询单条需求"""
    return db.query(models.Requirement).filter(models.Requirement.id == requirement_id).first()


def create_requirement(db: Session, data: schemas.RequirementCreate) -> models.Requirement:
    """创建新需求"""
    db_req = models.Requirement(**data.model_dump())
    db.add(db_req)
    db.commit()
    db.refresh(db_req)
    return db_req


def update_requirement(
    db: Session, requirement_id: int, data: schemas.RequirementUpdate
) -> Optional[models.Requirement]:
    """更新需求（只更新非空字段）"""
    db_req = get_requirement(db, requirement_id)
    if not db_req:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_req, field, value)
    db.commit()
    db.refresh(db_req)
    return db_req


def delete_requirement(db: Session, requirement_id: int) -> bool:
    """删除需求（级联删除关联任务）"""
    db_req = get_requirement(db, requirement_id)
    if not db_req:
        return False
    db.delete(db_req)
    db.commit()
    return True


# ==================== 任务 CRUD ====================

def get_tasks(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    requirement_id: Optional[int] = None,
    assignee: Optional[str] = None,
    status: Optional[models.TaskStatus] = None,
    level: Optional[int] = None,
    parent_id: Optional[int] = None,
) -> List[models.Task]:
    """查询任务列表，支持按需求、负责人、状态、层级、父任务过滤"""
    query = db.query(models.Task)
    if requirement_id is not None:
        query = query.filter(models.Task.requirement_id == requirement_id)
    if assignee:
        query = query.filter(models.Task.assignee == assignee)
    if status:
        query = query.filter(models.Task.status == status)
    if level is not None:
        query = query.filter(models.Task.level == level)
    if parent_id is not None:
        query = query.filter(models.Task.parent_id == parent_id)
    return query.order_by(models.Task.level, models.Task.updated_at.desc()).offset(skip).limit(limit).all()


def get_task(db: Session, task_id: int) -> Optional[models.Task]:
    """根据 ID 查询单条任务"""
    return db.query(models.Task).filter(models.Task.id == task_id).first()


def create_task(db: Session, data: schemas.TaskCreate) -> models.Task:
    """
    创建新任务。
    三级任务强制从父任务继承 assignee 和 requirement_id（即使前端传了也会被覆盖）。
    创建后触发状态向上联动。
    """
    task_data = data.model_dump()

    if task_data.get("level") == 3 and task_data.get("parent_id"):
        parent = db.query(models.Task).filter(models.Task.id == task_data["parent_id"]).first()
        if parent:
            # 强制继承（不依赖路由层，双重保障）
            task_data["requirement_id"] = parent.requirement_id
            task_data["assignee"] = parent.assignee

    db_task = models.Task(**task_data)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)

    # 新建三级任务后触发向上联动
    if db_task.level == 3 and db_task.parent_id:
        _propagate_status_up(db, db_task)

    return db_task


def update_task(
    db: Session, task_id: int, data: schemas.TaskUpdate
) -> Optional[models.Task]:
    """更新任务（只更新非空字段），状态变更时触发向上联动"""
    db_task = get_task(db, task_id)
    if not db_task:
        return None
    update_data = data.model_dump(exclude_unset=True)
    old_status = db_task.status
    for field, value in update_data.items():
        setattr(db_task, field, value)
    db.commit()
    db.refresh(db_task)
    # 状态变更时触发向上联动
    if "status" in update_data and update_data["status"] != old_status:
        _propagate_status_up(db, db_task)
    return db_task


def _propagate_status_up(db: Session, task: models.Task):
    """
    状态向上联动（含回退机制）

    规则：
    - 所有三级 done（总数>0）→ 二级 → review（待验收）
    - 存在任何非 done 的三级 → 二级 → in_progress（含回退）
    - 二级全 done → 一级需求 → completed
    """
    if task.level == 3 and task.parent_id:
        parent = db.query(models.Task).filter(models.Task.id == task.parent_id).first()
        if not parent:
            return

        # 获取所有兄弟三级任务（含当前任务）
        siblings = db.query(models.Task).filter(
            models.Task.parent_id == parent.id,
        ).all()

        # 统一判定：全 done → review，否则 → in_progress
        all_done = len(siblings) > 0 and all(s.status == models.TaskStatus.DONE for s in siblings)

        if all_done:
            # 所有三级完成 → 父二级 → 待验收
            if parent.status != models.TaskStatus.REVIEW:
                parent.status = models.TaskStatus.REVIEW
                db.flush()
                print(f"[联动] 二级任务 #{parent.id}「{parent.title}」下所有三级任务已完成，状态 → review")
                # 向 MANAGER 推送待验收通知
                manager = db.query(models.User).filter(
                    models.User.role == models.UserRole.MANAGER,
                    models.User.is_active == True,
                ).first()
                if manager:
                    notif = models.Notification(
                        recipient_id=manager.id,
                        title="任务待验收提醒",
                        content=f"您指派的任务「{parent.title}」已由执行者全部完工，请及时验收。",
                        reference_task_id=parent.id,
                    )
                    db.add(notif)
                    db.flush()
                    print(f"[通知] 已通知 {manager.username}: 任务 #{parent.id} 待验收")
        else:
            # 存在非 done 的三级 → 父二级 → 进行中（含回退）
            if parent.status != models.TaskStatus.IN_PROGRESS:
                parent.status = models.TaskStatus.IN_PROGRESS
                db.flush()

        # 联动一级需求
        _sync_requirement_status(db, parent)

    elif task.level == 2:
        _sync_requirement_status(db, task)

    db.commit()


def _sync_requirement_status(db: Session, task: models.Task):
    """检查需求下所有二级任务，联动需求状态（含回退）"""
    req = task.requirement
    if not req:
        return
    l2_tasks = db.query(models.Task).filter(
        models.Task.requirement_id == req.id,
        models.Task.level == 2,
    ).all()
    if not l2_tasks:
        return

    all_done = all(t.status == models.TaskStatus.DONE for t in l2_tasks)
    has_review = any(t.status == models.TaskStatus.REVIEW for t in l2_tasks)
    has_in_progress = any(t.status == models.TaskStatus.IN_PROGRESS for t in l2_tasks)

    if all_done:
        # 所有二级完成 → 需求 completed
        req.status = models.RequirementStatus.COMPLETED
        print(f"[联动] 需求 #{req.id}「{req.title}」所有二级任务已完成，状态 → completed")
    elif has_review or has_in_progress:
        # 有进行中或待验收 → 需求 in_progress（可从 completed 回退）
        req.status = models.RequirementStatus.IN_PROGRESS
    elif all(t.status == models.TaskStatus.TODO for t in l2_tasks):
        # 全是待办 → 需求 planning
        req.status = models.RequirementStatus.PLANNING


def get_task_progress(db: Session, task_id: int) -> dict:
    """
    获取任务进度（从下级卷加）

    parent_id 已保证只查直接子任务，无需额外 level 过滤。
    """
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        return {"total": 0, "done": 0, "progress": 0}
    children = db.query(models.Task).filter(
        models.Task.parent_id == task_id,
    ).all()
    total = len(children)
    done = sum(1 for c in children if c.status == models.TaskStatus.DONE)
    progress = round((done / total * 100) if total > 0 else 0, 1)
    return {"total": total, "done": done, "progress": progress}


def get_task_children(db: Session, task_id: int) -> List[models.Task]:
    """获取某个任务的所有子任务"""
    return db.query(models.Task).filter(
        models.Task.parent_id == task_id
    ).order_by(models.Task.status, models.Task.created_at).all()


def build_task_tree(tasks: List[models.Task]) -> List[dict]:
    """
    将扁平任务列表组装成树形结构

    二级任务作为顶层节点，三级任务嵌套在二级任务的 children 中。
    """
    # 分离二级和三级任务
    l2 = [t for t in tasks if t.level == 2]
    l3 = [t for t in tasks if t.level == 3]

    # 建立 parent_id -> children 映射
    children_map: dict[int, list] = {}
    for t in l3:
        if t.parent_id:
            children_map.setdefault(t.parent_id, []).append({
                "id": t.id,
                "requirement_id": t.requirement_id,
                "parent_id": t.parent_id,
                "level": t.level,
                "title": t.title,
                "description": t.description,
                "task_type": t.task_type,
                "assignee": t.assignee,
                "status": t.status.value,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "estimated_hours": t.estimated_hours,
                "actual_hours": t.actual_hours,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "updated_at": t.updated_at.isoformat() if t.updated_at else None,
            })

    # 组装树
    result = []
    for t in l2:
        node = {
            "id": t.id,
            "requirement_id": t.requirement_id,
            "parent_id": None,
            "level": t.level,
            "title": t.title,
            "description": t.description,
            "task_type": t.task_type,
            "assignee": t.assignee,
            "status": t.status.value,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "estimated_hours": t.estimated_hours,
            "actual_hours": t.actual_hours,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "updated_at": t.updated_at.isoformat() if t.updated_at else None,
            "children": children_map.get(t.id, []),
        }
        result.append(node)

    return result


def build_alignment_tree(db: Session, requirement_id: int = None) -> dict:
    """
    构建对齐全景树：根节点 → 需求 → 二级任务 → 三级任务。
    若指定 requirement_id，只返回该需求的独立子树（无根节点包裹）。
    """
    if requirement_id:
        req = get_requirement(db, requirement_id)
        if not req:
            return {"id": "root", "name": "未找到需求", "node_type": "root",
                    "status": None, "assignee": None, "progress": None,
                    "total_tasks": 0, "done_tasks": 0, "children": []}
        requirements = [req]
    else:
        requirements = get_requirements(db, skip=0, limit=500)

    req_nodes = []
    for req in requirements:
        l2_tree = build_task_tree(req.tasks)  # 复用已有树构建逻辑

        # 二级任务节点 → 对齐树节点
        l2_nodes = []
        for t in l2_tree:
            children = t.get("children", [])
            total_l3 = len(children)
            done_l3 = sum(1 for c in children if c.get("status") == "done")
            progress_l3 = round(done_l3 / total_l3 * 100, 1) if total_l3 > 0 else None

            l3_nodes = [
                {
                    "id": f"task_{c['id']}",
                    "name": c["title"],
                    "node_type": "task_l3",
                    "status": c.get("status"),
                    "assignee": c.get("assignee"),
                    "progress": None,
                    "total_tasks": None,
                    "done_tasks": None,
                    "children": [],
                }
                for c in children
            ]

            l2_nodes.append({
                "id": f"task_{t['id']}",
                "name": t["title"],
                "node_type": "task_l2",
                "status": t.get("status"),
                "assignee": t.get("assignee"),
                "progress": progress_l3,
                "total_tasks": total_l3,
                "done_tasks": done_l3,
                "children": l3_nodes,
            })

        # 需求级进度（基于二级任务完成情况）
        total_l2 = len(l2_nodes)
        done_l2 = sum(1 for n in l2_nodes if n.get("status") == "done")
        progress_l2 = round(done_l2 / total_l2 * 100, 1) if total_l2 > 0 else None

        req_nodes.append({
            "id": f"req_{req.id}",
            "name": req.title,
            "node_type": "requirement",
            "status": req.status.value,
            "assignee": None,
            "progress": progress_l2,
            "total_tasks": total_l2,
            "done_tasks": done_l2,
            "children": l2_nodes,
        })

    # 合成根节点；若按需求聚焦则直接返回该需求节点（无 root 包裹）
    if requirement_id and req_nodes:
        return req_nodes[0]
    return {
        "id": "root",
        "name": "全部需求",
        "node_type": "root",
        "status": None,
        "assignee": None,
        "progress": None,
        "total_tasks": len(req_nodes),
        "done_tasks": sum(1 for r in req_nodes if r.get("status") == "completed"),
        "children": req_nodes,
    }


def delete_task(db: Session, task_id: int) -> bool:
    """删除任务，删除后触发父级状态重算"""
    db_task = get_task(db, task_id)
    if not db_task:
        return False
    parent_id = db_task.parent_id
    requirement_id = db_task.requirement_id
    level = db_task.level
    db.delete(db_task)
    db.commit()

    # 删除后重算父级状态
    if level == 3 and parent_id:
        parent = db.query(models.Task).filter(models.Task.id == parent_id).first()
        if parent:
            siblings = db.query(models.Task).filter(models.Task.parent_id == parent_id).all()
            if siblings:
                all_done = all(s.status == models.TaskStatus.DONE for s in siblings)
                if all_done:
                    # 全部完成 → 待验收（不是已完成）
                    parent.status = models.TaskStatus.REVIEW
                else:
                    # 存在非 done → 进行中
                    parent.status = models.TaskStatus.IN_PROGRESS
                db.commit()
                _sync_requirement_status(db, parent)
            else:
                # 无子任务 → 回到待办
                parent.status = models.TaskStatus.TODO
                db.commit()
                _sync_requirement_status(db, parent)

    elif level == 2:
        req = db.query(models.Requirement).filter(models.Requirement.id == requirement_id).first()
        if req:
            l2_tasks = db.query(models.Task).filter(
                models.Task.requirement_id == requirement_id,
                models.Task.level == 2,
            ).all()
            if l2_tasks:
                _sync_requirement_status(db, l2_tasks[0])
            else:
                req.status = models.RequirementStatus.PLANNING
                db.commit()

    return True


# ==================== Dashboard 统计 ====================

def get_dashboard_data(db: Session) -> dict:
    """
    获取 Dashboard 综合统计数据

    返回：
    - 活跃需求列表（含进度百分比）
    - 各成员工作负荷
    - 总体统计
    """

    # 1. 查询所有需求
    all_requirements = db.query(models.Requirement).all()
    total_requirements = len(all_requirements)

    # 2. 总任务数和已完成任务数
    total_tasks = db.query(models.Task).count()
    done_tasks = db.query(models.Task).filter(
        models.Task.status == models.TaskStatus.DONE
    ).count()
    completion_rate = round(
        (done_tasks / total_tasks * 100) if total_tasks > 0 else 0, 1
    )

    # 3. 活跃需求（含进度计算，只统计二级任务）
    active_requirements = []
    for req in all_requirements:
        if req.status in (models.RequirementStatus.PLANNING, models.RequirementStatus.IN_PROGRESS):
            l2_tasks = [t for t in req.tasks if t.level == 2]
            total = len(l2_tasks)
            done = sum(1 for t in l2_tasks if t.status == models.TaskStatus.DONE)
            progress = round((done / total * 100) if total > 0 else 0, 1)
            active_requirements.append({
                "id": req.id,
                "title": req.title,
                "version": req.version,
                "status": req.status.value,
                "priority": req.priority.value,
                "total_tasks": total,
                "done_tasks": done,
                "progress": progress,
            })

    # 4. 成员工作负荷（使用 CASE WHEN 计数）
    workload_query = (
        db.query(
            models.Task.assignee,
            func.count(models.Task.id).label("total"),
            func.count(case((models.Task.status == models.TaskStatus.TODO, 1))).label("todo"),
            func.count(case((models.Task.status == models.TaskStatus.IN_PROGRESS, 1))).label("in_progress"),
            func.count(case((models.Task.status == models.TaskStatus.REVIEW, 1))).label("review"),
            func.count(case((models.Task.status == models.TaskStatus.DONE, 1))).label("done"),
        )
        .filter(models.Task.assignee.isnot(None), models.Task.assignee != "")
        .group_by(models.Task.assignee)
        .all()
    )

    member_workloads = []
    for row in workload_query:
        member_workloads.append({
            "assignee": row.assignee,
            "total_tasks": row.total,
            "todo_count": row.todo,
            "in_progress_count": row.in_progress,
            "review_count": row.review,
            "done_count": row.done,
        })

    # 5. 今日循环任务
    today = date.today()
    all_recurring = db.query(models.RecurringTask).filter(
        models.RecurringTask.is_active == True
    ).order_by(models.RecurringTask.id).all()

    recurring_checklist = []
    for task in all_recurring:
        if not _is_due(task, today):
            continue
        log = db.query(models.RecurringTaskLog).filter(
            models.RecurringTaskLog.task_id == task.id,
            models.RecurringTaskLog.due_date == today,
        ).first()
        recurring_checklist.append({
            "task_id": task.id,
            "log_id": log.id if log else 0,
            "title": task.title,
            "assignee": task.assignee,
            "cycle": task.cycle.value,
            "completed": log.completed if log else False,
        })

    recurring_total = len(recurring_checklist)
    recurring_done = sum(1 for r in recurring_checklist if r["completed"])

    return {
        "active_requirements": active_requirements,
        "member_workloads": member_workloads,
        "total_requirements": total_requirements,
        "total_tasks": total_tasks,
        "completion_rate": completion_rate,
        "recurring_checklist": recurring_checklist,
        "recurring_total": recurring_total,
        "recurring_done": recurring_done,
    }


# ==================== 循环任务 CRUD ====================

def _is_due(task: models.RecurringTask, target_date: date) -> bool:
    """
    判断某个循环任务在指定日期是否应该出现。

    规则（基于 created_at 的日期）：
    - daily:    每天
    - weekly:   每周同一天（周一=created_at的周一）
    - biweekly: 每两周同一天
    - monthly:  每月同一天（如 created_at 是 5 号，则每月 5 号）
    """
    created = task.created_at.date() if task.created_at else date.today()
    cycle = task.cycle

    if cycle == models.RecurringCycle.DAILY:
        return True

    if cycle == models.RecurringCycle.WEEKLY:
        return target_date.weekday() == created.weekday()

    if cycle == models.RecurringCycle.BIWEEKLY:
        # 计算两个日期之间的周数差，偶数周则到期
        if target_date.weekday() != created.weekday():
            return False
        delta_days = (target_date - created).days
        return delta_days >= 0 and (delta_days // 7) % 2 == 0

    if cycle == models.RecurringCycle.MONTHLY:
        return target_date.day == created.day

    return False


def get_recurring_tasks(db: Session, active_only: bool = False) -> List[models.RecurringTask]:
    """查询循环任务模板"""
    query = db.query(models.RecurringTask)
    if active_only:
        query = query.filter(models.RecurringTask.is_active == True)
    return query.order_by(models.RecurringTask.id).all()


def create_recurring_task(db: Session, title: str, cycle: str = "daily",
                          assignee: Optional[str] = None) -> models.RecurringTask:
    """创建循环任务"""
    task = models.RecurringTask(title=title, cycle=cycle, assignee=assignee)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_recurring_task(db: Session, task_id: int, data: schemas.RecurringTaskUpdate) -> Optional[models.RecurringTask]:
    """更新循环任务（只更新非空字段）"""
    task = db.query(models.RecurringTask).filter(models.RecurringTask.id == task_id).first()
    if not task:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        if hasattr(task, k):
            setattr(task, k, v)
    db.commit()
    db.refresh(task)
    return task


def delete_recurring_task(db: Session, task_id: int) -> bool:
    """删除循环任务"""
    task = db.query(models.RecurringTask).filter(models.RecurringTask.id == task_id).first()
    if not task:
        return False
    db.delete(task)
    db.commit()
    return True


def get_checklist(db: Session, target_date: Optional[date] = None) -> List[dict]:
    """
    获取某天的循环任务清单

    只返回当天"到期"的循环任务，并附带完成状态。
    如果当天还没有记录，自动创建未完成的记录。
    """
    if target_date is None:
        target_date = date.today()

    all_tasks = db.query(models.RecurringTask).filter(
        models.RecurringTask.is_active == True
    ).order_by(models.RecurringTask.id).all()

    result = []
    for task in all_tasks:
        # 判断当天是否到期
        if not _is_due(task, target_date):
            continue

        # 查找当天的完成记录
        log = db.query(models.RecurringTaskLog).filter(
            models.RecurringTaskLog.task_id == task.id,
            models.RecurringTaskLog.due_date == target_date,
        ).first()

        if not log:
            log = models.RecurringTaskLog(
                task_id=task.id,
                due_date=target_date,
                completed=False,
            )
            db.add(log)
            db.flush()

        result.append({
            "task_id": task.id,
            "log_id": log.id,
            "title": task.title,
            "assignee": task.assignee,
            "cycle": task.cycle.value,
            "completed": log.completed,
            "completed_at": log.completed_at.isoformat() if log.completed_at else None,
            "note": log.note,
        })

    db.commit()
    return result


def toggle_recurring_log(db: Session, log_id: int) -> Optional[models.RecurringTaskLog]:
    """切换完成状态"""
    log = db.query(models.RecurringTaskLog).filter(models.RecurringTaskLog.id == log_id).first()
    if not log:
        return None
    log.completed = not log.completed
    log.completed_at = datetime.utcnow() if log.completed else None
    db.commit()
    db.refresh(log)
    return log


def get_checklist_history(db: Session, days: int = 14) -> List[dict]:
    """
    获取最近 N 天的循环任务完成情况

    只统计当天到期的任务完成率，而非所有模板。
    """
    from datetime import timedelta
    today = date.today()
    results = []

    # 预加载所有启用的任务
    active_tasks = db.query(models.RecurringTask).filter(
        models.RecurringTask.is_active == True
    ).all()

    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)

        # 筛选当天到期的任务
        due_tasks = [t for t in active_tasks if _is_due(t, d)]
        total = len(due_tasks)

        if total == 0:
            results.append({"date": d.isoformat(), "total": 0, "done": 0, "rate": 0.0})
            continue

        # 查询当天的完成记录
        task_ids = [t.id for t in due_tasks]
        logs = db.query(models.RecurringTaskLog).filter(
            models.RecurringTaskLog.task_id.in_(task_ids),
            models.RecurringTaskLog.due_date == d,
        ).all()

        done = sum(1 for l in logs if l.completed)
        rate = round((done / total * 100), 1)

        results.append({
            "date": d.isoformat(),
            "total": total,
            "done": done,
            "rate": rate,
        })

    return results


# ==================== 评论 CRUD ====================

def get_comments(db: Session, requirement_id: Optional[int] = None,
                 task_id: Optional[int] = None) -> List[models.Comment]:
    """查询评论"""
    query = db.query(models.Comment)
    if requirement_id is not None:
        query = query.filter(models.Comment.requirement_id == requirement_id)
    if task_id is not None:
        query = query.filter(models.Comment.task_id == task_id)
    return query.order_by(models.Comment.created_at.desc()).all()


def create_comment(db: Session, data: schemas.CommentCreate) -> models.Comment:
    """创建评论"""
    comment = models.Comment(**data.model_dump())
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


def delete_comment(db: Session, comment_id: int) -> bool:
    """删除评论"""
    c = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not c:
        return False
    db.delete(c)
    db.commit()
    return True


# ==================== 我的任务 ====================

def get_my_tasks(db: Session, assignee: str) -> List[dict]:
    """
    获取某个成员的所有任务（跨需求聚合）

    返回任务列表，附带所属需求信息和截止日期状态。
    """
    from datetime import timedelta
    today = date.today()
    soon_threshold = today + timedelta(days=3)

    tasks = (
        db.query(models.Task)
        .filter(models.Task.assignee == assignee)
        .order_by(models.Task.status, models.Task.due_date)
        .all()
    )

    result = []
    for t in tasks:
        req = t.requirement
        due = t.due_date.date() if t.due_date else None
        is_overdue = due is not None and due < today and t.status != models.TaskStatus.DONE
        is_due_soon = due is not None and today <= due <= soon_threshold and t.status != models.TaskStatus.DONE
        result.append({
            "task_id": t.id,
            "task_title": t.title,
            "status": t.status.value,
            "due_date": due.isoformat() if due else None,
            "requirement_id": req.id if req else 0,
            "requirement_title": req.title if req else "-",
            "requirement_version": req.version if req else "-",
            "is_overdue": is_overdue,
            "is_due_soon": is_due_soon,
        })

    return result


def get_deadline_alerts(db: Session, days: int = 7) -> List[dict]:
    """
    聚合接口：获取所有成员在指定天数内到期的任务

    一次查询替代前端多次遍历调用，性能更好。
    """
    from datetime import timedelta
    today = date.today()
    deadline = today + timedelta(days=days)

    tasks = (
        db.query(models.Task)
        .filter(
            models.Task.assignee.isnot(None),
            models.Task.assignee != "",
            models.Task.due_date.isnot(None),
            models.Task.status != models.TaskStatus.DONE,
        )
        .all()
    )

    result = []
    for t in tasks:
        due = t.due_date.date() if t.due_date else None
        if due is None or due > deadline:
            continue
        req = t.requirement
        result.append({
            "task_id": t.id,
            "task_title": t.title,
            "status": t.status.value,
            "assignee": t.assignee,
            "due_date": due.isoformat(),
            "requirement_id": req.id if req else 0,
            "requirement_title": req.title if req else "-",
            "is_overdue": due < today,
        })

    result.sort(key=lambda x: x["due_date"])
    return result


# ==================== 交付报告 ====================

def generate_delivery_report(db: Session, requirement_id: int) -> Optional[str]:
    """
    为需求生成业务友好的 Markdown 交付报告（战报格式）
    """
    req = db.query(models.Requirement).options(
        joinedload(models.Requirement.tasks)
    ).filter(models.Requirement.id == requirement_id).first()

    if not req:
        return None

    l2_tasks = [t for t in req.tasks if t.level == 2]
    l3_tasks = []
    for t in l2_tasks:
        l3_tasks.extend([c for c in (t.children or []) if c.level == 3])

    # ---- 人员：去重汇总所有参与者（二级任务负责人 + 三级任务执行者）----
    all_members = set()
    for t in l2_tasks:
        if t.assignee:
            all_members.add(t.assignee)
    for t in l3_tasks:
        if t.assignee:
            all_members.add(t.assignee)
    dev_list = "、".join(sorted(all_members)) if all_members else "暂无"

    # ---- 工时 ----
    est_total = sum(t.estimated_hours or 0 for t in l3_tasks)
    act_total = sum(t.actual_hours or 0 for t in l3_tasks)

    # ---- 进度 ----
    total_l2 = len(l2_tasks)
    done_l2 = [t for t in l2_tasks if t.status == models.TaskStatus.DONE]
    done_count = len(done_l2)
    progress = round((done_count / total_l2 * 100) if total_l2 > 0 else 0, 1)

    # 进度条（ASCII 10 格，渲染安全）
    filled = round(progress / 10)
    bar = "█" * filled + "░" * (10 - filled)

    # ---- 状态/优先级中文 ----
    status_cn = {
        "planning": "规划中", "in_progress": "进行中",
        "completed": "已完成", "archived": "已归档",
    }
    priority_cn = {"low": "低", "medium": "中", "high": "高", "urgent": "紧急"}
    task_status_cn = {
        "todo": "待办", "in_progress": "进行中",
        "review": "待验收", "done": "已完成",
    }

    # ---- 组装 Markdown ----
    lines = []
    lines.append(f"# 🏆 交付报告：{req.title}")
    lines.append("")
    lines.append(
        f"> **版本号：** {req.version} ｜ "
        f"**所属部门：** {req.department or '未指定'} ｜ "
        f"**当前状态：** {status_cn.get(req.status.value, req.status.value)} ｜ "
        f"**优先级：** {priority_cn.get(req.priority.value, req.priority.value)}"
    )
    lines.append("")
    lines.append("---")
    lines.append("")

    # 统筹与参战阵容
    lines.append("### 👥 统筹与参战阵容")
    lines.append("")
    lines.append(f"* **核心研发成员：** {dev_list}")
    lines.append("")

    # 研发效能与进度
    lines.append("### 📊 研发效能与进度")
    lines.append("")
    lines.append(f"* **整体完成度：** `{bar}` {progress}%")
    lines.append(f"* **资源消耗：** 累计投入约 **{act_total}h** (预估 {est_total}h)")
    lines.append(f"* **功能模块总数：** {total_l2} 个")
    lines.append("")
    lines.append("---")
    lines.append("")

    # 核心交付清单（已完成）
    lines.append("### ✅ 核心交付清单 (已上线/已完成)")
    lines.append("")
    if done_l2:
        for t in done_l2:
            lines.append(f"* 🟢 **{t.title}**")
    else:
        lines.append("> 🚧 需求正在火热冲刺中，暂无已上线的独立模块。")
    lines.append("")

    # 待办与规划中
    pending_l2 = [t for t in l2_tasks if t.status != models.TaskStatus.DONE]
    if pending_l2:
        lines.append("### 🚀 待办与规划中模块")
        lines.append("")
        for t in pending_l2:
            label = task_status_cn.get(t.status.value, t.status.value)
            lines.append(f"* ⏳ {t.title} (当前状态：{label})")
        lines.append("")

    lines.append("---")
    lines.append(f"*报告生成时间：{datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC*")

    return "\n".join(lines)


# ==================== 历史需求（已归档/已完成） ====================

def get_history_requirements(db: Session, page: int = 1, limit: int = 10) -> dict:
    """
    分页查询已完成或已归档的需求（历史需求）

    Returns:
        { "data": [...], "total": 45, "page": 1, "total_pages": 5 }
    """
    status_filter = [
        models.RequirementStatus.COMPLETED,
        models.RequirementStatus.ARCHIVED,
    ]

    # 1. COUNT 总数（纯计数，不加载关联）
    total = db.query(func.count(models.Requirement.id)).filter(
        models.Requirement.status.in_(status_filter)
    ).scalar() or 0

    # 2. 分页数据（joinedload 预加载 tasks）
    skip = (page - 1) * limit
    items = (
        db.query(models.Requirement)
        .options(joinedload(models.Requirement.tasks))
        .filter(models.Requirement.status.in_(status_filter))
        .order_by(models.Requirement.updated_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    total_pages = (total + limit - 1) // limit if total > 0 else 1

    result = []
    for req in items:
        l2_tasks = [t for t in req.tasks if t.level == 2]
        done = sum(1 for t in l2_tasks if t.status == models.TaskStatus.DONE)
        progress = round((done / len(l2_tasks) * 100) if l2_tasks else 0, 1)
        result.append({
            "id": req.id,
            "title": req.title,
            "version": req.version,
            "department": req.department or "",
            "status": req.status.value,
            "priority": req.priority.value,
            "req_type": req.req_type.value if req.req_type else "feature",
            "total_tasks": len(l2_tasks),
            "done_tasks": done,
            "progress": progress,
            "target_date": req.target_date.isoformat() if req.target_date else None,
            "created_at": req.created_at.isoformat() if req.created_at else None,
            "updated_at": req.updated_at.isoformat() if req.updated_at else None,
        })

    return {
        "data": result,
        "total": total,
        "page": page,
        "total_pages": total_pages,
    }

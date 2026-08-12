"""
CRUD 操作（数据库增删改查）

将所有数据库操作集中管理，保持路由层的简洁。
"""

from typing import List, Optional
from datetime import date, datetime
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case, literal
from app import models, schemas


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
) -> List[models.Task]:
    """查询任务列表，支持按需求、负责人、状态过滤"""
    query = db.query(models.Task)
    if requirement_id is not None:
        query = query.filter(models.Task.requirement_id == requirement_id)
    if assignee:
        query = query.filter(models.Task.assignee == assignee)
    if status:
        query = query.filter(models.Task.status == status)
    return query.order_by(models.Task.updated_at.desc()).offset(skip).limit(limit).all()


def get_task(db: Session, task_id: int) -> Optional[models.Task]:
    """根据 ID 查询单条任务"""
    return db.query(models.Task).filter(models.Task.id == task_id).first()


def create_task(db: Session, data: schemas.TaskCreate) -> models.Task:
    """创建新任务"""
    db_task = models.Task(**data.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


def update_task(
    db: Session, task_id: int, data: schemas.TaskUpdate
) -> Optional[models.Task]:
    """更新任务（只更新非空字段）"""
    db_task = get_task(db, task_id)
    if not db_task:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_task, field, value)
    db.commit()
    db.refresh(db_task)
    return db_task


def delete_task(db: Session, task_id: int) -> bool:
    """删除任务"""
    db_task = get_task(db, task_id)
    if not db_task:
        return False
    db.delete(db_task)
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

    # 3. 活跃需求（含进度计算）
    active_requirements = []
    for req in all_requirements:
        if req.status in (models.RequirementStatus.PLANNING, models.RequirementStatus.IN_PROGRESS):
            req_tasks = req.tasks
            total = len(req_tasks)
            done = sum(1 for t in req_tasks if t.status == models.TaskStatus.DONE)
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

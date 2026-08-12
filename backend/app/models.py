"""
SQLAlchemy 数据模型定义

核心表：
- Requirement：需求表，记录业务需求及其版本信息
- Task：任务表，记录需求拆分后的具体执行任务
"""

from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Date, Boolean, ForeignKey, Enum as SAEnum,
    UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base
import enum


# ==================== 枚举类型定义 ====================

class RequirementStatus(str, enum.Enum):
    """需求状态枚举"""
    PLANNING = "planning"       # 规划中
    IN_PROGRESS = "in_progress"  # 进行中
    COMPLETED = "completed"     # 已完成
    ARCHIVED = "archived"       # 已归档


class RequirementPriority(str, enum.Enum):
    """需求优先级枚举"""
    LOW = "low"          # 低
    MEDIUM = "medium"    # 中
    HIGH = "high"        # 高
    URGENT = "urgent"    # 紧急


class TaskStatus(str, enum.Enum):
    """任务状态枚举"""
    TODO = "todo"           # 待办
    IN_PROGRESS = "in_progress"  # 进行中
    REVIEW = "review"       # 待验收
    DONE = "done"           # 已完成


# ==================== 核心数据模型 ====================

class Member(Base):
    """
    团队成员表

    管理团队成员列表，任务的 assignee 字段引用此处的成员姓名。
    """
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True, comment="成员ID")
    name = Column(String(50), nullable=False, unique=True, comment="成员姓名")
    role = Column(String(100), nullable=True, comment="角色/职位")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")

    def __repr__(self):
        return f"<Member(id={self.id}, name='{self.name}')>"


class Requirement(Base):
    """
    需求表

    一条需求代表一个完整的业务诉求，包含版本号用于管理迭代。
    一个需求可以拆分为多个子任务（Task）。
    """
    __tablename__ = "requirements"

    id = Column(Integer, primary_key=True, index=True, comment="需求ID")
    title = Column(String(200), nullable=False, comment="需求标题")
    description = Column(Text, nullable=True, comment="需求描述")
    department = Column(String(100), nullable=True, comment="所属部门")
    doc_link = Column(String(500), nullable=True, comment="文档链接")
    version = Column(String(50), nullable=False, default="v1.0", comment="版本号，如 v1.0、v2.0")
    status = Column(
        SAEnum(RequirementStatus),
        default=RequirementStatus.PLANNING,
        comment="需求状态"
    )
    priority = Column(
        SAEnum(RequirementPriority),
        default=RequirementPriority.MEDIUM,
        comment="优先级"
    )
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    # 关联关系：一个需求包含多个子任务
    tasks = relationship("Task", back_populates="requirement", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Requirement(id={self.id}, title='{self.title}', version='{self.version}')>"


class Task(Base):
    """
    子任务表

    子任务是需求的具体执行单元，分配给特定成员，
    遵循 "待办 → 进行中 → 待验收 → 已完成" 的状态流转。
    """
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True, comment="任务ID")
    requirement_id = Column(
        Integer,
        ForeignKey("requirements.id", ondelete="CASCADE"),
        nullable=False,
        comment="关联的需求ID"
    )
    title = Column(String(200), nullable=False, comment="任务标题")
    description = Column(Text, nullable=True, comment="任务描述")
    assignee = Column(String(50), nullable=True, comment="负责人")
    status = Column(
        SAEnum(TaskStatus),
        default=TaskStatus.TODO,
        comment="任务状态"
    )
    due_date = Column(DateTime, nullable=True, comment="截止日期")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")

    # 关联关系：每个任务属于一个需求
    requirement = relationship("Requirement", back_populates="tasks")

    def __repr__(self):
        return f"<Task(id={self.id}, title='{self.title}', assignee='{self.assignee}')>"


class RecurringCycle(str, enum.Enum):
    """循环周期枚举"""
    DAILY = "daily"           # 每天
    WEEKLY = "weekly"         # 每周
    BIWEEKLY = "biweekly"     # 每两周
    MONTHLY = "monthly"       # 每月


class RecurringTask(Base):
    """
    循环任务模板

    定义需要按固定周期重复执行的任务。
    支持每天、每周、每两周、每月四种周期。
    周期判定基于 created_at 的日期。
    """
    __tablename__ = "recurring_tasks"

    id = Column(Integer, primary_key=True, index=True, comment="模板ID")
    title = Column(String(200), nullable=False, comment="任务名称")
    assignee = Column(String(50), nullable=True, comment="负责人")
    cycle = Column(
        SAEnum(RecurringCycle),
        default=RecurringCycle.DAILY,
        comment="循环周期: daily/weekly/biweekly/monthly"
    )
    is_active = Column(Boolean, default=True, comment="是否启用")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")

    logs = relationship("RecurringTaskLog", back_populates="task", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<RecurringTask(id={self.id}, title='{self.title}', cycle='{self.cycle}')>"


class RecurringTaskLog(Base):
    """
    循环任务完成记录

    记录某个循环任务在某次到期日是否已完成。
    唯一约束：(task_id, due_date) 不可重复。
    """
    __tablename__ = "recurring_task_logs"
    __table_args__ = (
        UniqueConstraint("task_id", "due_date", name="uq_task_due_date"),
    )

    id = Column(Integer, primary_key=True, index=True, comment="记录ID")
    task_id = Column(
        Integer,
        ForeignKey("recurring_tasks.id", ondelete="CASCADE"),
        nullable=False,
        comment="关联的循环任务ID"
    )
    due_date = Column(Date, nullable=False, comment="到期日")
    completed = Column(Boolean, default=False, comment="是否完成")
    completed_at = Column(DateTime, nullable=True, comment="完成时间")
    note = Column(String(500), nullable=True, comment="备注")

    task = relationship("RecurringTask", back_populates="logs")

    def __repr__(self):
        return f"<RecurringTaskLog(task={self.task_id}, due={self.due_date}, done={self.completed})>"


class Comment(Base):
    """
    评论/备注

    支持给需求或任务添加评论，用于团队沟通和进度记录。
    """
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True, comment="评论ID")
    content = Column(Text, nullable=False, comment="评论内容")
    author = Column(String(50), nullable=False, comment="评论人")
    # 关联：支持关联到需求或任务（二选一）
    requirement_id = Column(Integer, ForeignKey("requirements.id", ondelete="CASCADE"), nullable=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, comment="评论时间")

    def __repr__(self):
        return f"<Comment(id={self.id}, author='{self.author}')>"

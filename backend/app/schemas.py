"""
Pydantic 数据校验模型（Schemas）

用于 API 请求/响应的数据验证和序列化。
"""

from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field
from app.models import RequirementStatus, RequirementPriority, TaskStatus


# ==================== 成员相关 Schema ====================

class MemberBase(BaseModel):
    """成员基础字段"""
    name: str = Field(..., min_length=1, max_length=50, description="成员姓名")
    role: Optional[str] = Field(None, max_length=100, description="角色/职位")


class MemberCreate(MemberBase):
    """创建成员"""
    pass


class MemberUpdate(BaseModel):
    """更新成员（所有字段可选）"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    role: Optional[str] = Field(None, max_length=100)


class MemberResponse(MemberBase):
    """成员响应体"""
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ==================== 任务相关 Schema ====================

class TaskBase(BaseModel):
    """任务基础字段"""
    title: str = Field(..., min_length=1, max_length=200, description="任务标题")
    description: Optional[str] = Field(None, description="任务描述")
    assignee: Optional[str] = Field(None, description="负责人")
    status: TaskStatus = Field(default=TaskStatus.TODO, description="任务状态")
    due_date: Optional[datetime] = Field(None, description="截止日期")


class TaskCreate(TaskBase):
    """创建任务时的请求体"""
    requirement_id: int = Field(..., description="关联的需求ID")


class TaskUpdate(BaseModel):
    """更新任务时的请求体（所有字段可选）"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    assignee: Optional[str] = None
    status: Optional[TaskStatus] = None
    due_date: Optional[datetime] = None


class TaskResponse(TaskBase):
    """任务响应体"""
    id: int
    requirement_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ==================== 需求相关 Schema ====================

class RequirementBase(BaseModel):
    """需求基础字段"""
    title: str = Field(..., min_length=1, max_length=200, description="需求标题")
    description: Optional[str] = Field(None, description="需求描述")
    department: Optional[str] = Field(None, max_length=100, description="所属部门")
    doc_link: Optional[str] = Field(None, max_length=500, description="文档链接")
    version: str = Field(default="v1.0", max_length=50, description="版本号")
    status: RequirementStatus = Field(default=RequirementStatus.PLANNING, description="需求状态")
    priority: RequirementPriority = Field(default=RequirementPriority.MEDIUM, description="优先级")


class RequirementCreate(RequirementBase):
    """创建需求时的请求体"""
    pass


class RequirementUpdate(BaseModel):
    """更新需求时的请求体（所有字段可选）"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    department: Optional[str] = Field(None, max_length=100)
    doc_link: Optional[str] = Field(None, max_length=500)
    version: Optional[str] = Field(None, max_length=50)
    status: Optional[RequirementStatus] = None
    priority: Optional[RequirementPriority] = None


class RequirementResponse(RequirementBase):
    """需求响应体（包含关联的任务列表和进度信息）"""
    id: int
    created_at: datetime
    updated_at: datetime
    tasks: List[TaskResponse] = []

    model_config = {"from_attributes": True}


class RequirementSummary(BaseModel):
    """需求摘要（用于 Dashboard 展示）"""
    id: int
    title: str
    version: str
    status: RequirementStatus
    priority: RequirementPriority
    total_tasks: int = 0
    done_tasks: int = 0
    progress: float = 0.0  # 完成百分比 0~100

    model_config = {"from_attributes": True}


# ==================== Dashboard 相关 Schema ====================

class MemberWorkload(BaseModel):
    """成员工作负荷"""
    assignee: str
    total_tasks: int = 0
    todo_count: int = 0
    in_progress_count: int = 0
    review_count: int = 0
    done_count: int = 0


class DashboardRecurringItem(BaseModel):
    """Dashboard 循环任务项"""
    task_id: int
    log_id: int
    title: str
    assignee: Optional[str]
    cycle: str
    completed: bool


class DashboardData(BaseModel):
    """Dashboard 综合数据"""
    active_requirements: List[RequirementSummary]
    member_workloads: List[MemberWorkload]
    total_requirements: int = 0
    total_tasks: int = 0
    completion_rate: float = 0.0
    recurring_checklist: List[DashboardRecurringItem] = []
    recurring_total: int = 0
    recurring_done: int = 0


# ==================== 循环任务相关 Schema ====================

class RecurringTaskCreate(BaseModel):
    """创建循环任务"""
    title: str = Field(..., min_length=1, max_length=200, description="任务名称")
    assignee: Optional[str] = Field(None, max_length=50, description="负责人")
    cycle: str = Field(default="daily", description="循环周期: daily/weekly/biweekly/monthly")


class RecurringTaskUpdate(BaseModel):
    """更新循环任务（所有字段可选）"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    assignee: Optional[str] = Field(None, max_length=50)
    cycle: Optional[str] = None
    is_active: Optional[bool] = None


class RecurringTaskResponse(BaseModel):
    """循环任务响应体"""
    id: int
    title: str
    assignee: Optional[str]
    cycle: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ChecklistItem(BaseModel):
    """清单项（循环任务 + 当期完成状态）"""
    task_id: int
    log_id: int
    title: str
    assignee: Optional[str]
    cycle: str
    completed: bool
    completed_at: Optional[str]
    note: Optional[str]


class HistoryItem(BaseModel):
    """完成历史"""
    date: str
    total: int
    done: int
    rate: float


# ==================== 评论相关 Schema ====================

class CommentCreate(BaseModel):
    """创建评论"""
    content: str = Field(..., min_length=1, max_length=2000, description="评论内容")
    author: str = Field(..., min_length=1, max_length=50, description="评论人")
    requirement_id: Optional[int] = Field(None, description="关联需求ID")
    task_id: Optional[int] = Field(None, description="关联任务ID")


class CommentResponse(BaseModel):
    """评论响应体"""
    id: int
    content: str
    author: str
    requirement_id: Optional[int]
    task_id: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


# ==================== 我的任务相关 Schema ====================

class MyTaskItem(BaseModel):
    """我的任务项"""
    task_id: int
    task_title: str
    status: str
    due_date: Optional[str]
    requirement_id: int
    requirement_title: str
    requirement_version: str
    is_overdue: bool = False
    is_due_soon: bool = False

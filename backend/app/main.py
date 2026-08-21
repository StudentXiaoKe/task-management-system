"""
FastAPI 应用入口

功能：
- 初始化数据库
- 注册路由
- 配置 CORS（前端跨域访问）
- 启动时插入示例数据
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database import engine, get_db, Base
from app.routers import requirements, tasks, members, recurring_tasks, comments, auth, alignment, notifications, reports
from app import crud, schemas, models


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时增量建表，不删库不丢数据"""
    import traceback
    print("[INFO] 数据库初始化...")
    try:
        _migrate_db()
        Base.metadata.create_all(bind=engine)
        _insert_demo_data()
        print("[INFO] 数据库初始化成功")
    except Exception as e:
        print(f"[ERROR] 数据库初始化失败: {e}")
        traceback.print_exc()
    yield


def _migrate_db():
    """增量迁移：检查已有表是否缺字段，缺就 ALTER TABLE 加上"""
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    if not existing_tables:
        return
    with engine.begin() as conn:
        if "requirements" in existing_tables:
            cols = {c["name"] for c in inspector.get_columns("requirements")}
            for col, dtype in [("department", "VARCHAR(100)"), ("doc_link", "VARCHAR(500)"),
                              ("background", "TEXT"), ("acceptance_criteria", "TEXT"),
                              ("needs_data_extraction", "BOOLEAN DEFAULT 0"),
                              ("data_connection_info", "TEXT"), ("operation_screenshots", "TEXT"),
                              ("req_type", "VARCHAR(20) DEFAULT 'feature'"),
                              ("target_date", "DATE"), ("reference_links", "TEXT"),
                              ("operation_steps", "TEXT")]:
                if col not in cols:
                    conn.execute(text(f"ALTER TABLE requirements ADD COLUMN {col} {dtype}"))
                    print(f"[MIGRATE] requirements 新增 {col}")
        if "tasks" in existing_tables:
            cols = {c["name"] for c in inspector.get_columns("tasks")}
            migrations = [
                ("task_type", "VARCHAR(50)"), ("level", "INTEGER DEFAULT 2"),
                ("parent_id", "INTEGER"), ("estimated_hours", "FLOAT"), ("actual_hours", "FLOAT"),
            ]
            for col, dtype in migrations:
                if col not in cols:
                    conn.execute(text(f"ALTER TABLE tasks ADD COLUMN {col} {dtype}"))
                    print(f"[MIGRATE] tasks 新增 {col}")
        # 检查 users 表是否存在
        if "users" not in existing_tables:
            print("[MIGRATE] 将创建 users 表")
        if "members" in existing_tables:
            cols = {c["name"] for c in inspector.get_columns("members")}
            for col, dtype in [("title", "VARCHAR(100)"), ("initial_password", "VARCHAR(100)")]:
                if col not in cols:
                    conn.execute(text(f"ALTER TABLE members ADD COLUMN {col} {dtype}"))
                    print(f"[MIGRATE] members 新增 {col}")
        # notifications 表由 Base.metadata.create_all 自动创建，无需额外迁移


app = FastAPI(
    title="任务与需求管理系统",
    description="轻量级团队任务管理 MVP",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(requirements.router)
app.include_router(tasks.router)
app.include_router(members.router)
app.include_router(recurring_tasks.router)
app.include_router(comments.router)
app.include_router(auth.router)
app.include_router(alignment.router)
app.include_router(notifications.router)
app.include_router(reports.router)


@app.get("/api/dashboard", summary="获取 Dashboard 统计数据")
def get_dashboard(db: Session = Depends(get_db)):
    return crud.get_dashboard_data(db)


@app.get("/api/my-tasks", summary="获取我的任务")
def get_my_tasks(assignee: str = Query(..., description="成员姓名"), db: Session = Depends(get_db)):
    return crud.get_my_tasks(db, assignee=assignee)


@app.get("/api/deadline-alerts", summary="截止日期预警")
def get_deadline_alerts(days: int = Query(7, ge=1, le=30, description="预警天数"), db: Session = Depends(get_db)):
    return crud.get_deadline_alerts(db, days=days)


@app.get("/api/health", summary="健康检查")
def health_check():
    return {"status": "ok", "message": "任务管理系统运行正常"}


def _insert_demo_data():
    """首次启动时插入示例数据（各表独立检查，互不影响）"""
    from app.database import SessionLocal
    from app.auth import hash_password
    db = SessionLocal()
    try:
        # === 成员 ===
        if db.query(models.Member).count() == 0:
            demo_members = [
                models.Member(name="成员A", title="高级前端工程师", initial_password="Dev@123456"),
                models.Member(name="成员B", title="后端工程师", initial_password="Dev@123456"),
                models.Member(name="成员C", title="全栈工程师", initial_password="Dev@123456"),
                models.Member(name="成员D", title="测试工程师", initial_password="Dev@123456"),
            ]
            db.add_all(demo_members)
            db.flush()
            print("[SEED] 已插入示例成员")
        else:
            demo_members = db.query(models.Member).all()

        # === 用户 ===
        if db.query(models.User).count() == 0:
            demo_users = [
                models.User(username="admin", password_hash=hash_password("Admin@123456"), role=models.UserRole.MANAGER),
                models.User(username="client", password_hash=hash_password("Client@123456"), role=models.UserRole.CLIENT),
                models.User(username="memberA", password_hash=hash_password("Dev@123456"), role=models.UserRole.DEVELOPER,
                            member_id=demo_members[0].id if demo_members else None),
                models.User(username="memberB", password_hash=hash_password("Dev@123456"), role=models.UserRole.DEVELOPER,
                            member_id=demo_members[1].id if len(demo_members) > 1 else None),
                models.User(username="memberC", password_hash=hash_password("Dev@123456"), role=models.UserRole.DEVELOPER,
                            member_id=demo_members[2].id if len(demo_members) > 2 else None),
                models.User(username="memberD", password_hash=hash_password("Dev@123456"), role=models.UserRole.DEVELOPER,
                            member_id=demo_members[3].id if len(demo_members) > 3 else None),
            ]
            db.add_all(demo_users)
            print("[SEED] 已插入示例用户")

        # === 需求 + 任务 + 循环任务 ===
        if db.query(models.Requirement).count() == 0:
            req1 = models.Requirement(title="用户中心重构", description="对用户中心进行整体重构", department="产品部", version="v1.0", status=models.RequirementStatus.IN_PROGRESS, priority=models.RequirementPriority.HIGH)
            req2 = models.Requirement(title="数据报表优化", description="优化数据报表页面", department="运营部", version="v1.0", status=models.RequirementStatus.PLANNING, priority=models.RequirementPriority.MEDIUM)
            req3 = models.Requirement(title="移动端适配", description="核心页面移动端适配", department="产品部", version="v2.0", status=models.RequirementStatus.IN_PROGRESS, priority=models.RequirementPriority.URGENT)
            db.add_all([req1, req2, req3])
            db.flush()

            tasks_data = [
                models.Task(requirement_id=req1.id, title="用户信息接口重构", assignee="成员A", status=models.TaskStatus.DONE),
                models.Task(requirement_id=req1.id, title="登录页面 UI 改版", assignee="成员B", status=models.TaskStatus.IN_PROGRESS),
                models.Task(requirement_id=req1.id, title="用户权限模块开发", assignee="成员C", status=models.TaskStatus.TODO),
                models.Task(requirement_id=req1.id, title="集成测试编写", assignee="成员D", status=models.TaskStatus.TODO),
                models.Task(requirement_id=req2.id, title="报表数据聚合接口", assignee="成员A", status=models.TaskStatus.TODO),
                models.Task(requirement_id=req2.id, title="图表组件开发", assignee="成员B", status=models.TaskStatus.TODO),
                models.Task(requirement_id=req3.id, title="首页响应式布局", assignee="成员C", status=models.TaskStatus.IN_PROGRESS),
                models.Task(requirement_id=req3.id, title="移动端导航组件", assignee="成员D", status=models.TaskStatus.REVIEW),
                models.Task(requirement_id=req3.id, title="触屏手势支持", assignee="成员A", status=models.TaskStatus.TODO),
            ]
            db.add_all(tasks_data)

            recurring = [
                models.RecurringTask(title="每日站会", assignee="成员A", cycle="daily"),
                models.RecurringTask(title="提交日报", assignee="成员B", cycle="daily"),
                models.RecurringTask(title="环境巡检", assignee="成员D", cycle="daily"),
                models.RecurringTask(title="代码 Review", assignee="成员A", cycle="weekly"),
                models.RecurringTask(title="周报", assignee="成员B", cycle="weekly"),
            ]
            db.add_all(recurring)
            print("[SEED] 已插入示例需求、任务、循环任务")

        db.commit()
    finally:
        db.close()

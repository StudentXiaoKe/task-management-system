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
from app.routers import requirements, tasks, members, recurring_tasks, comments
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
    """
    增量迁移：检查已有表是否缺字段，缺就 ALTER TABLE 加上。
    SQLite 的 ALTER TABLE ADD COLUMN 是安全操作，不会丢数据。
    """
    from sqlalchemy import inspect, text
    inspector = inspect(engine)

    existing_tables = inspector.get_table_names()

    # 如果数据库是全新的，不需要迁移
    if not existing_tables:
        return

    with engine.begin() as conn:
        # 检查 requirements 表是否有 department / doc_link 字段
        if "requirements" in existing_tables:
            cols = {c["name"] for c in inspector.get_columns("requirements")}
            if "department" not in cols:
                conn.execute(text("ALTER TABLE requirements ADD COLUMN department VARCHAR(100)"))
                print("[MIGRATE] requirements 新增 department 字段")
            if "doc_link" not in cols:
                conn.execute(text("ALTER TABLE requirements ADD COLUMN doc_link VARCHAR(500)"))
                print("[MIGRATE] requirements 新增 doc_link 字段")

        # 检查旧表 daily_task_templates 是否存在，如果有说明需要迁移到 recurring_tasks
        if "daily_task_templates" in existing_tables and "recurring_tasks" not in existing_tables:
            # 旧表结构不同，只能重建 recurring_tasks 表
            # 旧数据量小，这里保留旧表不删，新建 recurring_tasks
            print("[MIGRATE] 检测到旧表 daily_task_templates，将创建新的 recurring_tasks 表")

        # 检查 comments 表是否存在
        if "comments" not in existing_tables:
            print("[MIGRATE] 将创建 comments 表")

        # 检查 members 表是否存在
        if "members" not in existing_tables:
            print("[MIGRATE] 将创建 members 表")

        # 检查 recurring_tasks 表是否存在
        if "recurring_tasks" not in existing_tables:
            print("[MIGRATE] 将创建 recurring_tasks 表")

        # 检查 recurring_task_logs 表是否存在
        if "recurring_task_logs" not in existing_tables:
            print("[MIGRATE] 将创建 recurring_task_logs 表")


app = FastAPI(
    title="任务与需求管理系统",
    description="轻量级团队任务管理 MVP",
    version="1.0.0",
    lifespan=lifespan,
)

# 配置 CORS，允许前端访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(requirements.router)
app.include_router(tasks.router)
app.include_router(members.router)
app.include_router(recurring_tasks.router)
app.include_router(comments.router)


@app.get("/api/dashboard", summary="获取 Dashboard 统计数据")
def get_dashboard(db: Session = Depends(get_db)):
    """返回 Dashboard 需要的综合统计数据"""
    return crud.get_dashboard_data(db)


@app.get("/api/my-tasks", summary="获取我的任务")
def get_my_tasks(assignee: str = Query(..., description="成员姓名"), db: Session = Depends(get_db)):
    """获取指定成员的所有任务（跨需求聚合）"""
    return crud.get_my_tasks(db, assignee=assignee)


@app.get("/api/deadline-alerts", summary="截止日期预警")
def get_deadline_alerts(days: int = Query(7, ge=1, le=30, description="预警天数"), db: Session = Depends(get_db)):
    """获取所有成员在指定天数内到期的任务（聚合接口，Dashboard 直接调用）"""
    return crud.get_deadline_alerts(db, days=days)


@app.get("/api/health", summary="健康检查")
def health_check():
    """服务健康检查"""
    return {"status": "ok", "message": "任务管理系统运行正常"}


def _insert_demo_data():
    """首次启动时插入示例数据"""
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        # 检查是否已有数据
        if db.query(models.Requirement).count() > 0:
            return

        # 创建示例成员
        demo_members = [
            models.Member(name="成员A", role="前端开发"),
            models.Member(name="成员B", role="后端开发"),
            models.Member(name="成员C", role="全栈开发"),
            models.Member(name="成员D", role="测试工程师"),
        ]
        db.add_all(demo_members)

        # 创建示例需求
        req1 = models.Requirement(
            title="用户中心重构",
            description="对用户中心进行整体重构，提升用户体验和系统可维护性",
            department="产品部",
            version="v1.0",
            status=models.RequirementStatus.IN_PROGRESS,
            priority=models.RequirementPriority.HIGH,
        )
        req2 = models.Requirement(
            title="数据报表优化",
            description="优化数据报表页面，增加导出功能和图表展示",
            department="运营部",
            version="v1.0",
            status=models.RequirementStatus.PLANNING,
            priority=models.RequirementPriority.MEDIUM,
        )
        req3 = models.Requirement(
            title="移动端适配",
            description="对核心页面进行移动端适配，支持响应式布局",
            department="产品部",
            version="v2.0",
            status=models.RequirementStatus.IN_PROGRESS,
            priority=models.RequirementPriority.URGENT,
        )
        db.add_all([req1, req2, req3])
        db.flush()

        # 为需求1创建子任务
        tasks_data = [
            models.Task(
                requirement_id=req1.id,
                title="用户信息接口重构",
                description="重构用户信息查询接口，支持分页",
                assignee="成员A",
                status=models.TaskStatus.DONE,
            ),
            models.Task(
                requirement_id=req1.id,
                title="登录页面 UI 改版",
                description="重新设计登录页面的视觉效果",
                assignee="成员B",
                status=models.TaskStatus.IN_PROGRESS,
            ),
            models.Task(
                requirement_id=req1.id,
                title="用户权限模块开发",
                description="开发基于角色的权限控制模块",
                assignee="成员C",
                status=models.TaskStatus.TODO,
            ),
            models.Task(
                requirement_id=req1.id,
                title="集成测试编写",
                description="编写用户中心模块的集成测试",
                assignee="成员D",
                status=models.TaskStatus.TODO,
            ),
            # 需求2的子任务
            models.Task(
                requirement_id=req2.id,
                title="报表数据聚合接口",
                description="开发报表数据聚合查询接口",
                assignee="成员A",
                status=models.TaskStatus.TODO,
            ),
            models.Task(
                requirement_id=req2.id,
                title="图表组件开发",
                description="基于 ECharts 开发可复用的图表组件",
                assignee="成员B",
                status=models.TaskStatus.TODO,
            ),
            # 需求3的子任务
            models.Task(
                requirement_id=req3.id,
                title="首页响应式布局",
                description="实现首页在移动端的响应式布局",
                assignee="成员C",
                status=models.TaskStatus.IN_PROGRESS,
            ),
            models.Task(
                requirement_id=req3.id,
                title="移动端导航组件",
                description="开发适配移动端的侧边导航组件",
                assignee="成员D",
                status=models.TaskStatus.REVIEW,
            ),
            models.Task(
                requirement_id=req3.id,
                title="触屏手势支持",
                description="为列表页面增加触屏滑动操作支持",
                assignee="成员A",
                status=models.TaskStatus.TODO,
            ),
        ]
        db.add_all(tasks_data)

        # 创建示例循环任务
        recurring = [
            models.RecurringTask(title="每日站会", assignee="成员A", cycle="daily"),
            models.RecurringTask(title="提交日报", assignee="成员B", cycle="daily"),
            models.RecurringTask(title="提交日报", assignee="成员C", cycle="daily"),
            models.RecurringTask(title="环境巡检", assignee="成员D", cycle="daily"),
            models.RecurringTask(title="代码 Review", assignee="成员A", cycle="weekly"),
            models.RecurringTask(title="周报", assignee="成员B", cycle="weekly"),
            models.RecurringTask(title="技术分享", assignee="成员C", cycle="biweekly"),
            models.RecurringTask(title="依赖安全扫描", assignee="成员D", cycle="monthly"),
        ]
        db.add_all(recurring)

        db.commit()
    finally:
        db.close()

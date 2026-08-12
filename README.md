# 任务与需求管理系统

轻量级团队内部任务管理 MVP，支持需求追踪、任务分发、状态流转和可视化看板。

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | FastAPI + SQLAlchemy + SQLite |
| 前端 | React 19 + TypeScript + Ant Design 6 + Zustand |
| 构建 | Vite |

## 快速启动

### Windows

```bash
# 双击运行 start.bat 或：
cd task-management-system
start.bat
```

### Linux / macOS

```bash
cd task-management-system
chmod +x start.sh
./start.sh
```

### 手动启动

**启动后端：**

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

**启动前端：**

```bash
cd frontend
npm install
npm run dev
```

启动后访问：
- 前端界面：http://localhost:5173
- API 文档：http://localhost:8000/docs

## 核心功能

### 1. 需求管理
- 创建/编辑/删除需求
- 版本号管理（v1.0, v2.0...）
- 追踪需求下所有子任务的整体进度
- 状态：规划中 → 进行中 → 已完成

### 2. 任务管理
- 将需求拆分为具体子任务
- 指派给团队成员（A/B/C/D）
- 看板视图 + 表格视图切换
- 状态流转：待办 → 进行中 → 待验收 → 已完成

### 3. Dashboard 看板
- 统计卡片：总需求、总任务、完成率
- 活跃需求列表（含进度条）
- 成员工作负荷可视化（负荷标签：空闲/适中/高负荷）

## 项目结构

```
task-management-system/
├── backend/
│   ├── app/
│   │   ├── main.py        # FastAPI 入口，含示例数据
│   │   ├── database.py    # 数据库连接
│   │   ├── models.py      # SQLAlchemy 数据模型
│   │   ├── schemas.py     # Pydantic 校验模型
│   │   ├── crud.py        # 数据库 CRUD 操作
│   │   └── routers/
│   │       ├── requirements.py  # 需求 API
│   │       └── tasks.py        # 任务 API
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/index.ts       # API 服务层
│   │   ├── store/index.ts     # Zustand 状态管理
│   │   ├── types/index.ts     # TypeScript 类型定义
│   │   ├── components/
│   │   │   ├── Dashboard.tsx       # Dashboard 主控制台
│   │   │   ├── RequirementList.tsx # 需求管理
│   │   │   └── TaskList.tsx       # 任务管理（含看板）
│   │   ├── App.tsx           # 主应用布局
│   │   └── main.tsx          # 入口
│   └── package.json
├── start.bat               # Windows 启动脚本
└── start.sh                # Linux/macOS 启动脚本
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/requirements/ | 获取需求列表 |
| POST | /api/requirements/ | 创建需求 |
| PUT | /api/requirements/{id} | 更新需求 |
| DELETE | /api/requirements/{id} | 删除需求 |
| GET | /api/tasks/ | 获取任务列表 |
| POST | /api/tasks/ | 创建任务 |
| PUT | /api/tasks/{id} | 更新任务 |
| PUT | /api/tasks/{id}/status | 更新任务状态 |
| DELETE | /api/tasks/{id} | 删除任务 |
| GET | /api/dashboard | Dashboard 统计数据 |

#!/bin/bash
# ============================================================
#  任务与需求管理系统 - 一键启动脚本 (Linux/macOS)
#  用法: chmod +x start.sh && ./start.sh
# ============================================================

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"
BACKEND_PORT=8001
FRONTEND_PORT=5173

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║        任务与需求管理系统 - 启动脚本          ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ============================================================
#  第 1 步：环境检查
# ============================================================
echo " [检查] 检测运行环境..."

# --- Python ---
if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
    echo " [错误] 未检测到 Python，请先安装 Python 3.9+"
    exit 1
fi
PYTHON=$(command -v python3 || command -v python)
PY_VER=$($PYTHON --version 2>&1)
echo "       Python: $PY_VER"

# --- Node.js ---
if ! command -v node &>/dev/null; then
    echo " [错误] 未检测到 Node.js，请先安装 Node.js 18+"
    echo "       https://nodejs.org/"
    exit 1
fi
NODE_VER=$(node --version)
echo "       Node.js: $NODE_VER"

# --- npm ---
if ! command -v npm &>/dev/null; then
    echo " [错误] 未检测到 npm，请重新安装 Node.js"
    exit 1
fi
NPM_VER=$(npm --version)
echo "       npm: v$NPM_VER"
echo ""

# ============================================================
#  第 2 步：端口检查
# ============================================================
echo " [检查] 检测端口占用..."

check_port() {
    local port=$1
    if lsof -i :"$port" &>/dev/null || ss -tuln 2>/dev/null | grep -q ":$port "; then
        return 0  # 端口被占用
    fi
    return 1  # 端口空闲
}

SKIP_BACKEND=0
SKIP_FRONTEND=0

if check_port $BACKEND_PORT; then
    echo " [警告] 端口 $BACKEND_PORT 已被占用，后端可能已运行"
    SKIP_BACKEND=1
fi

if check_port $FRONTEND_PORT; then
    echo " [警告] 端口 $FRONTEND_PORT 已被占用，前端可能已运行"
    SKIP_FRONTEND=1
fi
echo ""

# ============================================================
#  清理函数（Ctrl+C 时优雅退出）
# ============================================================
cleanup() {
    echo ""
    echo " 正在停止服务..."
    [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
    echo " 已停止所有服务"
    exit 0
}
trap cleanup SIGINT SIGTERM

# ============================================================
#  第 3 步：启动后端
# ============================================================
if [ "$SKIP_BACKEND" -eq 1 ]; then
    echo " [跳过] 后端已在运行  http://localhost:$BACKEND_PORT"
else
    echo " [1/2] 启动后端服务 (FastAPI + SQLite)..."
    cd "$BACKEND_DIR"

    # 安装依赖
    echo "       安装依赖..."
    $PYTHON -m pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo " [错误] 后端依赖安装失败！"
        exit 1
    fi

    # 后台启动
    $PYTHON -m uvicorn app.main:app --reload --host 0.0.0.0 --port $BACKEND_PORT &
    BACKEND_PID=$!

    # 等待后端就绪
    echo "       等待后端启动..."
    for i in $(seq 1 30); do
        if curl -s http://localhost:$BACKEND_PORT/api/health >/dev/null 2>&1; then
            echo "       后端就绪! (${i}s)  http://localhost:$BACKEND_PORT"
            break
        fi
        sleep 1
        if [ $i -eq 30 ]; then
            echo " [错误] 后端 30 秒内未启动成功！"
            exit 1
        fi
    done
    echo "       API 文档: http://localhost:$BACKEND_PORT/docs"
fi
echo ""

# ============================================================
#  第 4 步：启动前端
# ============================================================
if [ "$SKIP_FRONTEND" -eq 1 ]; then
    echo " [跳过] 前端已在运行  http://localhost:$FRONTEND_PORT"
else
    echo " [2/2] 启动前端服务 (React + Vite)..."
    cd "$FRONTEND_DIR"

    # 首次运行安装依赖
    if [ ! -d "node_modules" ]; then
        echo "       首次运行，安装 npm 依赖（约 1-2 分钟）..."
        npm install --silent 2>/dev/null
        echo "       依赖安装完成"
    else
        echo "       检测到 node_modules，跳过安装"
    fi

    # 后台启动
    npm run dev &
    FRONTEND_PID=$!
    echo "       前端 PID: $FRONTEND_PID  http://localhost:$FRONTEND_PORT"
fi
echo ""

# ============================================================
#  启动完成
# ============================================================
echo "══════════════════════════════════════════════"
echo " 启动完成！"
echo ""
echo " 前端界面:  http://localhost:$FRONTEND_PORT"
echo " 后端 API:  http://localhost:$BACKEND_PORT"
echo " Swagger:   http://localhost:$BACKEND_PORT/docs"
echo ""
echo " 按 Ctrl+C 停止所有服务"
echo "══════════════════════════════════════════════"
echo ""

# 等待后台进程
wait

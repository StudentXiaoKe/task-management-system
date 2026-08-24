/**
 * 主应用组件

 * 认证流程：未登录跳转登录页，登录后显示主界面。
 * HashRouter + React.lazy 代码分割。
 */

import { lazy, Suspense, useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { ConfigProvider, Layout, Menu, theme, App as AntApp, Spin, Button, Tag, Dropdown, Badge, Popover, List, Tooltip } from "antd";
import {
  DashboardOutlined, ProjectOutlined, UnorderedListOutlined,
  TeamOutlined, SyncOutlined, UserOutlined, LogoutOutlined, ApartmentOutlined, BarChartOutlined, BellOutlined,
} from "@ant-design/icons";
import zhCN from "antd/locale/zh_CN";
import ErrorBoundary from "./components/ErrorBoundary";
import { useAuthStore, useNotificationStore } from "./store";
import { ROLE_LABELS } from "./types";

const Login = lazy(() => import("./components/Login"));
const Dashboard = lazy(() => import("./components/Dashboard"));
const RequirementList = lazy(() => import("./components/RequirementList"));
const TaskList = lazy(() => import("./components/TaskList"));
const MemberManage = lazy(() => import("./components/MemberManage"));
const RecurringTasks = lazy(() => import("./components/RecurringTasks"));
const MyTasks = lazy(() => import("./components/MyTasks"));
const AlignmentMap = lazy(() => import("./components/AlignmentMap"));
const Reports = lazy(() => import("./components/Reports"));

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: "/dashboard",    icon: <DashboardOutlined />,  label: "工作台" },
  { key: "/mytasks",      icon: <UserOutlined />,       label: "我的任务" },
  { key: "/requirements", icon: <ProjectOutlined />,    label: "需求管理" },
  { key: "/tasks",        icon: <UnorderedListOutlined />, label: "任务管理" },
  { key: "/members",      icon: <TeamOutlined />,       label: "成员管理" },
  { key: "/recurring",    icon: <SyncOutlined />,       label: "循环任务" },
  { key: "/alignment",    icon: <ApartmentOutlined />,  label: "对齐视图" },
  { key: "/reports",      icon: <BarChartOutlined />,   label: "数据统计" },
];

const PageLoading = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
    <Spin size="large" tip="加载中..." />
  </div>
);

/** 全局消息铃铛 */
function NotificationBell() {
  const navigate = useNavigate();
  const { items, total, fetchUnread, markRead } = useNotificationStore();

  useEffect(() => {
    fetchUnread();
    const timer = setInterval(fetchUnread, 30000); // 每 30 秒轮询
    return () => clearInterval(timer);
  }, [fetchUnread]);

  const handleClick = async (id: number, taskId: number | null) => {
    await markRead(id);
    if (taskId) navigate(`/tasks`);
  };

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      title="消息通知"
      content={
        items.length === 0
          ? <div style={{ padding: "16px 8px", color: "#999", fontSize: 13 }}>暂无未读消息</div>
          : <List
              size="small"
              dataSource={items}
              style={{ width: 320, maxHeight: 360, overflow: "auto" }}
              renderItem={(item) => (
                <List.Item
                  style={{ cursor: "pointer", padding: "10px 8px" }}
                  onClick={() => handleClick(item.id, item.reference_task_id)}
                >
                  <div style={{ width: "100%" }}>
                    <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>{item.content}</div>
                  </div>
                </List.Item>
              )}
            />
      }
    >
      <Badge count={total} size="small" offset={[-2, 2]}>
        <BellOutlined style={{ fontSize: 18, cursor: "pointer", color: total > 0 ? "#1677ff" : "#999" }} />
      </Badge>
    </Popover>
  );
}

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const currentKey = "/" + (location.pathname.split("/")[1] || "dashboard");
  const currentLabel = menuItems.find((m) => m.key === currentKey)?.label || "工作台";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible collapsed={collapsed} onCollapse={setCollapsed}
        style={{ overflow: "auto", height: "100vh", position: "fixed", left: 0, top: 0, bottom: 0, background: "#001529" }}
      >
        <div style={{
          height: 64, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          borderBottom: "1px solid rgba(255,255,255,0.1)", padding: "0 12px",
        }}>
          <Tooltip title="开发者：李廷科" placement="right">
            <img src={import.meta.env.BASE_URL + "logo.jpg"} alt="logo" style={{
              width: 36, height: 36, borderRadius: 8, objectFit: "cover", flexShrink: 0, cursor: "pointer",
            }} />
          </Tooltip>
          {!collapsed && (
            <span style={{ color: "#fff", fontSize: 16, fontWeight: 600, whiteSpace: "nowrap" }}>
              任务管理系统
            </span>
          )}
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[currentKey]}
          items={menuItems} onClick={({ key }) => navigate(key)} />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: "margin-left 0.2s" }}>
        <Header style={{
          background: "#fff", padding: "0 24px", display: "flex", alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #f0f0f0", position: "sticky", top: 0, zIndex: 10,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>{currentLabel}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {user && (
              <>
                {/* 铃铛通知 */}
                <NotificationBell />
                <Tag color={user.role === "MANAGER" ? "orange" : user.role === "CLIENT" ? "blue" : "green"}>
                  {ROLE_LABELS[user.role] || user.role}
                </Tag>
                <span style={{ fontSize: 14, color: "#333" }}>{user.username}</span>
                <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>
                  退出
                </Button>
              </>
            )}
          </div>
        </Header>

        <Content style={{
          margin: 24, padding: 24, background: "#f5f5f5",
          minHeight: "calc(100vh - 112px)", borderRadius: 8,
        }}>
          <ErrorBoundary>
            <Suspense fallback={<PageLoading />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/mytasks" element={<MyTasks />} />
                <Route path="/requirements" element={<RequirementList />} />
                <Route path="/tasks" element={<TaskList />} />
                <Route path="/members" element={<MemberManage />} />
                <Route path="/recurring" element={<RecurringTasks />} />
                <Route path="/alignment" element={<AlignmentMap />} />
                <Route path="/reports" element={<Reports />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Content>
      </Layout>
    </Layout>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{ algorithm: theme.defaultAlgorithm, token: { colorPrimary: "#1677ff", borderRadius: 8 } }}
    >
      <AntApp>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
          </Routes>
        </HashRouter>
      </AntApp>
    </ConfigProvider>
  );
}

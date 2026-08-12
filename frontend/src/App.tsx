/**
 * 主应用组件

 * 使用 React Router 管理页面路由，支持浏览器前进后退和 URL 直接访问。
 * 每个页面用 React.lazy 做代码分割，首屏只加载当前页面。
 * 全局 ErrorBoundary 防止子组件报错白屏。
 */

import { lazy, Suspense, useState } from "react";
import { HashRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { ConfigProvider, Layout, Menu, theme, App as AntApp, Spin } from "antd";
import {
  DashboardOutlined,
  ProjectOutlined,
  UnorderedListOutlined,
  TeamOutlined,
  SyncOutlined,
  UserOutlined,
} from "@ant-design/icons";
import zhCN from "antd/locale/zh_CN";
import ErrorBoundary from "./components/ErrorBoundary";

const Dashboard = lazy(() => import("./components/Dashboard"));
const RequirementList = lazy(() => import("./components/RequirementList"));
const TaskList = lazy(() => import("./components/TaskList"));
const MemberManage = lazy(() => import("./components/MemberManage"));
const RecurringTasks = lazy(() => import("./components/RecurringTasks"));
const MyTasks = lazy(() => import("./components/MyTasks"));

const { Header, Sider, Content } = Layout;

/** 菜单项 */
const menuItems = [
  { key: "/dashboard",    icon: <DashboardOutlined />,  label: "工作台" },
  { key: "/mytasks",      icon: <UserOutlined />,       label: "我的任务" },
  { key: "/requirements", icon: <ProjectOutlined />,    label: "需求管理" },
  { key: "/tasks",        icon: <UnorderedListOutlined />, label: "任务管理" },
  { key: "/members",      icon: <TeamOutlined />,       label: "成员管理" },
  { key: "/recurring",    icon: <SyncOutlined />,       label: "循环任务" },
];

/** 加载中占位 */
const PageLoading = () => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
    <Spin size="large" tip="加载中..." />
  </div>
);

/** 内部布局组件（需要在 Router 内部使用 hooks） */
function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const currentKey = "/" + (location.pathname.split("/")[1] || "dashboard");
  const currentLabel = menuItems.find((m) => m.key === currentKey)?.label || "工作台";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{
          overflow: "auto", height: "100vh", position: "fixed",
          left: 0, top: 0, bottom: 0, background: "#001529",
        }}
      >
        <div style={{
          height: 64, display: "flex", alignItems: "center", justifyContent: "center",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}>
          <span style={{ color: "#fff", fontSize: collapsed ? 16 : 18, fontWeight: 600, whiteSpace: "nowrap" }}>
            {collapsed ? "TM" : "任务管理系统"}
          </span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[currentKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: "margin-left 0.2s" }}>
        <Header style={{
          background: "#fff", padding: "0 24px", display: "flex", alignItems: "center",
          borderBottom: "1px solid #f0f0f0", position: "sticky", top: 0, zIndex: 10,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 500 }}>{currentLabel}</h2>
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
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Content>
      </Layout>
    </Layout>
  );
}

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{ algorithm: theme.defaultAlgorithm, token: { colorPrimary: "#1677ff", borderRadius: 8 } }}
    >
      <AntApp>
        <HashRouter>
          <AppLayout />
        </HashRouter>
      </AntApp>
    </ConfigProvider>
  );
}

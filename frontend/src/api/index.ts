/**
 * API 服务层

 * 封装所有后端接口调用，统一管理 HTTP 请求。
 */

import axios from "axios";
import type {
  Requirement,
  RequirementCreate,
  RequirementUpdate,
  Task,
  TaskCreate,
  TaskUpdate,
  TaskProgress,
  DashboardData,
  TaskStatus,
  Member,
  MemberCreate,
  MemberUpdate,
  RecurringTask,
  ChecklistItem,
  HistoryItem,
  Comment,
  CommentCreate,
  MyTaskItem,
  User,
  TokenResponse,
  AlignmentTreeNode,
} from "@/types";

const api = axios.create({
  baseURL: `${import.meta.env.BASE_URL}api`,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// 请求拦截器：自动带上 JWT Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：401 时跳转登录（排除登录接口本身的 401）
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    // 登录接口的 401 是密码错误，不跳转
    if (error.response?.status === 401 && !url.includes("/auth/login")) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("current_user");
      window.location.hash = "#/login";
    }
    return Promise.reject(error);
  }
);

// ==================== 认证 API ====================

export const authApi = {
  /** 登录 */
  login: (username: string, password: string) =>
    api.post<TokenResponse>("/auth/login", { username, password }).then((r) => r.data),

  /** 注册 */
  register: (data: { username: string; password: string; role?: string; member_id?: number }) =>
    api.post<User>("/auth/register", data).then((r) => r.data),

  /** 获取当前用户 */
  me: () =>
    api.get<User>("/auth/me").then((r) => r.data),

  /** 获取所有用户 */
  listUsers: () =>
    api.get<User[]>("/auth/users").then((r) => r.data),
};

// ==================== 需求 API ====================

export const requirementApi = {
  /** 获取需求列表 */
  list: (params?: { status?: string; version?: string }) =>
    api.get<Requirement[]>("/requirements/", { params }).then((r) => r.data),

  /** 获取单条需求 */
  get: (id: number) =>
    api.get<Requirement>(`/requirements/${id}`).then((r) => r.data),

  /** 创建需求 */
  create: (data: RequirementCreate) =>
    api.post<Requirement>("/requirements/", data).then((r) => r.data),

  /** 更新需求 */
  update: (id: number, data: RequirementUpdate) =>
    api.put<Requirement>(`/requirements/${id}`, data).then((r) => r.data),

  /** 删除需求 */
  delete: (id: number) =>
    api.delete(`/requirements/${id}`).then((r) => r.data),

  /** 生成交付报告 */
  deliveryReport: (id: number) =>
    api.get<{ markdown: string }>(`/requirements/${id}/delivery-report`).then((r) => r.data),

  /** 历史需求（已完成/已归档，分页） */
  history: (page = 1, limit = 10) =>
    api.get<{ data: any[]; total: number; page: number; total_pages: number }>(
      "/requirements/history", { params: { page, limit } }
    ).then((r) => r.data),
};

// ==================== 任务 API ====================

export const taskApi = {
  /** 获取任务列表 */
  list: (params?: {
    requirement_id?: number;
    assignee?: string;
    status?: string;
    level?: number;
    parent_id?: number;
  }) => api.get<Task[]>("/tasks/", { params }).then((r) => r.data),

  /** 获取单条任务 */
  get: (id: number) =>
    api.get<Task>(`/tasks/${id}`).then((r) => r.data),

  /** 获取子任务 */
  getChildren: (id: number) =>
    api.get<Task[]>(`/tasks/${id}/children`).then((r) => r.data),

  /** 获取任务进度 */
  getProgress: (id: number) =>
    api.get<TaskProgress>(`/tasks/${id}/progress`).then((r) => r.data),

  /** 创建任务 */
  create: (data: TaskCreate) =>
    api.post<Task>("/tasks/", data).then((r) => r.data),

  /** 更新任务 */
  update: (id: number, data: TaskUpdate) =>
    api.put<Task>(`/tasks/${id}`, data).then((r) => r.data),

  /** 更新任务状态 */
  updateStatus: (id: number, status: TaskStatus) =>
    api.put<Task>(`/tasks/${id}/status`, null, { params: { new_status: status } }).then((r) => r.data),

  /** 删除任务 */
  delete: (id: number) =>
    api.delete(`/tasks/${id}`).then((r) => r.data),
};

// ==================== Dashboard API ====================

export const dashboardApi = {
  /** 获取 Dashboard 综合数据 */
  getData: () =>
    api.get<DashboardData>("/dashboard").then((r) => r.data),
};

// ==================== 成员 API ====================

export const memberApi = {
  /** 获取成员列表 */
  list: () =>
    api.get<Member[]>("/members/").then((r) => r.data),

  /** 添加成员 */
  create: (data: MemberCreate & { username?: string; password?: string; title?: string }) =>
    api.post<Member>("/members/", data).then((r) => r.data),

  /** 更新成员 */
  update: (id: number, data: MemberUpdate) =>
    api.put<Member>(`/members/${id}`, data).then((r) => r.data),

  /** 删除成员 */
  delete: (id: number) =>
    api.delete(`/members/${id}`).then((r) => r.data),

  /** 重置成员密码 */
  resetPassword: (memberId: number, newPassword?: string) =>
    api.post(`/members/${memberId}/reset-password`, { new_password: newPassword || null }).then((r) => r.data),
};

// ==================== 循环任务 API ====================

export const recurringTaskApi = {
  /** 获取循环任务列表 */
  list: (activeOnly = false) =>
    api.get<RecurringTask[]>("/recurring-tasks/", { params: { active_only: activeOnly } }).then((r) => r.data),

  /** 创建循环任务 */
  create: (data: { title: string; cycle?: string; assignee?: string }) =>
    api.post<RecurringTask>("/recurring-tasks/", data).then((r) => r.data),

  /** 更新循环任务 */
  update: (id: number, data: { title?: string; assignee?: string; cycle?: string; is_active?: boolean }) =>
    api.put<RecurringTask>(`/recurring-tasks/${id}`, data).then((r) => r.data),

  /** 删除循环任务 */
  delete: (id: number) =>
    api.delete(`/recurring-tasks/${id}`).then((r) => r.data),

  /** 获取当期清单 */
  getChecklist: (dateStr?: string) =>
    api.get<ChecklistItem[]>("/recurring-tasks/checklist", { params: { date: dateStr } }).then((r) => r.data),

  /** 切换完成状态 */
  toggleTask: (logId: number) =>
    api.put(`/recurring-tasks/checklist/${logId}/toggle`).then((r) => r.data),

  /** 获取历史记录 */
  getHistory: (days = 14) =>
    api.get<HistoryItem[]>("/recurring-tasks/history", { params: { days } }).then((r) => r.data),
};

// ==================== 评论 API ====================

export const commentApi = {
  /** 获取评论 */
  list: (params?: { requirement_id?: number; task_id?: number }) =>
    api.get<Comment[]>("/comments/", { params }).then((r) => r.data),

  /** 添加评论 */
  create: (data: CommentCreate) =>
    api.post<Comment>("/comments/", data).then((r) => r.data),

  /** 删除评论 */
  delete: (id: number) =>
    api.delete(`/comments/${id}`).then((r) => r.data),
};

// ==================== 我的任务 API ====================

export const myTaskApi = {
  /** 获取我的任务 */
  list: (assignee: string) =>
    api.get<MyTaskItem[]>("/my-tasks", { params: { assignee } }).then((r) => r.data),

  /** 获取截止日期预警（聚合接口） */
  alerts: (days = 7) =>
    api.get<(MyTaskItem & { assignee: string })[]>("/deadline-alerts", { params: { days } }).then((r) => r.data),
};

// ==================== 对齐视图 API ====================

export const alignmentApi = {
  /** 获取对齐全景树（可选 rootId 聚焦单棵需求子树） */
  getTree: (rootId?: string) =>
    api.get<AlignmentTreeNode>("/alignment/tree", { params: rootId ? { root_id: rootId } : {} }).then((r) => r.data),
};

// ==================== 消息通知 API ====================

export const notificationApi = {
  /** 获取未读消息 */
  getUnread: () =>
    api.get<{ total: number; items: Array<{ id: number; title: string; content: string; reference_task_id: number | null; is_read: boolean; created_at: string }> }>("/notifications/unread").then((r) => r.data),

  /** 标记消息已读 */
  markRead: (id: number) =>
    api.put(`/notifications/${id}/read`).then((r) => r.data),
};

// ==================== 报表 API ====================

export const reportsApi = {
  /** 部门统计数据 */
  departmentStats: (params?: { start_date?: string; end_date?: string }) =>
    api.get<{ departments: any[]; overall: any }>("/reports/department-stats", { params }).then(r => r.data),

  /** 生成 Markdown 汇总报告 */
  summaryReport: (params?: { start_date?: string; end_date?: string; department?: string }) =>
    api.get<{ markdown: string; total: number }>("/reports/summary-report", { params }).then(r => r.data),
};

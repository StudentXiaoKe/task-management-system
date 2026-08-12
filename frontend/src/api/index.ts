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
} from "@/types";

const api = axios.create({
  baseURL: "/api",
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

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
};

// ==================== 任务 API ====================

export const taskApi = {
  /** 获取任务列表 */
  list: (params?: {
    requirement_id?: number;
    assignee?: string;
    status?: string;
  }) => api.get<Task[]>("/tasks/", { params }).then((r) => r.data),

  /** 获取单条任务 */
  get: (id: number) =>
    api.get<Task>(`/tasks/${id}`).then((r) => r.data),

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
  create: (data: MemberCreate) =>
    api.post<Member>("/members/", data).then((r) => r.data),

  /** 更新成员 */
  update: (id: number, data: MemberUpdate) =>
    api.put<Member>(`/members/${id}`, data).then((r) => r.data),

  /** 删除成员 */
  delete: (id: number) =>
    api.delete(`/members/${id}`).then((r) => r.data),
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

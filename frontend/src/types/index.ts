/**
 * TypeScript 类型定义

 * 定义前端使用的所有数据类型，与后端 Schema 保持一致。
 */

// ==================== 枚举类型 ====================

/** 需求状态 */
export enum RequirementStatus {
  PLANNING = "planning",       // 规划中
  IN_PROGRESS = "in_progress", // 进行中
  COMPLETED = "completed",     // 已完成
  ARCHIVED = "archived",       // 已归档
}

/** 需求优先级 */
export enum RequirementPriority {
  LOW = "low",        // 低
  MEDIUM = "medium",  // 中
  HIGH = "high",      // 高
  URGENT = "urgent",  // 紧急
}

/** 需求类型 */
export enum RequirementType {
  FEATURE = "feature",            // 新功能
  OPTIMIZATION = "optimization",  // 优化
  BUGFIX = "bugfix",              // 修复
  DATA = "data",                  // 数据支持
}

/** 需求类型中文映射 */
export const REQUIREMENT_TYPE_LABELS: Record<string, string> = {
  feature: "新功能",
  optimization: "优化",
  bugfix: "修复",
  data: "数据支持",
};

/** 任务状态 */
export enum TaskStatus {
  TODO = "todo",               // 待办
  IN_PROGRESS = "in_progress", // 进行中
  REVIEW = "review",           // 待验收
  DONE = "done",               // 已完成
}

// ==================== 用户认证 ====================

/** 用户角色 */
export enum UserRole {
  CLIENT = "CLIENT",       // 需求方
  MANAGER = "MANAGER",     // 管理方
  DEVELOPER = "DEVELOPER", // 执行者
}

/** 角色中文映射 */
export const ROLE_LABELS: Record<string, string> = {
  CLIENT: "需求方",
  MANAGER: "管理方",
  DEVELOPER: "执行者",
};

/** 用户 */
export interface User {
  id: number;
  username: string;
  role: string;
  member_id: number | null;
  is_active: boolean;
  created_at: string;
}

/** 登录响应 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// ==================== 数据接口 ====================

/** 需求 */
export interface Requirement {
  id: number;
  title: string;
  description: string | null;
  department: string | null;
  doc_link: string | null;
  background: string | null;
  acceptance_criteria: string | null;
  needs_data_extraction: boolean;
  data_connection_info: string | null;
  operation_steps: string | null;
  operation_screenshots: string | null;
  version: string;
  status: RequirementStatus;
  priority: RequirementPriority;
  req_type: RequirementType;
  target_date: string | null;
  reference_links: string | null;
  created_at: string;
  updated_at: string;
  tasks: Task[];
}

/** 需求创建参数 */
export interface RequirementCreate {
  title: string;
  description?: string;
  department?: string;
  doc_link?: string;
  background?: string;
  acceptance_criteria?: string;
  needs_data_extraction?: boolean;
  data_connection_info?: string;
  operation_steps?: string;
  operation_screenshots?: string;
  version: string;
  status?: RequirementStatus;
  priority?: RequirementPriority;
  req_type?: RequirementType;
  target_date?: string;
  reference_links?: string;
}

/** 需求更新参数 */
export interface RequirementUpdate {
  title?: string;
  description?: string;
  department?: string;
  doc_link?: string;
  background?: string;
  acceptance_criteria?: string;
  needs_data_extraction?: boolean;
  data_connection_info?: string;
  operation_steps?: string;
  operation_screenshots?: string;
  version?: string;
  status?: RequirementStatus;
  priority?: RequirementPriority;
  req_type?: RequirementType;
  target_date?: string;
  reference_links?: string;
}

/** 任务 */
export interface Task {
  id: number;
  requirement_id: number;
  parent_id: number | null;
  level: number;
  title: string;
  description: string | null;
  task_type: string | null;
  assignee: string | null;
  status: TaskStatus;
  due_date: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  created_at: string;
  updated_at: string;
  children?: Task[];
}

/** 任务创建参数 */
export interface TaskCreate {
  requirement_id: number;
  parent_id?: number;
  level?: number;
  title: string;
  description?: string;
  task_type?: string;
  assignee?: string;
  status?: TaskStatus;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
}

/** 任务更新参数 */
export interface TaskUpdate {
  title?: string;
  description?: string;
  task_type?: string;
  assignee?: string;
  status?: TaskStatus;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
}

/** 任务进度 */
export interface TaskProgress {
  total: number;
  done: number;
  progress: number;
}

/** 任务类型选项 */
export const TASK_TYPES = [
  "数据爬取",
  "指标搭建",
  "统计口径优化",
  "后台功能开发",
  "功能交互优化",
] as const;

/** 需求摘要（Dashboard 用） */
export interface RequirementSummary {
  id: number;
  title: string;
  version: string;
  status: RequirementStatus;
  priority: RequirementPriority;
  total_tasks: number;
  done_tasks: number;
  progress: number;
}

/** 成员工作负荷 */
export interface MemberWorkload {
  assignee: string;
  total_tasks: number;
  todo_count: number;
  in_progress_count: number;
  review_count: number;
  done_count: number;
}

/** Dashboard 循环任务项 */
export interface DashboardRecurringItem {
  task_id: number;
  log_id: number;
  title: string;
  assignee: string | null;
  cycle: string;
  completed: boolean;
}

/** Dashboard 综合数据 */
export interface DashboardData {
  active_requirements: RequirementSummary[];
  member_workloads: MemberWorkload[];
  total_requirements: number;
  total_tasks: number;
  completion_rate: number;
  recurring_checklist: DashboardRecurringItem[];
  recurring_total: number;
  recurring_done: number;
}

// ==================== 工具类型 ====================

/** 团队成员 */
export interface Member {
  id: number;
  name: string;
  title: string | null;
  initial_password: string | null;
  username: string | null;
  system_role: string | null;
  created_at: string;
}

/** 成员角色 */
export const MEMBER_ROLES = [
  { value: "requester", label: "需求方" },
  { value: "manager", label: "管理方" },
  { value: "executor", label: "执行方" },
] as const;

/** 成员创建参数 */
export interface MemberCreate {
  name: string;
  title?: string;
  username?: string;
  password?: string;
}

/** 成员更新参数 */
export interface MemberUpdate {
  name?: string;
  title?: string;
}

/** 状态中文映射 */
export const STATUS_LABELS: Record<string, string> = {
  planning: "规划中",
  in_progress: "进行中",
  completed: "已完成",
  archived: "已归档",
  todo: "待办",
  review: "待验收",
  done: "已完成",
};

/** 优先级中文映射 */
export const PRIORITY_LABELS: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急",
};

// ==================== 循环任务 ====================

/** 循环任务 */
export interface RecurringTask {
  id: number;
  title: string;
  assignee: string | null;
  cycle: string;
  is_active: boolean;
  created_at: string;
}

/** 循环周期选项 */
export const CYCLE_OPTIONS = [
  { value: "daily", label: "每天" },
  { value: "weekly", label: "每周" },
  { value: "biweekly", label: "每两周" },
  { value: "monthly", label: "每月" },
] as const;

/** 循环周期中文映射 */
export const CYCLE_LABELS: Record<string, string> = {
  daily: "每天",
  weekly: "每周",
  biweekly: "每两周",
  monthly: "每月",
};

/** 清单项 */
export interface ChecklistItem {
  task_id: number;
  log_id: number;
  title: string;
  assignee: string | null;
  cycle: string;
  completed: boolean;
  completed_at: string | null;
  note: string | null;
}

/** 历史记录 */
export interface HistoryItem {
  date: string;
  total: number;
  done: number;
  rate: number;
}

// ==================== 评论 ====================

export interface Comment {
  id: number;
  content: string;
  author: string;
  requirement_id: number | null;
  task_id: number | null;
  created_at: string;
}

export interface CommentCreate {
  content: string;
  author: string;
  requirement_id?: number;
  task_id?: number;
}

// ==================== 对齐视图 ====================

/** 对齐视图树节点 */
export interface AlignmentTreeNode {
  id: string;
  name: string;
  node_type: "root" | "requirement" | "task_l2" | "task_l3";
  status: string | null;
  assignee: string | null;
  progress: number | null;
  total_tasks: number | null;
  done_tasks: number | null;
  children: AlignmentTreeNode[];
}

// ==================== 我的任务 ====================

export interface MyTaskItem {
  task_id: number;
  task_title: string;
  status: string;
  due_date: string | null;
  requirement_id: number;
  requirement_title: string;
  requirement_version: string;
  is_overdue: boolean;
  is_due_soon: boolean;
}

/**
 * Zustand 全局状态管理

 * 管理需求、任务和 Dashboard 的全局状态。
 * 采用 Zustand 实现简洁的状态管理，替代 Redux。
 */

import { create } from "zustand";
import { message } from "antd";
import type {
  Requirement,
  Task,
  DashboardData,
  RequirementCreate,
  RequirementUpdate,
  TaskCreate,
  TaskUpdate,
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
import { requirementApi, taskApi, dashboardApi, memberApi, recurringTaskApi, commentApi, myTaskApi } from "@/api";

// ==================== 需求 Store ====================

interface RequirementStore {
  requirements: Requirement[];
  currentRequirement: Requirement | null;
  loading: boolean;
  fetchRequirements: (params?: { status?: string; version?: string }) => Promise<void>;
  fetchRequirement: (id: number) => Promise<void>;
  createRequirement: (data: RequirementCreate) => Promise<boolean>;
  updateRequirement: (id: number, data: RequirementUpdate) => Promise<boolean>;
  deleteRequirement: (id: number) => Promise<boolean>;
}

export const useRequirementStore = create<RequirementStore>((set) => ({
  requirements: [],
  currentRequirement: null,
  loading: false,

  fetchRequirements: async (params) => {
    set({ loading: true });
    try {
      const requirements = await requirementApi.list(params);
      set({ requirements });
    } catch {
      message.error("获取需求列表失败");
    } finally {
      set({ loading: false });
    }
  },

  fetchRequirement: async (id) => {
    set({ loading: true });
    try {
      const requirement = await requirementApi.get(id);
      set({ currentRequirement: requirement });
    } catch {
      message.error("获取需求详情失败");
    } finally {
      set({ loading: false });
    }
  },

  createRequirement: async (data) => {
    try {
      await requirementApi.create(data);
      message.success("需求创建成功");
      return true;
    } catch {
      message.error("创建需求失败");
      return false;
    }
  },

  updateRequirement: async (id, data) => {
    try {
      await requirementApi.update(id, data);
      message.success("需求更新成功");
      return true;
    } catch {
      message.error("更新需求失败");
      return false;
    }
  },

  deleteRequirement: async (id) => {
    try {
      await requirementApi.delete(id);
      message.success("需求已删除");
      return true;
    } catch {
      message.error("删除需求失败");
      return false;
    }
  },
}));

// ==================== 任务 Store ====================

interface TaskStore {
  tasks: Task[];
  loading: boolean;
  fetchTasks: (params?: {
    requirement_id?: number;
    assignee?: string;
    status?: string;
  }) => Promise<void>;
  createTask: (data: TaskCreate) => Promise<boolean>;
  updateTask: (id: number, data: TaskUpdate) => Promise<boolean>;
  updateTaskStatus: (id: number, status: TaskStatus) => Promise<boolean>;
  deleteTask: (id: number) => Promise<boolean>;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  loading: false,

  fetchTasks: async (params) => {
    set({ loading: true });
    try {
      const tasks = await taskApi.list(params);
      set({ tasks });
    } catch {
      message.error("获取任务列表失败");
    } finally {
      set({ loading: false });
    }
  },

  createTask: async (data) => {
    try {
      await taskApi.create(data);
      message.success("任务创建成功");
      return true;
    } catch {
      message.error("创建任务失败");
      return false;
    }
  },

  updateTask: async (id, data) => {
    try {
      await taskApi.update(id, data);
      message.success("任务更新成功");
      return true;
    } catch {
      message.error("更新任务失败");
      return false;
    }
  },

  updateTaskStatus: async (id, status) => {
    try {
      await taskApi.updateStatus(id, status);
      message.success("状态更新成功");
      return true;
    } catch {
      message.error("更新状态失败");
      return false;
    }
  },

  deleteTask: async (id) => {
    try {
      await taskApi.delete(id);
      message.success("任务已删除");
      return true;
    } catch {
      message.error("删除任务失败");
      return false;
    }
  },
}));

// ==================== Dashboard Store ====================

interface DashboardStore {
  data: DashboardData | null;
  loading: boolean;
  fetchData: () => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  data: null,
  loading: false,

  fetchData: async () => {
    set({ loading: true });
    try {
      const data = await dashboardApi.getData();
      set({ data });
    } catch {
      message.error("获取 Dashboard 数据失败");
    } finally {
      set({ loading: false });
    }
  },
}));

// ==================== 成员 Store ====================

interface MemberStore {
  members: Member[];
  loading: boolean;
  fetchMembers: () => Promise<void>;
  createMember: (data: MemberCreate) => Promise<boolean>;
  updateMember: (id: number, data: MemberUpdate) => Promise<boolean>;
  deleteMember: (id: number) => Promise<boolean>;
}

export const useMemberStore = create<MemberStore>((set, get) => ({
  members: [],
  loading: false,

  fetchMembers: async () => {
    set({ loading: true });
    try {
      const members = await memberApi.list();
      set({ members });
    } catch {
      message.error("获取成员列表失败");
    } finally {
      set({ loading: false });
    }
  },

  createMember: async (data) => {
    try {
      await memberApi.create(data);
      message.success("成员添加成功");
      await get().fetchMembers();
      return true;
    } catch {
      message.error("添加成员失败");
      return false;
    }
  },

  updateMember: async (id, data) => {
    try {
      await memberApi.update(id, data);
      message.success("成员更新成功");
      await get().fetchMembers();
      return true;
    } catch {
      message.error("更新成员失败");
      return false;
    }
  },

  deleteMember: async (id) => {
    try {
      await memberApi.delete(id);
      message.success("成员已删除");
      await get().fetchMembers();
      return true;
    } catch {
      message.error("删除成员失败");
      return false;
    }
  },
}));

// ==================== 循环任务 Store ====================

interface RecurringTaskStore {
  checklist: ChecklistItem[];
  tasks: RecurringTask[];
  history: HistoryItem[];
  loading: boolean;
  fetchChecklist: (dateStr?: string) => Promise<void>;
  fetchTasks: () => Promise<void>;
  fetchHistory: (days?: number) => Promise<void>;
  toggleTask: (logId: number) => Promise<boolean>;
  createTask: (title: string, cycle: string, assignee?: string) => Promise<boolean>;
  deleteTask: (id: number) => Promise<boolean>;
  updateTask: (id: number, data: { title?: string; assignee?: string; cycle?: string; is_active?: boolean }) => Promise<boolean>;
}

export const useRecurringTaskStore = create<RecurringTaskStore>((set, get) => ({
  checklist: [],
  tasks: [],
  history: [],
  loading: false,

  fetchChecklist: async (dateStr) => {
    set({ loading: true });
    try {
      const checklist = await recurringTaskApi.getChecklist(dateStr);
      set({ checklist });
    } catch {
      message.error("获取清单失败");
    } finally {
      set({ loading: false });
    }
  },

  fetchTasks: async () => {
    try {
      const tasks = await recurringTaskApi.list();
      set({ tasks });
    } catch {
      message.error("获取循环任务失败");
    }
  },

  fetchHistory: async (days = 14) => {
    try {
      const history = await recurringTaskApi.getHistory(days);
      set({ history });
    } catch {
      message.error("获取历史记录失败");
    }
  },

  toggleTask: async (logId) => {
    try {
      await recurringTaskApi.toggleTask(logId);
      const { fetchChecklist } = get();
      await fetchChecklist();
      return true;
    } catch {
      message.error("更新状态失败");
      return false;
    }
  },

  createTask: async (title, cycle, assignee) => {
    try {
      await recurringTaskApi.create({ title, cycle, assignee });
      message.success("创建成功");
      return true;
    } catch {
      message.error("创建失败");
      return false;
    }
  },

  deleteTask: async (id) => {
    try {
      await recurringTaskApi.delete(id);
      message.success("已删除");
      return true;
    } catch {
      message.error("删除失败");
      return false;
    }
  },

  updateTask: async (id, data) => {
    try {
      await recurringTaskApi.update(id, data);
      message.success("更新成功");
      return true;
    } catch {
      message.error("更新失败");
      return false;
    }
  },
}));

// ==================== 评论 Store ====================

interface CommentStore {
  comments: Comment[];
  loading: boolean;
  fetchComments: (params?: { requirement_id?: number; task_id?: number }) => Promise<void>;
  createComment: (data: CommentCreate) => Promise<boolean>;
  deleteComment: (id: number) => Promise<boolean>;
}

export const useCommentStore = create<CommentStore>((set) => ({
  comments: [],
  loading: false,

  fetchComments: async (params) => {
    set({ loading: true });
    try {
      const comments = await commentApi.list(params);
      set({ comments });
    } catch {
      message.error("获取评论失败");
    } finally {
      set({ loading: false });
    }
  },

  createComment: async (data) => {
    try {
      await commentApi.create(data);
      message.success("评论成功");
      return true;
    } catch {
      message.error("评论失败");
      return false;
    }
  },

  deleteComment: async (id) => {
    try {
      await commentApi.delete(id);
      message.success("已删除");
      return true;
    } catch {
      message.error("删除失败");
      return false;
    }
  },
}));

// ==================== 我的任务 Store ====================

interface MyTaskStore {
  tasks: MyTaskItem[];
  loading: boolean;
  fetchMyTasks: (assignee: string) => Promise<void>;
}

export const useMyTaskStore = create<MyTaskStore>((set) => ({
  tasks: [],
  loading: false,

  fetchMyTasks: async (assignee) => {
    set({ loading: true });
    try {
      const tasks = await myTaskApi.list(assignee);
      set({ tasks });
    } catch {
      message.error("获取我的任务失败");
    } finally {
      set({ loading: false });
    }
  },
}));

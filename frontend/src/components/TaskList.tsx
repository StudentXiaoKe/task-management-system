/**
 * 任务管理页面（三级任务架构 - 树形展示）

 * - API 返回树形数据（二级嵌套三级）
 * - 看板只显示二级任务
 * - 列表模式支持展开/折叠三级子任务
 * - 三级任务在展开行内以卡片形式展示
 * - 支持快速创建三级任务和状态流转
 */

import { useEffect, useState, useMemo } from "react";
import {
  Card, Checkbox, Table, Button, Tag, Space, Modal, Form, Input, Select, Popconfirm,
  Row, Col, Badge, Empty, DatePicker, Tooltip, Drawer, Divider, Progress,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, ClockCircleOutlined,
  SyncOutlined, FileSearchOutlined, CaretDownOutlined, CaretRightOutlined,
  LinkOutlined, ApartmentOutlined, UserOutlined, CheckOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useTaskStore, useRequirementStore, useMemberStore, useAuthStore } from "@/store";
import { TaskStatus, STATUS_LABELS, TASK_TYPES } from "@/types";
import type { Task, TaskCreate } from "@/types";
import TaskComments from "./TaskComments";

const STATUS_TRANSITIONS: Record<string, string[]> = {
  todo: ["in_progress"],
  in_progress: ["review"],
  review: ["done", "in_progress"],
  done: [],
};

const STATUS_COLOR: Record<string, string> = {
  todo: "default", in_progress: "processing", review: "warning", done: "success",
};

const STATUS_CFG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  todo:        { color: "#8c8c8c", bg: "#f5f5f5", icon: <ClockCircleOutlined />,  label: "待办" },
  in_progress: { color: "#1677ff", bg: "#e6f4ff", icon: <SyncOutlined />,         label: "进行中" },
  review:      { color: "#faad14", bg: "#fffbe6", icon: <FileSearchOutlined />,   label: "待验收" },
  done:        { color: "#52c41a", bg: "#f6ffed", icon: <CheckCircleOutlined />,  label: "已完成" },
};

const KANBAN_COLUMNS = [
  { key: "todo", title: "待办", color: "#d9d9d9" },
  { key: "in_progress", title: "进行中", color: "#1677ff" },
  { key: "review", title: "待验收", color: "#faad14" },
  { key: "done", title: "已完成", color: "#52c41a" },
];

export default function TaskList() {
  const { user } = useAuthStore();
  const isManager = user?.role === "MANAGER";
  const isDeveloper = user?.role === "DEVELOPER";
  const {
    tasks, loading, fetchTasks, createTask, updateTask, updateTaskStatus, deleteTask,
  } = useTaskStore();
  const { requirements, fetchRequirements } = useRequirementStore();
  const { members, fetchMembers } = useMemberStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Task | null>(null);
  // 只看我的任务过滤
  const [showMyOnly, setShowMyOnly] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterAssignee, setFilterAssignee] = useState<string | undefined>();
  const [filterRequirement, setFilterRequirement] = useState<number | undefined>();
  const [filterDepartment, setFilterDepartment] = useState<string | undefined>();
  const [subTaskModalOpen, setSubTaskModalOpen] = useState(false);
  const [subTaskParentId, setSubTaskParentId] = useState<number | null>(null);
  const [subTaskReqId, setSubTaskReqId] = useState<number | null>(null);
  const [subTaskParentAssignee, setSubTaskParentAssignee] = useState<string>("");
  // 泳道折叠状态（Set 存储已折叠的需求 ID）
  const [collapsedReqIds, setCollapsedReqIds] = useState<Set<number>>(new Set());
  // 表格展开行
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

  /* Epic 上下文预览 */
  const [epicDrawerOpen, setEpicDrawerOpen] = useState(false);
  const [selectedEpicId, setSelectedEpicId] = useState<number | null>(null);

  const currentEpic = useMemo(
    () => selectedEpicId ? requirements.find(r => r.id === selectedEpicId) : null,
    [selectedEpicId, requirements],
  );
  const [form] = Form.useForm();
  const [subForm] = Form.useForm();

  useEffect(() => {
    fetchTasks({ level: 2 });
    fetchRequirements();
    fetchMembers();
  }, [fetchTasks, fetchRequirements, fetchMembers]);

  /** 辅助函数：递归展平任务树 */
  const flattenTasks = (tasks: Task[]): (Task & { _reqTitle?: string; _parentTitle?: string })[] => {
    const result: (Task & { _reqTitle?: string; _parentTitle?: string })[] = [];
    const walk = (taskList: Task[], reqTitle?: string, parentTitle?: string) => {
      taskList.forEach((t) => {
        result.push({ ...t, _reqTitle: reqTitle, _parentTitle: parentTitle });
        if (t.children && t.children.length > 0) {
          walk(t.children, reqTitle, t.title);
        }
      });
    };
    walk(tasks);
    return result;
  };

  /** 辅助函数：计算任务进度 */
  const calculateProgress = (tasks: Task[]) => {
    const total = tasks.length;
    if (total === 0) return 0;
    const done = tasks.filter((t) => t.status === "done").length;
    return Math.round((done / total) * 100);
  };

  /** 辅助函数：切换需求折叠状态 */
  const toggleRequirementCollapse = (reqId: number) => {
    setCollapsedReqIds((prev) => {
      const next = new Set(prev);
      if (next.has(reqId)) {
        next.delete(reqId);
      } else {
        next.add(reqId);
      }
      return next;
    });
  };

  /** 按需求分组的数据（泳道视图）- 支持"只看我"过滤 */
  const requirementsWithTasks = useMemo(() => {
    return requirements
      .filter((req) => req.tasks && req.tasks.length > 0)
      .map((req) => {
        const allTasks = flattenTasks(req.tasks || []);
        // 应用"只看我"过滤
        const filteredAllTasks = showMyOnly && user
          ? allTasks.filter((t) => t.assignee === user.username)
          : allTasks;
        return {
          id: req.id,
          title: req.title,
          version: req.version,
          status: req.status,
          priority: req.priority,
          department: req.department,
          progress: calculateProgress(filteredAllTasks),
          totalTasks: filteredAllTasks.length,
          doneTasks: filteredAllTasks.filter((t) => t.status === "done").length,
          // 看板列只渲染二级任务，三级任务由卡片内嵌展示
          todo: filteredAllTasks.filter((t) => t.status === "todo" && t.level === 2),
          in_progress: filteredAllTasks.filter((t) => t.status === "in_progress" && t.level === 2),
          review: filteredAllTasks.filter((t) => t.status === "review" && t.level === 2),
          done: filteredAllTasks.filter((t) => t.status === "done" && t.level === 2),
        };
      })
      .filter((req) => {
        // 应用其他筛选器
        if (filterRequirement && req.id !== filterRequirement) return false;
        if (filterDepartment && req.department !== filterDepartment) return false;
        // 如果启用"只看我"且该需求无任务，过滤掉
        if (showMyOnly && req.totalTasks === 0) return false;
        return true;
      });
  }, [requirements, filterRequirement, filterDepartment, showMyOnly, user]);

  /** 打开创建/编辑二级任务弹窗 */
  const openModal = (item?: Task) => {
    setEditItem(item || null);
    form.resetFields();
    if (item) {
      form.setFieldsValue({
        requirement_id: item.requirement_id,
        title: item.title,
        description: item.description,
        task_type: item.task_type,
        assignee: item.assignee,
        status: item.status,
        due_date: item.due_date ? dayjs(item.due_date) : undefined,
      });
    }
    setModalOpen(true);
  };

  /** 提交二级任务 */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: Record<string, unknown> = {
        requirement_id: values.requirement_id, level: 2,
        title: values.title, description: values.description,
        task_type: values.task_type, assignee: values.assignee, status: values.status,
      };
      if (values.due_date?.format) payload.due_date = values.due_date.format("YYYY-MM-DDTHH:mm:ss");
      const ok = editItem ? await updateTask(editItem.id, payload) : await createTask(payload as unknown as TaskCreate);
      if (ok) { setModalOpen(false); fetchTasks({ level: 2 }); fetchRequirements(); }
    } catch {}
  };

  /** 打开创建三级任务弹窗（自动继承父任务负责人） */
  const openSubTaskModal = (parentId: number, reqId: number, parentAssignee?: string) => {
    setSubTaskParentId(parentId);
    setSubTaskReqId(reqId);
    setSubTaskParentAssignee(parentAssignee || "");
    subForm.resetFields();
    setSubTaskModalOpen(true);
  };

  /** 提交三级任务 */
  const handleSubTaskSubmit = async () => {
    try {
      const values = await subForm.validateFields();
      const payload: Record<string, unknown> = {
        requirement_id: subTaskReqId, parent_id: subTaskParentId, level: 3,
        title: values.title, description: values.description,
        task_type: values.task_type,
        status: TaskStatus.TODO, estimated_hours: values.estimated_hours,
      };
      const ok = await createTask(payload as unknown as TaskCreate);
      if (ok) { setSubTaskModalOpen(false); fetchTasks({ level: 2 }); fetchRequirements(); }
    } catch (err: any) {
      // 后端 403/400 错误会被 store 层 message.error 展示，这里只处理表单校验失败
      if (err?.errorFields) return; // AntD 表单校验失败，无需额外处理
    }
  };

  const handleDelete = async (id: number) => {
    if (await deleteTask(id)) { fetchTasks({ level: 2 }); fetchRequirements(); }
  };

  const handleStatusChange = async (taskId: number, newStatus: TaskStatus) => {
    await updateTaskStatus(taskId, newStatus);
    fetchTasks({ level: 2 }); fetchRequirements();
  };

  /** 计算二级任务进度 */
  const getProgress = (task: Task) => {
    const children = task.children || [];
    const total = children.length;
    const done = children.filter((c) => c.status === "done").length;
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  /** 快速完成任务 */
  const quickComplete = async (task: Task) => {
    await handleStatusChange(task.id, TaskStatus.DONE);
  };

  /** 看板卡片 */
  /** 看板卡片层级配置 */
  const LEVEL_CFG: Record<number, {
    badge: string; color: string; bgBorder: string; shadow: string; fontSize: number; titleSize: number;
  }> = {
    2: { badge: "📦 Task", color: "#fa8c16", bgBorder: "#fa8c16", shadow: "none", fontSize: 12, titleSize: 13 },
    3: { badge: "✅ Sub-task", color: "#8c8c8c", bgBorder: "#f0f0f0", shadow: "none", fontSize: 11, titleSize: 12 },
  };

  /** 极简任务卡片（泳道和我的任务视图） */
  const MinimalTaskCard = ({
    task,
    showBreadcrumb = false,
    onClick,
  }: {
    task: Task & { _reqTitle?: string; _parentTitle?: string };
    showBreadcrumb?: boolean;
    onClick?: () => void;
  }) => {
    const [hovered, setHovered] = useState(false);
    const statusColor = STATUS_CFG[task.status]?.color || "#8c8c8c";

    return (
      <div
        style={{
          padding: "10px 12px",
          marginBottom: 6,
          background: "#fff",
          borderRadius: 8,
          border: "1px solid #f0f0f0",
          cursor: "pointer",
          transition: "all 0.2s",
          boxShadow: hovered ? "0 2px 8px rgba(0,0,0,0.1)" : "0 1px 2px rgba(0,0,0,0.05)",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onClick}
      >
        {/* 标题行 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: statusColor,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              flex: 1,
              fontSize: 13,
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {task.title}
          </span>
          {/* 子任务进度微标 */}
          {task.level === 2 && (() => {
            const ch = task.children || [];
            if (ch.length === 0) return null;
            const d = ch.filter((c) => c.status === "done").length;
            return (
              <span style={{
                fontSize: 11, fontWeight: 600, flexShrink: 0, padding: "1px 6px",
                borderRadius: 10, lineHeight: "18px",
                color: d === ch.length ? "#52c41a" : "#1677ff",
                background: d === ch.length ? "#f6ffed" : "#e6f4ff",
              }}>
                ✅ {d}/{ch.length}
              </span>
            );
          })()}
        </div>

        {/* 面包屑（我的任务视图） */}
        {showBreadcrumb && task._reqTitle && (
          <div
            style={{
              fontSize: 11,
              color: "#8c8c8c",
              marginTop: 6,
              marginLeft: 16,
              padding: "4px 8px",
              background: "#f5f5f5",
              borderRadius: 4,
              display: "inline-block",
            }}
          >
            📦 {task._reqTitle}
          </div>
        )}

        {/* 悬浮操作栏 */}
        {hovered && (
          <div
            style={{
              display: "flex",
              gap: 4,
              marginTop: 8,
              marginLeft: 16,
              paddingTop: 8,
              borderTop: "1px solid #f0f0f0",
            }}
          >
            <Tooltip title="编辑">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  openModal(task);
                }}
                style={{ padding: "4px 8px" }}
              />
            </Tooltip>
            {task.status !== "done" && (
              <Tooltip title="快速完成">
                <Button
                  type="text"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    quickComplete(task);
                  }}
                  style={{ padding: "4px 8px", color: "#52c41a" }}
                />
              </Tooltip>
            )}
            <Tooltip title="新建子任务">
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  openSubTaskModal(task.id, task.requirement_id, task.assignee || undefined);
                }}
                style={{ padding: "4px 8px" }}
              />
            </Tooltip>
          </div>
        )}

        {/* 负责人行 */}
        <div style={{ marginTop: 6, marginLeft: 16 }}>
          <span style={{ fontSize: 12, color: "#8c8c8c" }}>
            {task.assignee || "未分配"}
          </span>
        </div>

        {/* 二级卡片：内嵌子任务清单 */}
        {task.level === 2 && (task.children?.length || isDeveloper || isManager) && (
          <div
            style={{
              marginTop: 8, marginLeft: 14, marginRight: 14,
              border: "1px dashed #d9d9d9", borderRadius: 6,
              padding: (task.children?.length ?? 0) > 0 ? "6px 10px 4px" : "4px 10px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(task.children || []).map((child) => {
              const isDone = child.status === "done";
              return (
                <div
                  key={child.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "4px 0",
                  }}
                >
                  <Checkbox
                    checked={isDone}
                    onChange={(e) => {
                      handleStatusChange(
                        child.id,
                        (e.target.checked ? "done" : "in_progress") as TaskStatus,
                      );
                    }}
                  />
                  <span
                    style={{
                      flex: 1, fontSize: 12,
                      color: isDone ? "#9ca3af" : "#374151",
                      textDecoration: isDone ? "line-through" : "none",
                      cursor: "pointer",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}
                    onClick={() => openModal(child)}
                  >
                    {child.title}
                  </span>
                  {child.assignee && (
                    <span style={{
                      fontSize: 10, color: "#ffffff", background: "#bfbfbf",
                      borderRadius: 10, padding: "0 6px", lineHeight: "18px",
                      flexShrink: 0,
                    }}>
                      {child.assignee}
                    </span>
                  )}
                </div>
              );
            })}
            {(isDeveloper || isManager) && (
              <div style={{ marginTop: (task.children?.length ?? 0) > 0 ? 4 : 0 }}>
                <Button
                  type="dashed" size="small" block
                  icon={<PlusOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    openSubTaskModal(task.id, task.requirement_id, task.assignee || undefined);
                  }}
                  style={{ fontSize: 11, height: 26 }}
                >
                  添加行动计划
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderKanbanCard = (task: Task & { _reqTitle?: string; _parentTitle?: string }) => {
    const today = dayjs().startOf("day");
    const isOverdue = task.due_date && task.status !== "done" && dayjs(task.due_date).isBefore(today);
    const isDueSoon = task.due_date && task.status !== "done" && !isOverdue && dayjs(task.due_date).diff(today, "day") <= 3;
    const { total, done, pct } = getProgress(task);
    const lvl = LEVEL_CFG[task.level] || LEVEL_CFG[2];
    const parentLabel = task.level === 3
      ? task._parentTitle || ""
      : task._reqTitle || "";

    return (
      <Card key={task.id} size="small"
        style={{
          marginBottom: 8, cursor: "pointer",
          borderColor: isOverdue ? "#ffccc7" : isDueSoon ? "#ffe58f" : undefined,
          borderLeft: `3px solid ${lvl.color}`,
          borderRadius: 8,
          boxShadow: task.level === 2 ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
          opacity: task.level === 3 ? 0.92 : 1,
        }}
        hoverable onClick={() => openModal(task)}>
        {/* 层级标签 + 标题 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <Tag color={lvl.color} style={{ margin: 0, fontSize: 10, lineHeight: "16px", padding: "0 4px", marginRight: 0 }}>
            {lvl.badge}
          </Tag>
          <span style={{ fontWeight: 600, fontSize: lvl.titleSize, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {task.title}
          </span>
        </div>

        {/* 父级上下文 */}
        {parentLabel && (
          <div style={{ fontSize: 11, color: "#999", marginBottom: 4, paddingLeft: 2 }}>
            {task.level === 3 ? "↑ " : "🔗 "}{parentLabel}
          </div>
        )}

        {task.task_type && <Tag style={{ fontSize: 11, marginBottom: 4 }}>{task.task_type}</Tag>}
        {total > 0 && (
          <div style={{ marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ flex: 1, height: 4, background: "#f0f0f0", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#52c41a" : "#1677ff", borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 11, color: "#999" }}>{done}/{total}</span>
            </div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#666" }}>{task.assignee || "未分配"}</span>
          {task.due_date && (
            <span style={{ fontSize: 11, color: isOverdue ? "#ff4d4f" : isDueSoon ? "#faad14" : "#999" }}>
              {isOverdue && "⚠ "}{dayjs(task.due_date).format("MM-DD")}
            </span>
          )}
        </div>
      </Card>
    );
  };

  /** 展开行渲染（三级子任务） */
  const expandedRowRender = (record: Task & { _reqTitle?: string; _reqVersion?: string }) => {
    const children = record.children || [];
    return (
      <div style={{ padding: "8px 0", background: "#fafafa", borderRadius: 8 }}>
        {children.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 16px" }}>
            {children.map((child) => {
              const cfg = STATUS_CFG[child.status] || STATUS_CFG.todo;
              const nextMap: Record<string, string> = { todo: "in_progress", in_progress: "done" };
              const nextStatus = nextMap[child.status];
              return (
                <div key={child.id} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                  background: "#fff", borderRadius: 6, border: "1px solid #f0f0f0",
                  borderLeft: `3px solid ${cfg.color}`,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 13, fontWeight: 500,
                      textDecoration: child.status === "done" ? "line-through" : "none",
                      color: child.status === "done" ? "#bbb" : "#262626",
                    }}>{child.title}</span>
                    {child.assignee && <span style={{ fontSize: 11, color: "#999", marginLeft: 8 }}>{child.assignee}</span>}
                    {child.task_type && <Tag style={{ fontSize: 11, marginLeft: 4 }}>{child.task_type}</Tag>}
                    {child.estimated_hours ? <span style={{ fontSize: 11, color: "#bbb", marginLeft: 8 }}>{child.estimated_hours}h</span> : null}
                  </div>
                  {nextStatus && (
                    <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }}
                      onClick={() => handleStatusChange(child.id, nextStatus as TaskStatus)}>
                      {STATUS_LABELS[nextStatus]} →
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 16, color: "#bbb" }}>暂无行动计划</div>
        )}
        <div style={{ padding: "8px 16px" }}>
          <Button type="dashed" size="small" icon={<PlusOutlined />} block
            onClick={() => openSubTaskModal(record.id, record.requirement_id, record.assignee ?? undefined)}>
            添加行动计划
          </Button>
        </div>
      </div>
    );
  };

  /** 表格列定义 */
  const columns = [
    {
      title: "", width: 40,
      render: (_: unknown, record: Task) => {
        const hasChildren = (record.children || []).length > 0;
        if (!hasChildren) return <span style={{ width: 14, display: "inline-block" }} />;
        const expanded = expandedRowKeys.includes(record.id);
        return (
          <span style={{ cursor: "pointer" }}
            onClick={() => setExpandedRowKeys(expanded ? expandedRowKeys.filter((k) => k !== record.id) : [...expandedRowKeys, record.id])}>
            {expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
          </span>
        );
      },
    },
    { title: "执行任务", dataIndex: "title", key: "title", width: 180 },
    {
      title: "类型", dataIndex: "task_type", key: "task_type", width: 120,
      render: (v: string) => v ? <Tag>{v}</Tag> : <span style={{ color: "#999" }}>-</span>,
    },
    {
      title: "所属需求", key: "requirement", width: 130,
      render: (_: unknown, record: Task & { _reqTitle?: string }) => {
        const title = record._reqTitle || requirements.find((r) => r.id === record.requirement_id)?.title;
        return title ? <Tooltip title={title}><Tag color="blue" style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</Tag></Tooltip> : "-";
      },
    },
    {
      title: "负责人", dataIndex: "assignee", key: "assignee", width: 90,
      render: (v: string) => v || <span style={{ color: "#999" }}>未分配</span>,
    },
    {
      title: "状态", dataIndex: "status", key: "status", width: 90,
      render: (s: string) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABELS[s]}</Tag>,
    },
    {
      title: "子任务进度", key: "progress", width: 150,
      render: (_: unknown, record: Task) => {
        const { total, done, pct } = getProgress(record);
        return total > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: 6, background: "#f0f0f0", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#52c41a" : "#1677ff", borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 12, color: "#666", whiteSpace: "nowrap" }}>{done}/{total}</span>
          </div>
        ) : <span style={{ fontSize: 12, color: "#bbb" }}>-</span>;
      },
    },
    {
      title: "操作", key: "action", width: 220,
      render: (_: unknown, record: Task) => (
        <Space>
          {STATUS_TRANSITIONS[record.status]?.map((next) => (
            <Button key={next} type="link" size="small"
              onClick={() => handleStatusChange(record.id, next as TaskStatus)}>
              移至{STATUS_LABELS[next]}
            </Button>
          ))}
          {/* 上帝模式：DEVELOPER 和 MANAGER 都可以创建子任务 */}
          {(isDeveloper || isManager) && (
            <Button type="link" size="small" icon={<PlusOutlined />}
              onClick={() => openSubTaskModal(record.id, record.requirement_id)}>
              子任务
            </Button>
          )}
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)} />
          <Popconfirm title="确定删除？" description="将同时删除所有子任务"
            onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 顶部操作栏 */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Space wrap>
            <Select placeholder="按需求筛选" allowClear style={{ width: 180 }}
              value={filterRequirement} onChange={setFilterRequirement}
              showSearch optionFilterProp="label"
              options={requirements.map((r) => ({ value: r.id, label: `${r.title} (${r.version})` }))} />
            <Select placeholder="按状态筛选" allowClear style={{ width: 130 }}
              value={filterStatus} onChange={setFilterStatus}>
              <Select.Option value="todo">待办</Select.Option>
              <Select.Option value="in_progress">进行中</Select.Option>
              <Select.Option value="review">待验收</Select.Option>
              <Select.Option value="done">已完成</Select.Option>
            </Select>
            <Select placeholder="按成员筛选" allowClear style={{ width: 130 }}
              value={filterAssignee} onChange={setFilterAssignee}>
              {members.map((m) => <Select.Option key={m.name} value={m.name}>{m.name}</Select.Option>)}
            </Select>
            <Select placeholder="按部门筛选" allowClear style={{ width: 130 }}
              value={filterDepartment} onChange={setFilterDepartment}>
              {[...new Set(requirements.map((r) => r.department).filter(Boolean))].map((d) =>
                <Select.Option key={d} value={d}>{d}</Select.Option>)}
            </Select>
          </Space>
          <Space>
            {/* 只看我的任务过滤 */}
            <Button
              type={showMyOnly ? "primary" : "default"}
              icon={<UserOutlined />}
              onClick={() => setShowMyOnly(!showMyOnly)}
              size="small"
            >
              只看我的任务
            </Button>
            {isManager && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>新建执行任务</Button>
            )}
          </Space>
        </div>
      </Card>


      {/* 泳道视图（统一视图） */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {requirementsWithTasks.length === 0 ? (
          <Empty description="暂无需求数据" />
        ) : (
          requirementsWithTasks.map((req) => (
            <div
              key={req.id}
              style={{
                background: "#fff",
                borderRadius: 8,
                border: "1px solid #f0f0f0",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: "#fafafa",
                  borderBottom: "1px solid #f0f0f0",
                  gap: 12,
                  cursor: "pointer",
                }}
                onClick={() => toggleRequirementCollapse(req.id)}
              >
                <Button
                  type="text"
                  size="small"
                  icon={collapsedReqIds.has(req.id) ? <CaretRightOutlined /> : <CaretDownOutlined />}
                  style={{ padding: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{req.title}</div>
                  <div style={{ fontSize: 12, color: "#8c8c8c", marginTop: 2 }}>
                    {req.version} · {req.doneTasks}/{req.totalTasks} 已完成
                  </div>
                </div>
                <Progress
                  percent={req.progress}
                  size="small"
                  style={{ width: 120 }}
                  strokeColor={req.progress === 100 ? "#52c41a" : "#1677ff"}
                />
              </div>

              {!collapsedReqIds.has(req.id) && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
                  {KANBAN_COLUMNS.map((col) => (
                    <div
                      key={col.key}
                      style={{
                        padding: 12,
                        borderRight: "1px solid #f0f0f0",
                        minHeight: 100,
                        background: "#fafafa",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#8c8c8c", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                        {col.title}
                        <Badge count={(req[col.key as keyof typeof req] as any[])?.length || 0} style={{ backgroundColor: col.color }} size="small" />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                        {(req[col.key as keyof typeof req] as any[])?.map((task: any) => (
                          <MinimalTaskCard key={task.id} task={task} onClick={() => openModal(task)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      {/* 二级任务弹窗 */}
      <Modal title={editItem ? "编辑执行任务" : "新建执行任务"} open={modalOpen}
        onOk={handleSubmit} onCancel={() => setModalOpen(false)}
        okText="保存" cancelText="取消" width={560}>
        <Form form={form} layout="vertical" initialValues={{ status: TaskStatus.TODO }}>
          <Form.Item name="requirement_id" label="所属需求" rules={[{ required: true, message: "请选择需求" }]}>
            <Select placeholder="选择需求" showSearch optionFilterProp="label"
              options={requirements.map((r) => ({ value: r.id, label: `${r.title} (${r.version})` }))} />
          </Form.Item>
          {editItem?.requirement_id && (
            <div style={{ marginTop: -12, marginBottom: 12 }}>
              <Tag
                color="blue"
                icon={<LinkOutlined />}
                style={{ cursor: "pointer", fontSize: 12 }}
                onClick={() => { setSelectedEpicId(editItem.requirement_id); setEpicDrawerOpen(true); }}
              >
                查看需求详情
              </Tag>
            </div>
          )}
          <Form.Item name="title" label="任务标题" rules={[{ required: true, message: "请输入标题" }]}>
            <Input placeholder="请输入执行任务标题" maxLength={200} />
          </Form.Item>
          <Form.Item name="description" label="任务描述">
            <Input.TextArea placeholder="请输入描述" rows={2} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="task_type" label="任务类型">
                <Select placeholder="选择类型" allowClear>
                  {TASK_TYPES.map((t) => <Select.Option key={t} value={t}>{t}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assignee" label="负责人">
                <Select placeholder="选择负责人" allowClear>
                  {members.map((m) => <Select.Option key={m.name} value={m.name}>{m.name}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="状态">
                <Select>
                  {Object.entries(STATUS_LABELS).filter(([k]) => ["todo", "in_progress", "review", "done"].includes(k))
                    .map(([v, l]) => <Select.Option key={v} value={v}>{l}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="due_date" label="截止日期">
                <DatePicker style={{ width: "100%" }} placeholder="选择截止日期" />
              </Form.Item>
            </Col>
          </Row>
          {editItem && (
            <>
              {/* 二级任务：添加行动计划入口 */}
              {editItem.level === 2 && (isDeveloper || isManager) && (
                <div style={{ marginBottom: 16 }}>
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    block
                    onClick={() => {
                      setModalOpen(false);
                      openSubTaskModal(editItem.id, editItem.requirement_id, editItem.assignee || undefined);
                    }}
                  >
                    添加行动计划（三级任务）
                  </Button>
                </div>
              )}
              <TaskComments taskId={editItem.id} />
            </>
          )}
        </Form>
      </Modal>

      {/* ==================== 三级任务弹窗 ==================== */}
      <Modal title="添加行动计划（三级任务）" open={subTaskModalOpen}
        onOk={handleSubTaskSubmit} onCancel={() => setSubTaskModalOpen(false)}
        okText="创建" cancelText="取消" width={480}>
        <Form form={subForm} layout="vertical">
          {subTaskReqId && (
            <div style={{ marginBottom: 8 }}>
              <Tag
                color="blue"
                icon={<LinkOutlined />}
                style={{ cursor: "pointer", fontSize: 12 }}
                onClick={() => { setSelectedEpicId(subTaskReqId); setEpicDrawerOpen(true); }}
              >
                {requirements.find(r => r.id === subTaskReqId)?.title || "查看所属需求详情"}
              </Tag>
            </div>
          )}
          <Form.Item name="title" label="行动项" rules={[{ required: true, message: "请输入行动项" }]}>
            <Input placeholder="如：完成接口开发、编写单元测试" maxLength={200} />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea placeholder="具体行动内容" rows={2} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="task_type" label="类型">
                <Select placeholder="选择类型" allowClear>
                  {TASK_TYPES.map((t) => <Select.Option key={t} value={t}>{t}</Select.Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="负责人">
                <Input
                  value={subTaskParentAssignee || "自动继承父任务负责人"}
                  disabled
                  style={{ color: "#8c8c8c", cursor: "default" }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="estimated_hours" label="预估工时（小时）">
            <Input type="number" placeholder="如：4" min={0} step={0.5} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ==================== Epic 上下文只读预览 Drawer ==================== */}
      <Drawer
        title={
          currentEpic
            ? <span>🏷️ {currentEpic.title} <Tag style={{ marginLeft: 8 }}>{currentEpic.version}</Tag></span>
            : "需求详情"
        }
        open={epicDrawerOpen}
        onClose={() => setEpicDrawerOpen(false)}
        width={460}
        styles={{ body: { paddingTop: 16 } }}
      >
        {currentEpic ? (
          <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8 }}>

            {/* ===== 区块 A：头部分类属性 ===== */}
            <div style={{
              background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8,
              padding: "14px 16px", marginBottom: 16,
            }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <Tag color={
                  currentEpic.status === "completed" ? "green" :
                  currentEpic.status === "in_progress" ? "blue" :
                  currentEpic.status === "archived" ? "default" : "gold"
                }>
                  {STATUS_LABELS[currentEpic.status] || currentEpic.status}
                </Tag>
                {currentEpic.priority && (
                  <Tag color={
                    currentEpic.priority === "urgent" ? "red" :
                    currentEpic.priority === "high" ? "orange" :
                    currentEpic.priority === "medium" ? "blue" : "default"
                  }>
                    {currentEpic.priority.toUpperCase()}
                  </Tag>
                )}
                {currentEpic.req_type && (
                  <Tag color={
                    currentEpic.req_type === "feature" ? "blue" :
                    currentEpic.req_type === "optimization" ? "cyan" :
                    currentEpic.req_type === "bugfix" ? "red" : "purple"
                  }>
                    {{ feature: "新功能", optimization: "优化", bugfix: "修复", data: "数据支持" }[currentEpic.req_type] || currentEpic.req_type}
                  </Tag>
                )}
              </div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", color: "#6b7280", fontSize: 12 }}>
                {currentEpic.department && <span>🏢 {currentEpic.department}</span>}
                {currentEpic.target_date && <span>📅 {currentEpic.target_date}</span>}
              </div>
            </div>

            {/* ===== 区块 B：业务详情 ===== */}
            {(currentEpic.background || currentEpic.acceptance_criteria || currentEpic.doc_link || currentEpic.reference_links) && (
              <div style={{
                background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
                padding: "14px 16px", marginBottom: 16,
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#111827", marginBottom: 10 }}>业务详情</div>

                {currentEpic.background && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>业务背景与目标</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{currentEpic.background}</div>
                  </div>
                )}

                {currentEpic.acceptance_criteria && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>验收标准</div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{currentEpic.acceptance_criteria}</div>
                  </div>
                )}

                {currentEpic.doc_link && (
                  <div style={{ marginBottom: currentEpic.reference_links ? 12 : 0 }}>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>主文档</div>
                    <a href={currentEpic.doc_link} target="_blank" rel="noreferrer"
                      style={{ wordBreak: "break-all" }}>
                      <LinkOutlined /> {currentEpic.doc_link}
                    </a>
                  </div>
                )}

                {currentEpic.reference_links && (() => {
                  const links = (() => { try { return JSON.parse(currentEpic.reference_links!); } catch { return []; } })();
                  return links.length > 0 ? (
                    <div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>参考链接</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {links.map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer"
                            style={{ fontSize: 12, wordBreak: "break-all", color: "#1677ff" }}>
                            <LinkOutlined /> {url}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* ===== 区块 C：数据提取指引 ===== */}
            {currentEpic.needs_data_extraction && (
              (currentEpic.data_connection_info || currentEpic.operation_steps || currentEpic.operation_screenshots) && (
                <div style={{
                  background: "#fffbe6", border: "1px solid #ffe58f", borderRadius: 8,
                  padding: "14px 16px", marginBottom: 16,
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#92400e", marginBottom: 10 }}>
                    📡 数据提取指引
                  </div>

                  {currentEpic.data_connection_info && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: "#92400e", marginBottom: 4 }}>连接地址</div>
                      <div style={{
                        background: "#fff", padding: "8px 10px", borderRadius: 6,
                        fontSize: 13, color: "#374151", wordBreak: "break-all",
                        border: "1px solid #fde68a",
                      }}>
                        {currentEpic.data_connection_info}
                      </div>
                    </div>
                  )}

                  {currentEpic.operation_steps && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: "#92400e", marginBottom: 4 }}>操作步骤</div>
                      <pre style={{
                        background: "#fff", padding: "8px 10px", borderRadius: 6,
                        fontSize: 13, lineHeight: 1.8, color: "#374151",
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                        border: "1px solid #fde68a", margin: 0,
                      }}>
                        {currentEpic.operation_steps}
                      </pre>
                    </div>
                  )}

                  {currentEpic.operation_screenshots && (() => {
                    const urls = (() => { try { return JSON.parse(currentEpic.operation_screenshots!); } catch { return []; } })();
                    return urls.length > 0 ? (
                      <div>
                        <div style={{ fontSize: 12, color: "#92400e", marginBottom: 4 }}>操作截图</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {urls.map((url: string, i: number) => (
                            <img key={i} src={url} alt={`截图${i + 1}`}
                              style={{ maxWidth: 160, borderRadius: 6, border: "1px solid #fde68a", cursor: "pointer" }}
                              onClick={() => window.open(url, "_blank")}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              )
            )}

          </div>
        ) : (
          <Empty description="未找到需求信息" />
        )}
      </Drawer>
    </div>
  );
}

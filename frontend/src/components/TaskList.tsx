/**
 * 任务管理页面

 * 功能：
 * - 任务列表展示（支持按状态和负责人过滤）
 * - 创建新任务
 * - 任务状态快速流转
 * - 编辑/删除任务
 * - 看板视图切换
 */

import { useEffect, useState } from "react";
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Popconfirm,
  Tooltip,
  Row,
  Col,
  Badge,
  Empty,
  DatePicker,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useTaskStore, useRequirementStore, useMemberStore } from "@/store";
import {
  TaskStatus,
  STATUS_LABELS,
} from "@/types";
import type { Task, TaskCreate } from "@/types";
import TaskComments from "./TaskComments";

/** 任务状态流转规则：当前状态 -> 可转换的下一个状态 */
const STATUS_TRANSITIONS: Record<string, string[]> = {
  todo: ["in_progress"],
  in_progress: ["review"],
  review: ["done", "in_progress"],
  done: [],
};

/** 状态颜色映射 */
const STATUS_COLOR: Record<string, string> = {
  todo: "default",
  in_progress: "processing",
  review: "warning",
  done: "success",
};

/** 看板列配置 */
const KANBAN_COLUMNS = [
  { key: "todo", title: "待办", color: "#d9d9d9" },
  { key: "in_progress", title: "进行中", color: "#1677ff" },
  { key: "review", title: "待验收", color: "#faad14" },
  { key: "done", title: "已完成", color: "#52c41a" },
];

export default function TaskList() {
  const {
    tasks,
    loading,
    fetchTasks,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
  } = useTaskStore();

  const { requirements, fetchRequirements } = useRequirementStore();
  const { members, fetchMembers } = useMemberStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Task | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("kanban");
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterAssignee, setFilterAssignee] = useState<string | undefined>();
  const [filterRequirement, setFilterRequirement] = useState<number | undefined>();
  const [filterDepartment, setFilterDepartment] = useState<string | undefined>();
  const [form] = Form.useForm();

  useEffect(() => {
    fetchTasks();
    fetchRequirements();
    fetchMembers();
  }, [fetchTasks, fetchRequirements, fetchMembers]);

  /** 打开创建/编辑对话框 */
  const openModal = (item?: Task) => {
    setEditItem(item || null);
    form.resetFields();
    if (item) {
      form.setFieldsValue({
        requirement_id: item.requirement_id,
        title: item.title,
        description: item.description,
        assignee: item.assignee,
        status: item.status,
        due_date: item.due_date ? dayjs(item.due_date) : undefined,
      });
    }
    setModalOpen(true);
  };

  /** 提交表单 */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: Record<string, unknown> = {
        requirement_id: values.requirement_id,
        title: values.title,
        description: values.description,
        assignee: values.assignee,
        status: values.status,
      };
      // DatePicker 返回 dayjs 对象，手动格式化为 ISO 字符串
      if (values.due_date && typeof values.due_date === "object" && values.due_date.format) {
        payload.due_date = values.due_date.format("YYYY-MM-DDTHH:mm:ss");
      } else if (typeof values.due_date === "string" && values.due_date) {
        payload.due_date = values.due_date;
      }
      let success: boolean;
      if (editItem) {
        success = await updateTask(editItem.id, payload);
      } else {
        success = await createTask(payload as TaskCreate);
      }
      if (success) {
        setModalOpen(false);
        fetchTasks({
          status: filterStatus,
          assignee: filterAssignee,
        });
      }
    } catch {
      // 表单校验失败
    }
  };

  /** 删除任务 */
  const handleDelete = async (id: number) => {
    const success = await deleteTask(id);
    if (success) {
      fetchTasks({ status: filterStatus, assignee: filterAssignee });
    }
  };

  /** 状态快速流转 */
  const handleStatusChange = async (taskId: number, newStatus: TaskStatus) => {
    const success = await updateTaskStatus(taskId, newStatus);
    if (success) {
      fetchTasks({
        ...(filterStatus ? { status: filterStatus } : {}),
        ...(filterAssignee ? { assignee: filterAssignee } : {}),
        ...(filterRequirement ? { requirement_id: filterRequirement } : {}),
      });
    }
  };

  /** 过滤任务 */
  const handleFilter = (status?: string, assignee?: string, reqId?: number) => {
    setFilterStatus(status);
    setFilterAssignee(assignee);
    setFilterRequirement(reqId);
    fetchTasks({
      ...(status ? { status } : {}),
      ...(assignee ? { assignee } : {}),
      ...(reqId ? { requirement_id: reqId } : {}),
    });
  };

  /** 按部门筛选（前端过滤，因为任务本身没有部门字段） */
  const displayTasks = filterDepartment
    ? tasks.filter((t) => {
        const req = requirements.find((r) => r.id === t.requirement_id);
        return req?.department === filterDepartment;
      })
    : tasks;

  /** 表格列定义 */
  const columns = [
    {
      title: "任务标题",
      dataIndex: "title",
      key: "title",
      width: 200,
    },
    {
      title: "所属需求",
      key: "requirement",
      width: 160,
      render: (_: unknown, record: Task) => {
        const req = requirements.find((r) => r.id === record.requirement_id);
        if (!req) return <span style={{ color: "#999" }}>-</span>;
        return (
          <Tooltip title={req.title}>
            <span style={{ fontSize: 13 }}>
              <Tag color="blue" style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {req.title}
              </Tag>
              <span style={{ fontSize: 11, color: "#999", marginLeft: 2 }}>{req.version}</span>
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: "负责人",
      dataIndex: "assignee",
      key: "assignee",
      width: 100,
      render: (v: string) => v || <span style={{ color: "#999" }}>未分配</span>,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (s: string) => (
        <Tag color={STATUS_COLOR[s]}>{STATUS_LABELS[s]}</Tag>
      ),
    },
    {
      title: "截止日期",
      dataIndex: "due_date",
      key: "due_date",
      width: 130,
      render: (v: string, record: Task) => {
        if (!v) return <span style={{ color: "#999" }}>-</span>;
        const due = dayjs(v);
        const today = dayjs().startOf("day");
        const isDone = record.status === "done";
        const isOverdue = !isDone && due.isBefore(today);
        const isDueSoon = !isDone && !isOverdue && due.diff(today, "day") <= 3;
        return (
          <span style={{
            color: isOverdue ? "#ff4d4f" : isDueSoon ? "#faad14" : "#262626",
            fontWeight: isOverdue || isDueSoon ? 600 : 400,
          }}>
            {isOverdue && "⚠ "}{due.format("YYYY-MM-DD")}
          </span>
        );
      },
    },
    {
      title: "操作",
      key: "action",
      width: 250,
      render: (_: unknown, record: Task) => (
        <Space>
          {/* 状态流转按钮 */}
          {STATUS_TRANSITIONS[record.status]?.map((nextStatus) => (
            <Button
              key={nextStatus}
              type="link"
              size="small"
              onClick={() =>
                handleStatusChange(record.id, nextStatus as TaskStatus)
              }
            >
              移至{STATUS_LABELS[nextStatus]}
            </Button>
          ))}
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openModal(record)}
          >
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  /** 渲染看板卡片 */
  const renderKanbanCard = (task: Task) => {
    const today = dayjs().startOf("day");
    const isOverdue = task.due_date && task.status !== "done" && dayjs(task.due_date).isBefore(today);
    const isDueSoon = task.due_date && task.status !== "done" && !isOverdue && dayjs(task.due_date).diff(today, "day") <= 3;
    const req = requirements.find((r) => r.id === task.requirement_id);
    return (
      <Card
        size="small"
        style={{
          marginBottom: 8, cursor: "pointer",
          borderColor: isOverdue ? "#ffccc7" : isDueSoon ? "#ffe58f" : undefined,
        }}
        hoverable
        onClick={(e) => { e.stopPropagation(); openModal(task); }}
      >
        {/* 需求标签 */}
        {req && (
          <div style={{ marginBottom: 6 }}>
            <Tag color="blue" style={{ fontSize: 11, lineHeight: "18px", margin: 0 }}>
              {req.title} · {req.version}
            </Tag>
          </div>
        )}
        <div style={{ fontWeight: 500, marginBottom: 6, fontSize: 13 }}>{task.title}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#666" }}>
            {task.assignee || "未分配"}
          </span>
          {task.due_date && (
            <span style={{
              fontSize: 11,
              color: isOverdue ? "#ff4d4f" : isDueSoon ? "#faad14" : "#999",
              fontWeight: isOverdue || isDueSoon ? 600 : 400,
            }}>
              {isOverdue && "⚠ "}{dayjs(task.due_date).format("MM-DD")}
            </span>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div>
      {/* 顶部操作栏 */}
      <Card style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <Space wrap>
            <Select
              placeholder="按需求筛选"
              allowClear
              style={{ width: 180 }}
              value={filterRequirement}
              onChange={(v) => handleFilter(filterStatus, filterAssignee, v)}
              showSearch
              optionFilterProp="label"
              options={requirements.map((r) => ({
                value: r.id,
                label: `${r.title} (${r.version})`,
              }))}
            />
            <Select
              placeholder="按状态筛选"
              allowClear
              style={{ width: 130 }}
              value={filterStatus}
              onChange={(v) => handleFilter(v, filterAssignee, filterRequirement)}
            >
              <Select.Option value="todo">待办</Select.Option>
              <Select.Option value="in_progress">进行中</Select.Option>
              <Select.Option value="review">待验收</Select.Option>
              <Select.Option value="done">已完成</Select.Option>
            </Select>
            <Select
              placeholder="按成员筛选"
              allowClear
              style={{ width: 130 }}
              value={filterAssignee}
              onChange={(v) => handleFilter(filterStatus, v, filterRequirement)}
            >
              {members.map((m) => (
                <Select.Option key={m.name} value={m.name}>
                  {m.name}
                </Select.Option>
              ))}
            </Select>
            <Select
              placeholder="按部门筛选"
              allowClear
              style={{ width: 130 }}
              value={filterDepartment}
              onChange={(v) => setFilterDepartment(v)}
            >
              {[...new Set(requirements.map((r) => r.department).filter(Boolean))].map((d) => (
                <Select.Option key={d} value={d}>{d}</Select.Option>
              ))}
            </Select>
          </Space>
          <Space>
            <Button.Group>
              <Button type={viewMode === "kanban" ? "primary" : "default"} icon={<AppstoreOutlined />}
                onClick={() => setViewMode("kanban")} size="small">看板</Button>
              <Button type={viewMode === "table" ? "primary" : "default"} icon={<UnorderedListOutlined />}
                onClick={() => setViewMode("table")} size="small">列表</Button>
            </Button.Group>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>新建任务</Button>
          </Space>
        </div>
      </Card>

      {/* ==================== 看板视图 ==================== */}
      {viewMode === "kanban" ? (
        <Row gutter={16}>
          {KANBAN_COLUMNS.map((col) => {
            const colTasks = displayTasks.filter((t) => t.status === col.key);
            return (
              <Col xs={24} sm={12} lg={6} key={col.key}>
                <Card
                  title={
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>{col.title}</span>
                      <Badge count={colTasks.length} style={{ backgroundColor: col.color }} />
                    </div>
                  }
                  style={{ borderTop: `3px solid ${col.color}`, marginBottom: 16 }}
                  bodyStyle={{ padding: 12, minHeight: 200, background: "#fafafa" }}
                >
                  {colTasks.length > 0 ? colTasks.map(renderKanbanCard) : (
                    <Empty description="暂无任务" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: "40px 0" }} />
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      ) : (
        <Card>
          <Table columns={columns} dataSource={displayTasks} rowKey="id"
            loading={loading} pagination={{ pageSize: 15 }} size="middle" />
        </Card>
      )}

      {/* ==================== 创建/编辑对话框 ==================== */}
      <Modal
        title={editItem ? "编辑任务" : "新建任务"}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={520}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            status: TaskStatus.TODO,
          }}
        >
          <Form.Item
            name="requirement_id"
            label="所属需求"
            rules={[{ required: true, message: "请选择所属需求" }]}
          >
            <Select placeholder="选择需求">
              {requirements.map((r) => (
                <Select.Option key={r.id} value={r.id}>
                  {r.title} ({r.version})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="title"
            label="任务标题"
            rules={[{ required: true, message: "请输入任务标题" }]}
          >
            <Input placeholder="请输入任务标题" maxLength={200} />
          </Form.Item>
          <Form.Item name="description" label="任务描述">
            <Input.TextArea placeholder="请输入任务描述" rows={2} />
          </Form.Item>
          <Form.Item name="assignee" label="负责人">
            <Select placeholder="选择负责人" allowClear>
              {members.map((m) => (
                <Select.Option key={m.name} value={m.name}>
                  {m.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              {Object.entries(STATUS_LABELS)
                .filter(([k]) =>
                  ["todo", "in_progress", "review", "done"].includes(k)
                )
                .map(([value, label]) => (
                  <Select.Option key={value} value={value}>
                    {label}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item name="due_date" label="截止日期">
            <DatePicker style={{ width: "100%" }} placeholder="选择截止日期" />
          </Form.Item>
        </Form>

        {/* 编辑模式下显示评论 */}
        {editItem && <TaskComments taskId={editItem.id} />}
      </Modal>
    </div>
  );
}

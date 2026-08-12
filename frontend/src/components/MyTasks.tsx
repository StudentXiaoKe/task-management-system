/**
 * 我的任务页面

 * 按成员查看所有任务，跨需求聚合。
 * 支持切换成员，按状态分组展示，截止日期高亮。
 */

import { useEffect, useState } from "react";
import {
  Card,
  Select,
  Tag,
  Empty,
  Row,
  Col,
  Statistic,
  Typography,
  Space,
  Tooltip,
} from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  FileSearchOutlined,
  WarningOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useMyTaskStore, useMemberStore } from "@/store";
import { STATUS_LABELS } from "@/types";
import type { MyTaskItem } from "@/types";

const { Text } = Typography;

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  todo:        { color: "#8c8c8c", bg: "#f5f5f5", icon: <ClockCircleOutlined />,  label: "待办" },
  in_progress: { color: "#1677ff", bg: "#e6f4ff", icon: <SyncOutlined />,         label: "进行中" },
  review:      { color: "#faad14", bg: "#fffbe6", icon: <FileSearchOutlined />,   label: "待验收" },
  done:        { color: "#52c41a", bg: "#f6ffed", icon: <CheckCircleOutlined />,  label: "已完成" },
};

export default function MyTasks() {
  const { tasks, loading, fetchMyTasks } = useMyTaskStore();
  const { members, fetchMembers } = useMemberStore();
  const [selectedMember, setSelectedMember] = useState<string | undefined>();

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    if (selectedMember) {
      fetchMyTasks(selectedMember);
    }
  }, [selectedMember, fetchMyTasks]);

  /** 统计 */
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const overdue = tasks.filter((t) => t.is_overdue).length;
  const dueSoon = tasks.filter((t) => t.is_due_soon).length;
  const active = tasks.filter((t) => t.status !== "done").length;

  /** 按状态分组 */
  const grouped: Record<string, MyTaskItem[]> = {
    overdue: tasks.filter((t) => t.is_overdue),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    review: tasks.filter((t) => t.status === "review"),
    todo: tasks.filter((t) => t.status === "todo"),
    done: tasks.filter((t) => t.status === "done"),
  };

  const renderTask = (task: MyTaskItem) => {
    const cfg = STATUS_CONFIG[task.status];
    return (
      <div key={task.task_id} style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", borderRadius: 8,
        background: task.is_overdue ? "#fff1f0" : "#fff",
        border: task.is_overdue ? "1px solid #ffccc7" : "1px solid #f0f0f0",
        borderLeft: `4px solid ${task.is_overdue ? "#ff4d4f" : cfg.color}`,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: task.is_overdue ? "#ff4d4f" : cfg.color,
          flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 500,
            textDecoration: task.status === "done" ? "line-through" : "none",
            color: task.status === "done" ? "#bbb" : "#262626",
          }}>
            {task.task_title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, fontSize: 12, color: "#999" }}>
            <span>{task.requirement_title} ({task.requirement_version})</span>
            {task.due_date && (
              <span style={{ color: task.is_overdue ? "#ff4d4f" : task.is_due_soon ? "#faad14" : "#999" }}>
                {task.is_overdue && <WarningOutlined style={{ marginRight: 3 }} />}
                {task.due_date}
              </span>
            )}
          </div>
        </div>
        <Tag style={{ fontSize: 11 }} color={cfg.color === "#8c8c8c" ? "default" : undefined}
          {...(cfg.color !== "#8c8c8c" ? { color: cfg.color } : {})}>
          {cfg.label}
        </Tag>
      </div>
    );
  };

  return (
    <div>
      {/* 选择成员 */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <UserOutlined style={{ fontSize: 16, color: "#1677ff" }} />
          <Select
            placeholder="选择成员查看任务"
            style={{ width: 200 }}
            value={selectedMember}
            onChange={setSelectedMember}
          >
            {members.map((m) => (
              <Select.Option key={m.name} value={m.name}>{m.name}</Select.Option>
            ))}
          </Select>
          {selectedMember && (
            <Text type="secondary">共 {total} 项任务，{active} 项进行中</Text>
          )}
        </div>
      </Card>

      {selectedMember ? (
        <>
          {/* 统计卡片 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}>
              <Card size="small" hoverable>
                <Statistic title="总任务" value={total} valueStyle={{ fontSize: 24 }} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" hoverable>
                <Statistic title="进行中" value={active}
                  prefix={<SyncOutlined style={{ color: "#1677ff" }} />}
                  valueStyle={{ fontSize: 24, color: "#1677ff" }} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" hoverable style={overdue > 0 ? { borderColor: "#ff4d4f" } : {}}>
                <Statistic title="已逾期" value={overdue}
                  prefix={<WarningOutlined style={{ color: overdue > 0 ? "#ff4d4f" : "#999" }} />}
                  valueStyle={{ fontSize: 24, color: overdue > 0 ? "#ff4d4f" : "#999" }} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card size="small" hoverable>
                <Statistic title="已完成" value={done}
                  prefix={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
                  valueStyle={{ fontSize: 24, color: "#52c41a" }} />
              </Card>
            </Col>
          </Row>

          {/* 任务列表（按状态分组） */}
          <Card bodyStyle={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* 逾期任务 */}
              {grouped.overdue.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, paddingBottom: 6, borderBottom: "2px solid #ff4d4f30" }}>
                    <WarningOutlined style={{ color: "#ff4d4f" }} />
                    <Text strong style={{ color: "#ff4d4f" }}>已逾期</Text>
                    <Tag color="red" style={{ fontSize: 11 }}>{grouped.overdue.length}</Tag>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {grouped.overdue.map(renderTask)}
                  </div>
                </div>
              )}

              {/* 进行中 */}
              {grouped.in_progress.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, paddingBottom: 6, borderBottom: "2px solid #1677ff30" }}>
                    <SyncOutlined style={{ color: "#1677ff" }} />
                    <Text strong>进行中</Text>
                    <Tag color="blue" style={{ fontSize: 11 }}>{grouped.in_progress.length}</Tag>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {grouped.in_progress.map(renderTask)}
                  </div>
                </div>
              )}

              {/* 待验收 */}
              {grouped.review.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, paddingBottom: 6, borderBottom: "2px solid #faad1430" }}>
                    <FileSearchOutlined style={{ color: "#faad14" }} />
                    <Text strong>待验收</Text>
                    <Tag color="orange" style={{ fontSize: 11 }}>{grouped.review.length}</Tag>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {grouped.review.map(renderTask)}
                  </div>
                </div>
              )}

              {/* 待办 */}
              {grouped.todo.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, paddingBottom: 6, borderBottom: "2px solid #8c8c8c30" }}>
                    <ClockCircleOutlined style={{ color: "#8c8c8c" }} />
                    <Text strong>待办</Text>
                    <Tag style={{ fontSize: 11 }}>{grouped.todo.length}</Tag>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {grouped.todo.map(renderTask)}
                  </div>
                </div>
              )}

              {/* 已完成 */}
              {grouped.done.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, paddingBottom: 6, borderBottom: "2px solid #52c41a30" }}>
                    <CheckCircleOutlined style={{ color: "#52c41a" }} />
                    <Text strong>已完成</Text>
                    <Tag color="green" style={{ fontSize: 11 }}>{grouped.done.length}</Tag>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {grouped.done.map(renderTask)}
                  </div>
                </div>
              )}
            </div>

            {tasks.length === 0 && <Empty description="暂无任务" />}
          </Card>
        </>
      ) : (
        <Card>
          <Empty description="请先选择成员" />
        </Card>
      )}
    </div>
  );
}

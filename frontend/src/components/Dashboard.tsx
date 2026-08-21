/**
 * Dashboard 主控制台（完整版）

 * 功能：
 * - 统计卡片（含循环任务完成指示）
 * - 截止日期预警区（今天/本周到期任务）
 * - 需求进度 Tab（排序 + 悬浮子任务 + 点击跳转）
 * - 循环任务 Tab（直接勾选 + 历史趋势）
 * - 成员负荷（悬浮含截止日期 + 逾期标红）
 */

import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card, Row, Col, Progress, Table, Tag, Statistic, Spin, Empty, List, Tabs, Checkbox, Tooltip, Modal, Pagination,
} from "antd";
import {
  ProjectOutlined, CheckCircleOutlined, TeamOutlined, ThunderboltOutlined,
  SyncOutlined, CheckCircleFilled, ClockCircleOutlined, FileSearchOutlined,
  WarningOutlined, ArrowRightOutlined, FileTextOutlined, ApartmentOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useDashboardStore, useAuthStore } from "@/store";
import { requirementApi, myTaskApi, recurringTaskApi } from "@/api";
import { PRIORITY_LABELS, CYCLE_LABELS } from "@/types";
import type { RequirementSummary, MemberWorkload, Task, MyTaskItem } from "@/types";
import DeliveryReport from "./DeliveryReport";
import AlignmentMap from "./AlignmentMap";

interface TipTask { title: string; status: string; assignee?: string | null; due_date?: string | null }

const PRIORITY_COLORS: Record<string, string> = { low: "default", medium: "blue", high: "orange", urgent: "red" };
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const STATUS_CFG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  todo:        { color: "#8c8c8c", bg: "#f5f5f5", icon: <ClockCircleOutlined />,  label: "待办" },
  in_progress: { color: "#1677ff", bg: "#e6f4ff", icon: <SyncOutlined />,         label: "进行中" },
  review:      { color: "#faad14", bg: "#fffbe6", icon: <FileSearchOutlined />,   label: "待验收" },
  done:        { color: "#52c41a", bg: "#f6ffed", icon: <CheckCircleOutlined />,  label: "已完成" },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canReport = user?.role === "CLIENT" || user?.role === "MANAGER" || user?.role === "DEVELOPER";
  const { data, loading, fetchData } = useDashboardStore();
  const [reportReq, setReportReq] = useState<{ id: number; title: string } | null>(null);
  const [alignModalReq, setAlignModalReq] = useState<{ id: number; title: string } | null>(null);
  const [hoverTip, setHoverTip] = useState<{ x: number; y: number; title: string; tasks: TipTask[]; loading: boolean } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 截止日期预警数据
  const [deadlineTasks, setDeadlineTasks] = useState<(MyTaskItem & { assignee: string })[]>([]);
  const [deadlineLoading, setDeadlineLoading] = useState(false);

  // 历史需求数据
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const PAGE_SIZE = 10;

  const loadHistory = async (page = 1) => {
    setHistoryLoading(true);
    try {
      const res = await requirementApi.history(page, PAGE_SIZE);
      setHistoryItems(res.data);
      setHistoryTotal(res.total);
      setHistoryPage(res.page);
    } catch {
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    loadDeadlineTasks();
    loadHistory();
  }, [fetchData]);

  /** 获取截止日期预警（后端聚合接口，一次调用） */
  const loadDeadlineTasks = async () => {
    setDeadlineLoading(true);
    try {
      const tasks = await myTaskApi.alerts(7);
      setDeadlineTasks(tasks);
    } catch { setDeadlineTasks([]); }
    finally { setDeadlineLoading(false); }
  };

  // ==================== 悬浮逻辑 ====================
  const clearHover = () => {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
    setHoverTip(null);
  };

  const handleReqHover = (r: RequirementSummary, e: React.MouseEvent) => {
    hoverTimer.current = setTimeout(async () => {
      setHoverTip({ x: e.clientX, y: e.clientY, title: r.title, tasks: [], loading: true });
      try {
        const d = await requirementApi.get(r.id);
        setHoverTip((p) => p ? { ...p, tasks: (d.tasks || []).map((t: Task) => ({ title: t.title, status: t.status, assignee: t.assignee, due_date: t.due_date })), loading: false } : null);
      } catch { setHoverTip((p) => p ? { ...p, tasks: [], loading: false } : null); }
    }, 300);
  };

  const handleMemberHover = (assignee: string, e: React.MouseEvent) => {
    hoverTimer.current = setTimeout(async () => {
      setHoverTip({ x: e.clientX, y: e.clientY, title: `${assignee} 的任务`, tasks: [], loading: true });
      try {
        const items = await myTaskApi.list(assignee);
        setHoverTip((p) => p ? { ...p, tasks: items.map((t: MyTaskItem) => ({ title: t.task_title, status: t.status, due_date: t.due_date })), loading: false } : null);
      } catch { setHoverTip((p) => p ? { ...p, tasks: [], loading: false } : null); }
    }, 300);
  };

  // ==================== 循环任务勾选 ====================
  const handleToggleRecurring = async (logId: number) => {
    try {
      await recurringTaskApi.toggleTask(logId);
      fetchData();
    } catch {}
  };

  if (loading) return <div style={{ textAlign: "center", padding: 80 }}><Spin size="large" tip="加载中..." /></div>;
  if (!data) return <Empty description="暂无数据" />;

  const today = dayjs().startOf("day");
  const recurringRate = data.recurring_total > 0 ? Math.round((data.recurring_done / data.recurring_total) * 100) : 0;
  const reqColumns = [
    {
      title: "需求标题", dataIndex: "title", key: "title", width: 200,
      render: (title: string) => (
        <span style={{ color: "#1677ff", cursor: "pointer" }} onClick={() => navigate("/requirements")}>
          {title} <ArrowRightOutlined style={{ fontSize: 10 }} />
        </span>
      ),
    },
    { title: "版本", dataIndex: "version", key: "version", width: 70, render: (v: string) => <Tag color="blue" style={{ fontSize: 11 }}>{v}</Tag> },
    {
      title: "优先级", dataIndex: "priority", key: "priority", width: 70,
      sorter: (a: RequirementSummary, b: RequirementSummary) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9),
      render: (p: string) => <Tag color={PRIORITY_COLORS[p]} style={{ fontSize: 11 }}>{PRIORITY_LABELS[p]}</Tag>,
    },
    {
      title: "任务进度", key: "progress", width: 180,
      sorter: (a: RequirementSummary, b: RequirementSummary) => a.progress - b.progress,
      render: (_: unknown, r: RequirementSummary) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Progress percent={r.progress} size="small" style={{ flex: 1 }} status={r.progress === 100 ? "success" : "active"} />
          <span style={{ fontSize: 12, color: "#666", whiteSpace: "nowrap" }}>{r.done_tasks}/{r.total_tasks}</span>
        </div>
      ),
    },
    ...(canReport
      ? [{
          title: "", key: "report", width: 50,
          render: (_: unknown, r: RequirementSummary) => (
            <Tooltip title="生成交付报告">
              <FileTextOutlined
                style={{ color: "#1677ff", cursor: "pointer", fontSize: 16 }}
                onClick={() => setReportReq({ id: r.id, title: r.title })}
              />
            </Tooltip>
          ),
        }]
      : []),
    {
      title: "", key: "alignment", width: 40,
      render: (_: unknown, r: RequirementSummary) => (
        <Tooltip title="对齐视图">
          <ApartmentOutlined
            style={{ color: "#722ed1", cursor: "pointer", fontSize: 16 }}
            onClick={() => setAlignModalReq({ id: r.id, title: r.title })}
          />
        </Tooltip>
      ),
    },
  ];

  const tabItems = [
    {
      key: "requirements",
      label: <span><ProjectOutlined /> 需求进度</span>,
      children: (
        <Table columns={reqColumns} dataSource={data.active_requirements}
          rowKey="id" pagination={false} size="small"
          locale={{ emptyText: "暂无活跃需求" }}
          onRow={(record) => ({
            onMouseEnter: (e) => handleReqHover(record, e),
            onMouseLeave: clearHover,
            style: { cursor: "pointer" },
          })} />
      ),
    },
    {
      key: "recurring",
      label: (
        <span>
          <SyncOutlined /> 循环任务
          {data.recurring_total > 0 && (
            <Tag style={{ marginLeft: 6 }} color={data.recurring_done === data.recurring_total ? "green" : "blue"}>
              {data.recurring_done}/{data.recurring_total}
            </Tag>
          )}
        </span>
      ),
      children: (
        data.recurring_checklist.length > 0 ? (
          <>
            <Progress percent={recurringRate}
              status={data.recurring_done === data.recurring_total && data.recurring_total > 0 ? "success" : "active"}
              style={{ marginBottom: 12 }} />
            <List dataSource={data.recurring_checklist} size="small"
              renderItem={(item) => (
                <List.Item
                  style={{
                    padding: "8px 12px", borderRadius: 6, marginBottom: 4,
                    background: item.completed ? "#f6ffed" : "#fff", border: "1px solid #f0f0f0",
                  }}
                  onClick={() => handleToggleRecurring(item.log_id)}
                >
                  <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 10, cursor: "pointer" }}>
                    <Checkbox checked={item.completed} style={{ pointerEvents: "none" }} />
                    <span style={{
                      flex: 1, fontSize: 13,
                      textDecoration: item.completed ? "line-through" : "none",
                      color: item.completed ? "#bbb" : "#262626",
                    }}>
                      {item.title}
                    </span>
                    {item.assignee && <Tag color="blue" style={{ fontSize: 11 }}>{item.assignee}</Tag>}
                    <Tag style={{ fontSize: 11 }}>{CYCLE_LABELS[item.cycle]}</Tag>
                  </div>
                </List.Item>
              )} />
          </>
        ) : <Empty description="今天没有到期的循环任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ),
    },
    {
      key: "history",
      label: <span><FileTextOutlined /> 历史需求</span>,
      children: (
        <Spin spinning={historyLoading}>
          {historyItems.length > 0 ? (
            <>
              <Table
                dataSource={historyItems}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  { title: "需求名称", dataIndex: "title", key: "title", ellipsis: true,
                    render: (v: string, r: any) => (
                      <span>{v} <Tag style={{ marginLeft: 4 }}>{r.version}</Tag></span>
                    ),
                  },
                  { title: "状态", dataIndex: "status", key: "status", width: 90,
                    render: (s: string) => (
                      <Tag color={s === "completed" ? "green" : "default"}>
                        {s === "completed" ? "已完成" : "已归档"}
                      </Tag>
                    ),
                  },
                  { title: "进度", key: "progress", width: 140,
                    render: (_: unknown, r: any) => (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Progress percent={r.progress} size="small" style={{ flex: 1, marginBottom: 0 }}
                          strokeColor={r.progress === 100 ? "#52c41a" : "#1677ff"} />
                        <span style={{ fontSize: 12, color: "#999", whiteSpace: "nowrap" }}>
                          {r.done_tasks}/{r.total_tasks}
                        </span>
                      </div>
                    ),
                  },
                  { title: "操作", key: "action", width: 100,
                    render: (_: unknown, r: any) => (
                      canReport && (
                        <Tooltip title="生成交付报告">
                          <FileTextOutlined style={{ fontSize: 16, cursor: "pointer", color: "#1677ff" }}
                            onClick={() => setReportReq({ id: r.id, title: r.title })} />
                        </Tooltip>
                      )
                    ),
                  },
                ]}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <Pagination
                  current={historyPage}
                  total={historyTotal}
                  pageSize={PAGE_SIZE}
                  showTotal={(total) => `共 ${total} 条`}
                  onChange={(page) => {
                    loadHistory(page);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              </div>
            </>
          ) : (
            <Empty description="暂无历史需求" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Spin>
      ),
    },
  ];

  return (
    <div>
      {/* ==================== 统计卡片 ==================== */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card hoverable size="small" onClick={() => navigate("/requirements")} style={{ cursor: "pointer" }}>
            <Statistic title="需求总数" value={data.total_requirements}
              prefix={<ProjectOutlined />} valueStyle={{ color: "#1677ff", fontSize: 28 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable size="small" onClick={() => navigate("/tasks")} style={{ cursor: "pointer" }}>
            <Statistic title="任务总数" value={data.total_tasks}
              prefix={<CheckCircleOutlined />} valueStyle={{ color: "#52c41a", fontSize: 28 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable size="small">
            <Statistic title="任务完成率" value={data.completion_rate} suffix="%"
              prefix={<ThunderboltOutlined />} valueStyle={{ color: "#faad14", fontSize: 28 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable size="small" onClick={() => navigate("/recurring")} style={{ cursor: "pointer" }}>
            <Statistic title="今日循环任务" value={`${data.recurring_done}/${data.recurring_total}`}
              prefix={<SyncOutlined />}
              valueStyle={{ color: data.recurring_done === data.recurring_total && data.recurring_total > 0 ? "#52c41a" : "#1677ff", fontSize: 28 }} />
          </Card>
        </Col>
      </Row>

      {/* ==================== 截止日期预警 ==================== */}
      {deadlineTasks.length > 0 && (
        <Card
          title={<span><WarningOutlined style={{ color: "#ff4d4f", marginRight: 8 }} />截止日期预警</span>}
          size="small"
          style={{ marginBottom: 20 }}
          bodyStyle={{ padding: "8px 16px" }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {deadlineTasks.slice(0, 12).map((t) => {
              const due = dayjs(t.due_date);
              const isOverdue = due.isBefore(today);
              const isToday = due.isSame(today, "day");
              return (
                <Tooltip key={t.task_id} title={`${t.requirement_title} · ${t.assignee || "未分配"}`}>
                  <Tag
                    color={isOverdue ? "red" : isToday ? "orange" : "gold"}
                    style={{ cursor: "pointer", fontSize: 12 }}
                  >
                    {isOverdue && "⚠ "}{t.task_title}
                    <span style={{ marginLeft: 4, opacity: 0.7 }}>{due.format("MM-DD")}</span>
                  </Tag>
                </Tooltip>
              );
            })}
            {deadlineTasks.length > 12 && <Tag>+{deadlineTasks.length - 12} 更多</Tag>}
          </div>
        </Card>
      )}

      {/* ==================== Tab 内容 ==================== */}
      <Card bodyStyle={{ padding: "0 16px 16px" }} style={{ marginBottom: 20 }}>
        <Tabs defaultActiveKey="requirements" items={tabItems} style={{ marginTop: 8 }} />
      </Card>

      {/* ==================== 成员负荷 ==================== */}
      <Card title={<span><TeamOutlined style={{ marginRight: 8 }} />团队成员任务负荷</span>}>
        {data.member_workloads.length > 0 ? (
          <Row gutter={[16, 16]}>
            {data.member_workloads.map((member) => {
              const active = member.todo_count + member.in_progress_count + member.review_count;
              const hasOverdue = deadlineTasks.some((t) => t.assignee === member.assignee && dayjs(t.due_date).isBefore(today));
              return (
                <Col xs={24} sm={12} lg={6} key={member.assignee}>
                  <Card
                    size="small"
                    style={{
                      borderLeft: `4px solid ${hasOverdue ? "#ff4d4f" : active > 3 ? "#faad14" : active > 1 ? "#1677ff" : "#52c41a"}`,
                      cursor: "pointer",
                    }}
                    onClick={() => navigate("/mytasks")}
                    onMouseEnter={(e) => handleMemberHover(member.assignee, e)}
                    onMouseLeave={clearHover}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <strong style={{ fontSize: 16 }}>{member.assignee}</strong>
                      <div>
                        {hasOverdue && <Tag color="red" style={{ marginRight: 4 }}>逾期</Tag>}
                        <Tag color={active > 3 ? "red" : active > 1 ? "orange" : "green"}>
                          {active > 3 ? "高负荷" : active > 1 ? "适中" : "空闲"}
                        </Tag>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: "#666" }}>
                      总计 <strong>{member.total_tasks}</strong> 项 · 已完成 <strong>{member.done_count}</strong> 项
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#999" }}>
                      待办 {member.todo_count} · 进行中 {member.in_progress_count} · 待验收 {member.review_count}
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        ) : (
          <Empty description="暂无成员任务数据" />
        )}
      </Card>

      {/* ==================== 悬浮任务提示 ==================== */}
      {hoverTip && (
        <div style={{
          position: "fixed", left: hoverTip.x + 16, top: hoverTip.y - 10,
          background: "#fff", borderRadius: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
          border: "1px solid #f0f0f0", padding: "12px 16px",
          minWidth: 320, maxWidth: 520, zIndex: 1000, pointerEvents: "none",
        }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: "#262626" }}>
            {hoverTip.title} · 子任务
          </div>
          {hoverTip.loading ? (
            <div style={{ textAlign: "center", padding: 8, color: "#999", fontSize: 12 }}>加载中...</div>
          ) : hoverTip.tasks.length > 0 ? (() => {
            const groups = [
              { key: "todo", label: "待办", color: "#8c8c8c" },
              { key: "in_progress", label: "进行中", color: "#1677ff" },
              { key: "review", label: "待验收", color: "#faad14" },
              { key: "done", label: "已完成", color: "#52c41a" },
            ].map((g) => ({ ...g, items: hoverTip.tasks.filter((t) => t.status === g.key) }))
             .filter((g) => g.items.length > 0);

            return (
              <div style={{ display: "flex", gap: 12, maxHeight: 280, overflowY: "auto" }}>
                {groups.map((g) => (
                  <div key={g.key} style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: g.color, marginBottom: 6, paddingBottom: 4, borderBottom: `2px solid ${g.color}40` }}>
                      {g.label} ({g.items.length})
                    </div>
                    {g.items.map((t, i) => {
                      const isOverdue = t.due_date && g.key !== "done" && dayjs(t.due_date).isBefore(today);
                      return (
                        <div key={i} style={{ fontSize: 12, padding: "3px 0", color: g.key === "done" ? "#bbb" : "#262626" }}>
                          <span style={{ textDecoration: g.key === "done" ? "line-through" : "none" }}>{t.title}</span>
                          {t.due_date && (
                            <span style={{ fontSize: 10, marginLeft: 4, color: isOverdue ? "#ff4d4f" : "#999" }}>
                              {dayjs(t.due_date).format("MM-DD")}
                            </span>
                          )}
                          {t.assignee && <span style={{ fontSize: 10, color: "#bbb", marginLeft: 4 }}>{t.assignee}</span>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })() : (
            <div style={{ color: "#bbb", fontSize: 12, textAlign: "center" }}>暂无子任务</div>
          )}
        </div>
      )}

      {/* 交付报告弹窗 */}
      {reportReq && (
        <DeliveryReport
          requirementId={reportReq.id}
          requirementTitle={reportReq.title}
          open={!!reportReq}
          onClose={() => setReportReq(null)}
        />
      )}

      {/* 对齐视图弹窗 */}
      <Modal
        title={<span>🎯 对齐视图：{alignModalReq?.title}</span>}
        open={!!alignModalReq}
        onCancel={() => setAlignModalReq(null)}
        footer={null}
        width="90vw"
        style={{ top: 20 }}
        styles={{ body: { height: "70vh", padding: 0, overflow: "hidden" } }}
      >
        {alignModalReq && (
          <div style={{ height: "100%" }}>
            <AlignmentMap epicId={alignModalReq.id} />
          </div>
        )}
      </Modal>
    </div>
  );
}

/**
 * 数据统计报表页
 *
 * - 部门需求柱状图（总量 vs 已完成）
 * - 全局状态环形图
 * - 时间范围快筛 + 自定义日期
 * - 一键生成 Markdown 交付总结报告（预览 / 复制）
 */

import { useEffect, useMemo, useState } from "react";
import {
  Card, Row, Col, Statistic, Tag, Space, Button, Select, DatePicker,
  Spin, Empty, Modal, message, Divider,
} from "antd";
import {
  BarChartOutlined, FileTextOutlined, CopyOutlined, CheckCircleOutlined,
  ClockCircleOutlined, PauseCircleOutlined, PercentageOutlined,
} from "@ant-design/icons";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import dayjs, { type Dayjs } from "dayjs";
import { reportsApi } from "@/api";

const { RangePicker } = DatePicker;

/* ------------------------------------------------------------------ */
/*  颜色配置                                                          */
/* ------------------------------------------------------------------ */

const COLORS = {
  completed: "#52c41a",
  in_progress: "#1677ff",
  planning: "#d9d9d9",
  archived: "#8c8c8c",
};

const STATUS_LABEL: Record<string, string> = {
  completed: "已完成",
  in_progress: "进行中",
  planning: "规划中",
  archived: "已归档",
};

/* ------------------------------------------------------------------ */
/*  快捷时间段                                                         */
/* ------------------------------------------------------------------ */

type PeriodKey = "month" | "quarter" | "year" | "all" | "custom";

function periodToRange(key: PeriodKey): { start?: string; end?: string } {
  const now = dayjs();
  switch (key) {
    case "month":
      return { start: now.startOf("month" as any).format("YYYY-MM-DD"), end: now.endOf("month" as any).format("YYYY-MM-DD") };
    case "quarter":
      return { start: now.startOf("quarter" as any).format("YYYY-MM-DD"), end: now.endOf("quarter" as any).format("YYYY-MM-DD") };
    case "year":
      return { start: now.startOf("year" as any).format("YYYY-MM-DD"), end: now.endOf("year" as any).format("YYYY-MM-DD") };
    default:
      return {};
  }
}

const PERIOD_OPTIONS = [
  { value: "all",      label: "全量" },
  { value: "month",    label: "本月" },
  { value: "quarter",  label: "本季度" },
  { value: "year",     label: "本年度" },
  { value: "custom",   label: "自定义" },
];

/* ------------------------------------------------------------------ */
/*  主组件                                                             */
/* ------------------------------------------------------------------ */

export default function Reports() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [customRange, setCustomRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);

  /* 报告弹窗 */
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMd, setReportMd] = useState("");
  const [reportDept, setReportDept] = useState<string>("全部");
  const [reportLoading, setReportLoading] = useState(false);

  /* 当前生效的日期范围 */
  const dateParams = useMemo(() => {
    if (period === "custom") {
      return {
        start_date: customRange[0]?.format("YYYY-MM-DD") || undefined,
        end_date:   customRange[1]?.format("YYYY-MM-DD") || undefined,
      };
    }
    return periodToRange(period);
  }, [period, customRange]);

  /* 拉取数据 */
  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await reportsApi.departmentStats(dateParams as any);
      setStats(data);
    } catch {
      message.error("获取统计数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, [period, customRange[0]?.valueOf(), customRange[1]?.valueOf()]);

  /* 柱状图数据 */
  const barData = useMemo(() => {
    if (!stats?.departments) return [];
    return stats.departments.map((d: any) => ({
      name: d.department,
      "已完成": d.completed,
      "进行中": d.in_progress,
      "规划中": d.planning,
      "已归档": d.archived,
    }));
  }, [stats]);

  /* 饼图数据 */
  const pieData = useMemo(() => {
    if (!stats?.overall) return [];
    const o = stats.overall;
    return [
      { name: "已完成", value: o.completed, fill: COLORS.completed },
      { name: "进行中", value: o.in_progress, fill: COLORS.in_progress },
      { name: "规划中", value: o.planning,   fill: COLORS.planning },
      { name: "已归档", value: o.archived,   fill: COLORS.archived },
    ].filter(item => item.value > 0);
  }, [stats]);

  /* 生成报告 */
  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      const deptParam = reportDept === "全部" ? undefined : reportDept;
      const data = await reportsApi.summaryReport({
        ...dateParams as any,
        department: deptParam,
      });
      setReportMd(data.markdown);
    } catch {
      message.error("生成报告失败");
    } finally {
      setReportLoading(false);
    }
  };

  const deptOptions = useMemo(() => {
    if (!stats?.departments) return [{ value: "全部", label: "全部" }];
    return [{ value: "全部", label: "全部" }].concat(
      stats.departments.map((d: any) => ({ value: d.department, label: d.department }))
    );
  }, [stats]);

  /* ---------- 加载 / 空 ---------- */

  if (loading && !stats) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!stats) return <Empty description="暂无数据" style={{ marginTop: 120 }} />;

  const o = stats.overall;

  /* ---------- 主渲染 ---------- */

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ==================== 筛选条 ==================== */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        padding: "10px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
      }}>
        <BarChartOutlined style={{ color: "#9ca3af" }} />
        <Select
          value={period}
          onChange={v => setPeriod(v)}
          style={{ width: 120 }}
          options={PERIOD_OPTIONS}
        />
        {period === "custom" && (
          <RangePicker
            value={customRange as any}
            onChange={(d) => setCustomRange(d as [Dayjs | null, Dayjs | null])}
            style={{ width: 260 }}
            allowClear
          />
        )}
        <div style={{ flex: 1 }} />
        <Button icon={<FileTextOutlined />} onClick={() => { setReportOpen(true); setReportMd(""); }}>
          导出历史报告
        </Button>
      </div>

      {/* ==================== 统计卡片区 ==================== */}
      <Row gutter={16}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="需求总数" value={o.total}
              prefix={<BarChartOutlined style={{ color: "#1677ff" }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="已完成" value={o.completed}
              prefix={<CheckCircleOutlined style={{ color: "#52c41a" }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="进行中" value={o.in_progress}
              prefix={<ClockCircleOutlined style={{ color: "#1677ff" }} />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="完成率" value={o.rate} suffix="%"
              prefix={<PercentageOutlined style={{ color: "#52c41a" }} />} />
          </Card>
        </Col>
      </Row>

      {/* ==================== 图表区 ==================== */}
      <Row gutter={16}>
        {/* 柱状图 */}
        <Col span={16}>
          <Card title="各部门需求统计" size="small" bodyStyle={{ padding: "12px 12px 8px" }}>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={barData} margin={{ top: 8, right: 20, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="已完成" fill={COLORS.completed} radius={[3, 3, 0, 0]} />
                <Bar dataKey="进行中" fill={COLORS.in_progress} radius={[3, 3, 0, 0]} />
                <Bar dataKey="规划中" fill={COLORS.planning} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* 环形图 */}
        <Col span={8}>
          <Card title="全局状态分布" size="small" bodyStyle={{ padding: "12px 12px 8px" }}>
            <ResponsiveContainer width="100%" height={340}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={2}
                  label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={{ strokeWidth: 1 }}
                >
                  {pieData.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => `${v} 条`} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* ==================== 部门明细表 ==================== */}
      <Card title="部门明细" size="small">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {stats.departments.map((d: any) => (
            <Card key={d.department} size="small" hoverable style={{ width: 220 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{d.department}</div>
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.8 }}>
                <div>总计：<strong style={{ color: "#1f2937" }}>{d.total}</strong></div>
                <div>
                  <Tag color="green" style={{ marginRight: 4 }}>{d.completed} 完成</Tag>
                  <Tag color="blue" style={{ marginRight: 4 }}>{d.in_progress} 进行中</Tag>
                </div>
                <div style={{ color: "#52c41a", fontWeight: 500 }}>完成率 {d.rate}%</div>
              </div>
            </Card>
          ))}
          {stats.departments.length === 0 && (
            <Empty description="暂无部门数据" />
          )}
        </div>
      </Card>

      {/* ==================== 报告生成弹窗 ==================== */}
      <Modal
        title="生成交付总结报告"
        open={reportOpen}
        onCancel={() => setReportOpen(false)}
        footer={null}
        width={720}
      >
        <Space style={{ marginBottom: 12 }}>
          <span>部门：</span>
          <Select
            value={reportDept}
            onChange={setReportDept}
            style={{ width: 150 }}
            options={deptOptions}
          />
          <Button type="primary" onClick={handleGenerateReport} loading={reportLoading}>
            生成报告
          </Button>
        </Space>

        {reportMd && (
          <>
            <Divider style={{ margin: "8px 0" }} />
            <div style={{ position: "relative" }}>
              <Button
                size="small"
                icon={<CopyOutlined />}
                style={{ position: "absolute", top: 4, right: 4 }}
                onClick={() => {
                  navigator.clipboard.writeText(reportMd);
                  message.success("已复制到剪贴板");
                }}
              >
                复制
              </Button>
              <pre style={{
                background: "#f9fafb", padding: 16, borderRadius: 8,
                maxHeight: 420, overflowY: "auto", fontSize: 13, lineHeight: 1.7,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {reportMd}
              </pre>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

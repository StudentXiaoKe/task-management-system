/**
 * 需求管理页面（重新设计）

 * 顶部：统计卡片 + 搜索/筛选
 * 主体：卡片式需求列表，每条需求带完整信息
 * 抽屉：子任务详情
 */

import { useEffect, useState, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
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
  Progress,
  Row,
  Col,
  Statistic,
  Tooltip,
  Switch,
  Upload,
  Image,
  DatePicker,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  FileSearchOutlined,
  UserOutlined,
  SearchOutlined,
  LinkOutlined,
  FileTextOutlined,
  UploadOutlined,
  ProjectOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useRequirementStore, useTaskStore, useAuthStore } from "@/store";
import {
  RequirementStatus,
  RequirementPriority,
  RequirementType,
  STATUS_LABELS,
  PRIORITY_LABELS,
  REQUIREMENT_TYPE_LABELS,
} from "@/types";
import type { Requirement, RequirementCreate } from "@/types";
import DeliveryReport from "./DeliveryReport";

const PRIORITY_COLORS: Record<string, string> = {
  low: "default", medium: "blue", high: "orange", urgent: "red",
};

const REQ_TYPE_COLORS: Record<string, string> = {
  feature: "blue", optimization: "cyan", bugfix: "red", data: "purple",
};

const STATUS_COLORS: Record<string, string> = {
  planning: "#1677ff",
  in_progress: "#faad14",
  completed: "#52c41a",
  archived: "#8c8c8c",
};

const STATUS_DOT: Record<string, string> = {
  planning: "#1677ff",
  in_progress: "#faad14",
  completed: "#52c41a",
  archived: "#d9d9d9",
};

export default function RequirementList() {
  const { user } = useAuthStore();
  const canCreate = user?.role === "CLIENT" || user?.role === "MANAGER";
  const canDelete = user?.role === "MANAGER";
  const {
    requirements, loading,
    fetchRequirements, createRequirement, updateRequirement, deleteRequirement,
  } = useRequirementStore();
  const { tasks, fetchTasks } = useTaskStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Requirement | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reportReq, setReportReq] = useState<Requirement | null>(null);
  const [selectedReq, setSelectedReq] = useState<Requirement | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterPriority, setFilterPriority] = useState<string | undefined>();
  const [form] = Form.useForm();

  useEffect(() => { fetchRequirements(); }, [fetchRequirements]);

  /** 统计 */
  const stats = useMemo(() => {
    const total = requirements.length;
    const inProgress = requirements.filter((r) => r.status === "in_progress").length;
    const completed = requirements.filter((r) => r.status === "completed").length;
    const allTasks = requirements.reduce((sum, r) => sum + (r.tasks?.length || 0), 0);
    const doneTasks = requirements.reduce(
      (sum, r) => sum + (r.tasks?.filter((t) => t.status === "done").length || 0), 0
    );
    return { total, inProgress, completed, allTasks, doneTasks };
  }, [requirements]);

  /** 过滤 */
  const filtered = useMemo(() => {
    return requirements.filter((r) => {
      if (debouncedSearch && !r.title.includes(debouncedSearch) && !(r.department || "").includes(debouncedSearch)) return false;
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterPriority && r.priority !== filterPriority) return false;
      return true;
    });
  }, [requirements, debouncedSearch, filterStatus, filterPriority]);

  const openModal = (item?: Requirement) => {
    setEditItem(item || null);
    form.resetFields();
    if (item) {
      form.setFieldsValue({
        title: item.title, description: item.description,
        department: item.department, doc_link: item.doc_link,
        background: item.background, acceptance_criteria: item.acceptance_criteria,
        needs_data_extraction: item.needs_data_extraction || false,
        data_connection_info: item.data_connection_info,
        operation_steps: item.operation_steps,
        operation_screenshots: item.operation_screenshots ? JSON.parse(item.operation_screenshots) : [],
        version: item.version, status: item.status, priority: item.priority,
        req_type: item.req_type || RequirementType.FEATURE,
        target_date: item.target_date || null,
        reference_links: item.reference_links || null,
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        operation_screenshots: values.operation_screenshots?.length
          ? JSON.stringify(values.operation_screenshots)
          : null,
      };
      const ok = editItem
        ? await updateRequirement(editItem.id, payload)
        : await createRequirement(payload as RequirementCreate);
      if (ok) { setModalOpen(false); fetchRequirements(); }
    } catch {}
  };

  const handleDelete = async (id: number) => {
    if (await deleteRequirement(id)) fetchRequirements();
  };

  const viewTasks = (req: Requirement) => {
    setSelectedReq(req);
    fetchTasks({ requirement_id: req.id });
    setDrawerOpen(true);
  };

  const getProgress = (req: Requirement) => {
    const total = req.tasks?.length || 0;
    const done = req.tasks?.filter((t) => t.status === "done").length || 0;
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  /** 表格列 */
  const columns = [
    {
      title: "需求",
      key: "title",
      width: 280,
      render: (_: unknown, r: Requirement) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 4, color: "#262626" }}>
            {r.title}
          </div>
          <Space size={4}>
            <Tag color="blue" style={{ fontSize: 11 }}>{r.version}</Tag>
            <Tag color={PRIORITY_COLORS[r.priority]} style={{ fontSize: 11 }}>
              {PRIORITY_LABELS[r.priority]}
            </Tag>
            <Tag color={REQ_TYPE_COLORS[r.req_type || "feature"]} style={{ fontSize: 11 }}>
              {REQUIREMENT_TYPE_LABELS[r.req_type || "feature"]}
            </Tag>
            {r.department && <Tag style={{ fontSize: 11 }}>{r.department}</Tag>}
          </Space>
        </div>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (s: string) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: STATUS_DOT[s], display: "inline-block",
          }} />
          <span style={{ fontSize: 13 }}>{STATUS_LABELS[s]}</span>
        </span>
      ),
    },
    {
      title: "任务进度",
      key: "progress",
      width: 200,
      render: (_: unknown, r: Requirement) => {
        const { total, done, pct } = getProgress(r);
        return total > 0 ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <Progress percent={pct} size="small" style={{ flex: 1, margin: 0 }}
                strokeColor={pct === 100 ? "#52c41a" : { from: "#1677ff", to: "#52c41a" }}
                status={pct === 100 ? "success" : "active"} />
              <span style={{ fontSize: 12, color: "#8c8c8c", whiteSpace: "nowrap" }}>{done}/{total}</span>
            </div>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: "#bbb" }}>暂无子任务</span>
        );
      },
    },
    {
      title: "文档",
      key: "doc",
      width: 60,
      render: (_: unknown, r: Requirement) => r.doc_link ? (
        <Tooltip title="查看文档">
          <a href={r.doc_link} target="_blank" rel="noopener noreferrer"
            style={{ color: "#1677ff", fontSize: 16 }}>
            <LinkOutlined />
          </a>
        </Tooltip>
      ) : <span style={{ color: "#d9d9d9" }}>-</span>,
    },
    {
      title: "",
      key: "action",
      width: 140,
      render: (_: unknown, r: Requirement) => (
        <Space>
          <Tooltip title="查看子任务">
            <Button type="text" size="small" icon={<EyeOutlined />}
              onClick={() => viewTasks(r)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />}
              onClick={() => openModal(r)} />
          </Tooltip>
          {canDelete && (
            <Popconfirm title="确定删除？" description="将同时删除所有子任务"
              onConfirm={() => handleDelete(r.id)}>
              <Tooltip title="删除">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
          <Tooltip title="交付报告">
            <Button type="text" size="small" icon={<FileTextOutlined />}
              onClick={() => setReportReq(r)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* ==================== 顶部统计 ==================== */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" hoverable>
            <Statistic title="需求总数" value={stats.total}
              prefix={<ProjectOutlined style={{ color: "#1677ff" }} />}
              valueStyle={{ fontSize: 24 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" hoverable>
            <Statistic title="进行中" value={stats.inProgress}
              prefix={<ThunderboltOutlined style={{ color: "#faad14" }} />}
              valueStyle={{ fontSize: 24, color: "#faad14" }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" hoverable>
            <Statistic title="已完成" value={stats.completed}
              prefix={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
              valueStyle={{ fontSize: 24, color: "#52c41a" }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" hoverable>
            <Statistic title="子任务完成" value={`${stats.doneTasks}/${stats.allTasks}`}
              prefix={<FileTextOutlined style={{ color: "#722ed1" }} />}
              valueStyle={{ fontSize: 24, color: "#722ed1" }} />
          </Card>
        </Col>
      </Row>

      {/* ==================== 需求列表 ==================== */}
      <Card
        title={<span style={{ fontWeight: 600, fontSize: 16 }}>需求列表</span>}
        extra={
          canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              新建需求
            </Button>
          )
        }
      >
        {/* 筛选栏 */}
        <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Input
            placeholder="搜索需求标题或部门"
            prefix={<SearchOutlined style={{ color: "#bbb" }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Select placeholder="状态" allowClear style={{ width: 120 }}
            value={filterStatus} onChange={setFilterStatus}>
            {Object.entries(STATUS_LABELS)
              .filter(([k]) => ["planning", "in_progress", "completed", "archived"].includes(k))
              .map(([v, l]) => <Select.Option key={v} value={v}>{l}</Select.Option>)}
          </Select>
          <Select placeholder="优先级" allowClear style={{ width: 120 }}
            value={filterPriority} onChange={setFilterPriority}>
            {Object.entries(PRIORITY_LABELS).map(([v, l]) =>
              <Select.Option key={v} value={v}>{l}</Select.Option>)}
          </Select>
          {(filterStatus || filterPriority || search) && (
            <Button type="link" onClick={() => { setSearch(""); setFilterStatus(undefined); setFilterPriority(undefined); }}>
              清除筛选
            </Button>
          )}
        </div>

        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
          size="middle"
          locale={{ emptyText: "暂无需求" }}
        />
      </Card>

      {/* ==================== 创建/编辑弹窗 ==================== */}
      <Modal
        title={editItem ? "编辑需求" : "新建需求"}
        open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)}
        okText="保存" cancelText="取消" width={720}
      >
        <Form form={form} layout="vertical"
          initialValues={{
            version: "v1.0", status: RequirementStatus.PLANNING,
            priority: RequirementPriority.MEDIUM, req_type: RequirementType.FEATURE,
          }}>
          {/* 标题 + 描述：全宽 */}
          <Form.Item name="title" label="需求标题" rules={[{ required: true, message: "请输入需求标题" }]}>
            <Input placeholder="请输入需求标题" maxLength={200} />
          </Form.Item>
          <Row gutter={16}>
            {/* ======== 左栏：主内容 (Col 15) ======== */}
            <Col span={15}>
              <Form.Item name="description" label="需求描述">
                <Input.TextArea placeholder="请输入需求描述" rows={3} maxLength={2000} />
              </Form.Item>
              <Form.Item name="background" label="业务背景与目标">
                <Input.TextArea placeholder="需要解决什么问题，业务目标是什么" rows={3} maxLength={2000} />
              </Form.Item>
              <Form.Item name="acceptance_criteria" label="验收标准">
                <Input.TextArea placeholder="明确的验收标准和交付物" rows={3} maxLength={2000} />
              </Form.Item>
              <Form.Item name="doc_link" label="文档链接">
                <Input placeholder="粘贴文档链接（飞书/Confluence/语雀等）" maxLength={500}
                  prefix={<LinkOutlined style={{ color: "#bbb" }} />} />
              </Form.Item>
            </Col>
            {/* ======== 右栏：属性面板 (Col 9) ======== */}
            <Col span={9}>
              <div style={{ background: "#f9fafb", borderRadius: 8, padding: "12px 12px 4px", marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: "#8c8c8c", fontWeight: 600, marginBottom: 12, letterSpacing: 0.5 }}>
                  属性
                </div>
                <Form.Item name="req_type" label="需求类型" style={{ marginBottom: 12 }}>
                  <Select options={[
                    { value: "feature", label: "新功能" },
                    { value: "optimization", label: "优化" },
                    { value: "bugfix", label: "修复" },
                    { value: "data", label: "数据支持" },
                  ]} />
                </Form.Item>
                <Form.Item name="priority" label="优先级" style={{ marginBottom: 12 }}>
                  <Select options={[
                    { value: "urgent", label: "紧急" },
                    { value: "high", label: "高" },
                    { value: "medium", label: "中" },
                    { value: "low", label: "低" },
                  ]} />
                </Form.Item>
                <Form.Item name="status" label="状态" style={{ marginBottom: 12 }}>
                  <Select options={[
                    { value: "planning", label: "规划中" },
                    { value: "in_progress", label: "进行中" },
                    { value: "completed", label: "已完成" },
                    { value: "archived", label: "已归档" },
                  ]} />
                </Form.Item>
                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item name="department" label="所属部门" style={{ marginBottom: 12 }}>
                      <Input placeholder="产品部" maxLength={100} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="version" label="版本号" rules={[{ required: true, message: "必填" }]}
                      style={{ marginBottom: 12 }}>
                      <Input placeholder="v1.0" maxLength={50} />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="target_date" label="期望交付日期" style={{ marginBottom: 12 }}>
                  <DatePicker placeholder="选择日期" style={{ width: "100%" }} />
                </Form.Item>
              </div>
            </Col>
          </Row>
          <Form.Item
            name="needs_data_extraction"
            label="是否涉及数据提取"
            valuePropName="checked"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.needs_data_extraction !== cur.needs_data_extraction}
          >
            {({ getFieldValue }) =>
              getFieldValue("needs_data_extraction") ? (
                <>
                  <Form.Item name="data_connection_info" label="数据连接地址">
                    <Input.TextArea placeholder="数据库连接地址、API 地址等" rows={2} maxLength={1000} />
                  </Form.Item>
                  <Form.Item name="operation_steps" label="操作步骤">
                    <Input.TextArea
                      placeholder={"请按步骤描述取数操作流程，例如：\n1. 登录数据库管理系统\n2. 执行查询 SQL: SELECT ...\n3. 导出为 CSV 格式"}
                      rows={5}
                      maxLength={5000}
                    />
                  </Form.Item>
                  <Form.Item name="operation_screenshots" label="操作截图">
                    <Upload
                      listType="picture-card"
                      multiple
                      maxCount={9}
                      beforeUpload={(file) => {
                        return new Promise((resolve) => {
                          const reader = new FileReader();
                          reader.onload = () => {
                            const current = form.getFieldValue("operation_screenshots") || [];
                            form.setFieldsValue({
                              operation_screenshots: [...current, reader.result],
                            });
                          };
                          reader.readAsDataURL(file);
                          resolve(false);
                        });
                      }}
                      onRemove={(file) => {
                        const current = form.getFieldValue("operation_screenshots") || [];
                        const idx = parseInt(file.uid, 10);
                        form.setFieldsValue({
                          operation_screenshots: current.filter((_: string, i: number) => i !== idx),
                        });
                      }}
                      fileList={[]}
                    >
                      <div>
                        <UploadOutlined />
                        <div style={{ marginTop: 8, fontSize: 12 }}>上传截图</div>
                      </div>
                    </Upload>
                    {(() => {
                      const screenshots = form.getFieldValue("operation_screenshots") || [];
                      return screenshots.length > 0 ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                          {screenshots.map((src: string, i: number) => (
                            <div key={i} style={{ position: "relative" }}>
                              <Image src={src} width={80} height={80} style={{ objectFit: "cover", borderRadius: 4 }} />
                              <span
                                onClick={() => {
                                  const current = form.getFieldValue("operation_screenshots") || [];
                                  form.setFieldsValue({
                                    operation_screenshots: current.filter((_: string, idx: number) => idx !== i),
                                  });
                                }}
                                style={{
                                  position: "absolute", top: -6, right: -6, width: 18, height: 18,
                                  background: "#ff4d4f", color: "#fff", borderRadius: "50%",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: 12, cursor: "pointer",
                                }}
                              >
                                x
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null;
                    })()}
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>

      {/* ==================== 子任务弹窗 ==================== */}
      <Modal
        open={drawerOpen}
        onCancel={() => setDrawerOpen(false)}
        width={660}
        footer={null}
        styles={{ body: { padding: 0 } }}
        title={
          selectedReq ? (
            <div style={{ paddingRight: 32 }}>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
                {selectedReq.title}
              </div>
              <Space size={6}>
                <Tag color="blue">{selectedReq.version}</Tag>
                <Tag color={PRIORITY_COLORS[selectedReq.priority]}>{PRIORITY_LABELS[selectedReq.priority]}</Tag>
                {selectedReq.department && <Tag>{selectedReq.department}</Tag>}
                {selectedReq.doc_link && (
                  <a href={selectedReq.doc_link} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: "#1677ff", display: "inline-flex", alignItems: "center", gap: 3, marginLeft: 4 }}>
                    <LinkOutlined /> 文档
                  </a>
                )}
              </Space>
            </div>
          ) : "子任务"
        }
      >
        {selectedReq && (() => {
          const total = tasks.length;
          const done = tasks.filter((t) => t.status === "done").length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;

          const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string; order: number }> = {
            todo:        { color: "#8c8c8c", bg: "#f5f5f5", icon: <ClockCircleOutlined />,  label: "待办",   order: 0 },
            in_progress: { color: "#1677ff", bg: "#e6f4ff", icon: <SyncOutlined />,         label: "进行中", order: 1 },
            review:      { color: "#faad14", bg: "#fffbe6", icon: <FileSearchOutlined />,   label: "待验收", order: 2 },
            done:        { color: "#52c41a", bg: "#f6ffed", icon: <CheckCircleOutlined />,  label: "已完成", order: 3 },
          };

          // 按状态分组（需求管理只显示：待办、进行中、已完成）
          const groups = Object.entries(STATUS_CONFIG)
            .filter(([key]) => ["todo", "in_progress", "done"].includes(key))
            .sort((a, b) => a[1].order - b[1].order)
            .map(([key, cfg]) => ({
              key,
              ...cfg,
              tasks: tasks.filter((t) => t.status === key),
            }))
            .filter((g) => g.tasks.length > 0);

          // 单条任务渲染（只读）
          const renderTask = (task: typeof tasks[0], cfg: typeof STATUS_CONFIG[string]) => {
            return (
              <div key={task.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", borderRadius: 6,
                background: "#fafafa", border: "1px solid #f0f0f0",
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: cfg.color, flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: 13,
                    textDecoration: task.status === "done" ? "line-through" : "none",
                    color: task.status === "done" ? "#bbb" : "#262626",
                  }}>
                    {task.title}
                  </span>
                </div>
                {task.assignee && (
                  <span style={{ fontSize: 12, color: "#999", flexShrink: 0 }}>
                    <UserOutlined style={{ marginRight: 2 }} />{task.assignee}
                  </span>
                )}
              </div>
            );
          };

          return (
            <>
              {/* 进度条 */}
              <div style={{ padding: "14px 24px 10px", borderBottom: "1px solid #f0f0f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Progress percent={pct} style={{ flex: 1, margin: 0 }}
                    strokeColor={pct === 100 ? "#52c41a" : { from: "#1677ff", to: "#52c41a" }}
                    status={pct === 100 ? "success" : "active"} />
                  <span style={{ fontSize: 13, color: "#8c8c8c", flexShrink: 0 }}>{done}/{total}</span>
                </div>
              </div>

              {/* 按状态分组的任务列表 */}
              <div style={{ padding: "12px 24px 16px", maxHeight: 480, overflowY: "auto" }}>
                {total > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {groups.map((group) => (
                      <div key={group.key}>
                        {/* 分组标题 */}
                        <div style={{
                          display: "flex", alignItems: "center", gap: 8,
                          marginBottom: 8, paddingBottom: 4,
                          borderBottom: `2px solid ${group.color}30`,
                        }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: "50%",
                            background: group.color, display: "inline-block",
                          }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#262626" }}>
                            {group.label}
                          </span>
                          <span style={{
                            fontSize: 11, color: "#fff", background: group.color,
                            borderRadius: 10, padding: "1px 8px", lineHeight: "18px",
                          }}>
                            {group.tasks.length}
                          </span>
                          <span style={{ flex: 1 }} />
                        </div>
                        {/* 任务列表 */}
                        {group.tasks.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {group.tasks.map((task) => renderTask(task, group))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: "#d9d9d9", padding: "4px 12px" }}>
                            暂无
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "48px 0", color: "#bbb" }}>
                    <FileTextOutlined style={{ fontSize: 36, marginBottom: 8 }} />
                    <div>暂无子任务</div>
                  </div>
                )}
              </div>

              {/* ==================== 数据提取状态与指引 ==================== */}
              {selectedReq.needs_data_extraction && (
                (selectedReq.data_connection_info || selectedReq.operation_steps || selectedReq.operation_screenshots) && (
                  <div style={{ padding: "16px 20px 12px", borderTop: "1px solid #f0f0f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>📡 数据提取指引</span>
                      <Tag color="orange" style={{ margin: 0 }}>涉及数据提取</Tag>
                    </div>

                    <div style={{
                      background: "#fffbe6", border: "1px solid #ffe58f", borderRadius: 8,
                      padding: "14px 16px",
                    }}>
                      {/* 连接地址 */}
                      {selectedReq.data_connection_info && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 12, color: "#92400e", marginBottom: 4 }}>连接地址</div>
                          <div style={{
                            background: "#fff", padding: "8px 10px", borderRadius: 6,
                            fontSize: 13, color: "#374151", wordBreak: "break-all",
                            border: "1px solid #fde68a",
                          }}>
                            {selectedReq.data_connection_info}
                          </div>
                        </div>
                      )}

                      {/* 操作步骤 */}
                      {selectedReq.operation_steps && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 12, color: "#92400e", marginBottom: 4 }}>操作步骤</div>
                          <pre style={{
                            background: "#fff", padding: "8px 10px", borderRadius: 6,
                            fontSize: 13, lineHeight: 1.8, color: "#374151",
                            whiteSpace: "pre-wrap", wordBreak: "break-word",
                            border: "1px solid #fde68a", margin: 0,
                          }}>
                            {selectedReq.operation_steps}
                          </pre>
                        </div>
                      )}

                      {/* 操作截图 */}
                      {selectedReq.operation_screenshots && (() => {
                        const urls = (() => { try { return JSON.parse(selectedReq.operation_screenshots!); } catch { return []; } })();
                        return urls.length > 0 ? (
                          <div>
                            <div style={{ fontSize: 12, color: "#92400e", marginBottom: 4 }}>操作截图</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {urls.map((url: string, i: number) => (
                                <img key={i} src={url} alt={`截图${i + 1}`}
                                  style={{ maxWidth: 160, borderRadius: 6, border: "1px solid #fde68a", cursor: "pointer" }}
                                />
                              ))}
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                )
              )}
            </>
          );
        })()}
      </Modal>

      {/* 交付报告弹窗 */}
      {reportReq && (
        <DeliveryReport
          requirementId={reportReq.id}
          requirementTitle={reportReq.title}
          open={!!reportReq}
          onClose={() => setReportReq(null)}
        />
      )}
    </div>
  );
}

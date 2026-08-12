/**
 * 循环任务页面

 * 功能：
 * - 展示当前到期的循环任务清单，勾选即完成
 * - 按日期查看历史记录
 * - 管理循环任务（添加/编辑/删除，支持设置周期）
 */

import { useEffect, useState } from "react";
import {
  Card,
  Checkbox,
  List,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Popconfirm,
  Tag,
  Typography,
  Segmented,
  DatePicker,
  Progress,
  Row,
  Col,
  Empty,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useRecurringTaskStore, useMemberStore } from "@/store";
import { CYCLE_OPTIONS, CYCLE_LABELS } from "@/types";
import type { RecurringTask } from "@/types";

const { Text } = Typography;

/** 周期颜色 */
const CYCLE_COLORS: Record<string, string> = {
  daily: "green",
  weekly: "blue",
  biweekly: "purple",
  monthly: "orange",
};

export default function RecurringTasks() {
  const {
    checklist,
    tasks,
    history,
    loading,
    fetchChecklist,
    fetchTasks,
    fetchHistory,
    toggleTask,
    createTask,
    deleteTask,
    updateTask,
  } = useRecurringTaskStore();

  const { members, fetchMembers } = useMemberStore();

  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [tab, setTab] = useState<"checklist" | "manage">("checklist");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<RecurringTask | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchChecklist(selectedDate);
    fetchTasks();
    fetchHistory(14);
    fetchMembers();
  }, [fetchChecklist, fetchTasks, fetchHistory, fetchMembers]);

  /** 切换日期 */
  const handleDateChange = (d: dayjs.Dayjs | null) => {
    const dateStr = d ? d.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
    setSelectedDate(dateStr);
    fetchChecklist(dateStr);
  };

  /** 勾选/取消 */
  const handleToggle = async (logId: number) => {
    await toggleTask(logId);
    fetchHistory(14);
  };

  /** 打开弹窗 */
  const openModal = (item?: RecurringTask) => {
    setEditItem(item || null);
    form.resetFields();
    if (item) {
      form.setFieldsValue({ title: item.title, assignee: item.assignee, cycle: item.cycle });
    }
    setModalOpen(true);
  };

  /** 提交 */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      let ok: boolean;
      if (editItem) {
        ok = await updateTask(editItem.id, values);
      } else {
        ok = await createTask(values.title, values.cycle, values.assignee);
      }
      if (ok) {
        setModalOpen(false);
        fetchTasks();
        fetchChecklist(selectedDate);
      }
    } catch {}
  };

  const handleDelete = async (id: number) => {
    const ok = await deleteTask(id);
    if (ok) {
      fetchTasks();
      fetchChecklist(selectedDate);
    }
  };

  const completedCount = checklist.filter((i) => i.completed).length;
  const totalCount = checklist.length;
  const isToday = selectedDate === dayjs().format("YYYY-MM-DD");

  return (
    <div>
      {/* 顶部操作栏 */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Space>
            <DatePicker value={dayjs(selectedDate)} onChange={handleDateChange} allowClear={false} />
            {isToday && <Tag color="blue">今天</Tag>}
            <Tag>{completedCount}/{totalCount} 已完成</Tag>
          </Space>
          <Segmented
            options={[
              { value: "checklist", icon: <UnorderedListOutlined />, label: "清单" },
              { value: "manage", icon: <SettingOutlined />, label: "任务管理" },
            ]}
            value={tab}
            onChange={(v) => setTab(v as "checklist" | "manage")}
          />
        </div>
      </Card>

      {/* ==================== 清单视图 ==================== */}
      {tab === "checklist" && (
        <Row gutter={16}>
          <Col xs={24} lg={16}>
            <Card
              title={`${selectedDate} 任务清单`}
              extra={<Text type="secondary">{completedCount} / {totalCount}</Text>}
            >
              {totalCount > 0 ? (
                <>
                  <Progress
                    percent={totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}
                    status={completedCount === totalCount && totalCount > 0 ? "success" : "active"}
                    style={{ marginBottom: 16 }}
                  />
                  <List
                    dataSource={checklist}
                    loading={loading}
                    renderItem={(item) => (
                      <List.Item
                        style={{
                          padding: "12px 16px",
                          background: item.completed ? "#f6ffed" : "#fff",
                          borderRadius: 8,
                          marginBottom: 4,
                          border: "1px solid #f0f0f0",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 12 }}>
                          <Checkbox checked={item.completed} onChange={() => handleToggle(item.log_id)} />
                          <div style={{ flex: 1 }}>
                            <Text
                              delete={item.completed}
                              type={item.completed ? "secondary" : undefined}
                              style={{ fontSize: 15 }}
                            >
                              {item.title}
                            </Text>
                            {item.assignee && (
                              <Tag style={{ marginLeft: 8 }} color="blue">{item.assignee}</Tag>
                            )}
                            <Tag color={CYCLE_COLORS[item.cycle]} style={{ marginLeft: 4 }}>
                              {CYCLE_LABELS[item.cycle]}
                            </Tag>
                          </div>
                          {item.completed ? (
                            <Tag icon={<CheckCircleFilled />} color="success">已完成</Tag>
                          ) : (
                            <Tag icon={<ClockCircleOutlined />}>待完成</Tag>
                          )}
                        </div>
                      </List.Item>
                    )}
                  />
                </>
              ) : (
                <Empty description="今天没有到期的循环任务">
                  <Button type="primary" onClick={() => setTab("manage")}>去管理任务</Button>
                </Empty>
              )}
            </Card>
          </Col>

          {/* 右侧：近 14 天完成率 */}
          <Col xs={24} lg={8}>
            <Card title="近期完成率" bodyStyle={{ padding: "12px 16px" }}>
              {history.length > 0 ? (
                <List
                  dataSource={history}
                  size="small"
                  renderItem={(item) => (
                    <List.Item style={{ padding: "6px 0" }}>
                      <div style={{ width: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                          <Text style={{ fontSize: 13 }}>{item.date}</Text>
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            {item.total > 0 ? `${item.done}/${item.total}` : "-"}
                          </Text>
                        </div>
                        {item.total > 0 ? (
                          <Progress
                            percent={item.rate}
                            size="small"
                            status={item.rate === 100 ? "success" : item.rate === 0 ? "exception" : "active"}
                          />
                        ) : (
                          <div style={{ height: 8, background: "#f5f5f5", borderRadius: 4 }} />
                        )}
                      </div>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* ==================== 任务管理视图 ==================== */}
      {tab === "manage" && (
        <Card
          title="循环任务管理"
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              添加任务
            </Button>
          }
        >
          <List
            dataSource={tasks}
            loading={loading}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button type="link" icon={<EditOutlined />} onClick={() => openModal(item)}>
                    编辑
                  </Button>,
                  <Popconfirm title="确定删除？" onConfirm={() => handleDelete(item.id)}>
                    <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      {item.title}
                      <Tag color={CYCLE_COLORS[item.cycle]}>{CYCLE_LABELS[item.cycle]}</Tag>
                      {!item.is_active && <Tag color="default">已停用</Tag>}
                    </Space>
                  }
                  description={item.assignee || "未分配"}
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* ==================== 弹窗 ==================== */}
      <Modal
        title={editItem ? "编辑循环任务" : "添加循环任务"}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ cycle: "daily" }}
        >
          <Form.Item
            name="title"
            label="任务名称"
            rules={[{ required: true, message: "请输入任务名称" }]}
          >
            <Input placeholder="如：每日站会、周报、环境巡检" maxLength={200} />
          </Form.Item>
          <Form.Item
            name="cycle"
            label="循环周期"
            rules={[{ required: true, message: "请选择周期" }]}
          >
            <Select>
              {CYCLE_OPTIONS.map((o) => (
                <Select.Option key={o.value} value={o.value}>
                  {o.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="assignee" label="负责人">
            <Select placeholder="选择负责人" allowClear>
              {members.map((m) => (
                <Select.Option key={m.name} value={m.name}>{m.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

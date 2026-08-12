/**
 * 每日待办清单页面

 * 功能：
 * - 展示当天的每日任务清单，勾选即完成
 * - 按日期查看历史记录
 * - 管理每日任务模板（添加/编辑/删除）
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
  Statistic,
  Row,
  Col,
  Empty,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  HistoryOutlined,
  UnorderedListOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useDailyTaskStore, useMemberStore } from "@/store";

const { Text, Title } = Typography;

export default function DailyChecklist() {
  const {
    checklist,
    templates,
    history,
    loading,
    fetchChecklist,
    fetchTemplates,
    fetchHistory,
    toggleTask,
    createTemplate,
    deleteTemplate,
    updateTemplate,
  } = useDailyTaskStore();

  const { members, fetchMembers } = useMemberStore();

  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [tab, setTab] = useState<"checklist" | "templates">("checklist");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchChecklist(selectedDate);
    fetchTemplates();
    fetchHistory(7);
    fetchMembers();
  }, []);

  /** 切换日期 */
  const handleDateChange = (d: dayjs.Dayjs | null) => {
    const dateStr = d ? d.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
    setSelectedDate(dateStr);
    fetchChecklist(dateStr);
  };

  /** 勾选/取消 */
  const handleToggle = async (logId: number) => {
    await toggleTask(logId);
    fetchHistory(7);
  };

  /** 打开创建/编辑模板弹窗 */
  const openModal = (tpl?: { id: number; title: string; assignee: string | null }) => {
    setEditId(tpl?.id || null);
    form.resetFields();
    if (tpl) {
      form.setFieldsValue({ title: tpl.title, assignee: tpl.assignee });
    }
    setModalOpen(true);
  };

  /** 提交模板 */
  const handleTemplateSubmit = async () => {
    try {
      const values = await form.validateFields();
      let ok: boolean;
      if (editId) {
        ok = await updateTemplate(editId, values);
      } else {
        ok = await createTemplate(values.title, values.assignee);
      }
      if (ok) {
        setModalOpen(false);
        fetchTemplates();
      }
    } catch {}
  };

  /** 删除模板 */
  const handleDeleteTemplate = async (id: number) => {
    const ok = await deleteTemplate(id);
    if (ok) fetchTemplates();
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
            <DatePicker
              value={dayjs(selectedDate)}
              onChange={handleDateChange}
              allowClear={false}
            />
            {isToday && <Tag color="blue">今天</Tag>}
          </Space>
          <Segmented
            options={[
              { value: "checklist", icon: <UnorderedListOutlined />, label: "清单" },
              { value: "templates", icon: <SettingOutlined />, label: "模板管理" },
            ]}
            value={tab}
            onChange={(v) => setTab(v as "checklist" | "templates")}
          />
        </div>
      </Card>

      {/* ==================== 清单视图 ==================== */}
      {tab === "checklist" && (
        <Row gutter={16}>
          <Col xs={24} lg={16}>
            <Card
              title={`${selectedDate} 每日清单`}
              extra={
                <Text type="secondary">
                  {completedCount} / {totalCount} 已完成
                </Text>
              }
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
                          padding: "12px 0",
                          background: item.completed ? "#f6ffed" : "transparent",
                          borderRadius: 8,
                          marginBottom: 4,
                          transition: "background 0.2s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 12 }}>
                          <Checkbox
                            checked={item.completed}
                            onChange={() => handleToggle(item.log_id)}
                          />
                          <div style={{ flex: 1 }}>
                            <Text
                              delete={item.completed}
                              type={item.completed ? "secondary" : undefined}
                              style={{ fontSize: 15 }}
                            >
                              {item.title}
                            </Text>
                            {item.assignee && (
                              <Tag style={{ marginLeft: 8 }} color="blue">
                                {item.assignee}
                              </Tag>
                            )}
                          </div>
                          {item.completed ? (
                            <Tag icon={<CheckCircleFilled />} color="success">
                              已完成
                            </Tag>
                          ) : (
                            <Tag icon={<ClockCircleOutlined />}>待完成</Tag>
                          )}
                        </div>
                      </List.Item>
                    )}
                  />
                </>
              ) : (
                <Empty description="暂无每日任务，请先在模板管理中添加">
                  <Button type="primary" onClick={() => setTab("templates")}>
                    去添加模板
                  </Button>
                </Empty>
              )}
            </Card>
          </Col>

          {/* 右侧：近 7 天完成率 */}
          <Col xs={24} lg={8}>
            <Card title="近 7 天完成率">
              {history.length > 0 ? (
                <List
                  dataSource={history}
                  size="small"
                  renderItem={(item) => (
                    <List.Item style={{ padding: "8px 0" }}>
                      <div style={{ width: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <Text>{item.date}</Text>
                          <Text type="secondary">
                            {item.done}/{item.total}
                          </Text>
                        </div>
                        <Progress
                          percent={item.rate}
                          size="small"
                          status={item.rate === 100 ? "success" : item.rate === 0 ? "exception" : "active"}
                        />
                      </div>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无历史数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* ==================== 模板管理视图 ==================== */}
      {tab === "templates" && (
        <Card
          title="每日任务模板"
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              添加模板
            </Button>
          }
        >
          <List
            dataSource={templates}
            loading={loading}
            renderItem={(tpl) => (
              <List.Item
                actions={[
                  <Button type="link" onClick={() => openModal(tpl)}>
                    编辑
                  </Button>,
                  <Popconfirm title="确定删除？" onConfirm={() => handleDeleteTemplate(tpl.id)}>
                    <Button type="link" danger>
                      删除
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={tpl.title}
                  description={
                    <Space>
                      {tpl.assignee && <Tag color="blue">{tpl.assignee}</Tag>}
                      <Tag color={tpl.is_active ? "green" : "default"}>
                        {tpl.is_active ? "启用" : "停用"}
                      </Tag>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* ==================== 模板弹窗 ==================== */}
      <Modal
        title={editId ? "编辑模板" : "添加模板"}
        open={modalOpen}
        onOk={handleTemplateSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="任务名称"
            rules={[{ required: true, message: "请输入任务名称" }]}
          >
            <Input placeholder="如：每日站会、提交日报" maxLength={200} />
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
        </Form>
      </Modal>
    </div>
  );
}

/**
 * 成员管理页面
 *
 * 表格：名称（加粗）· 账号 · 职称 · 密码（脱敏/切换）· 角色 · 操作
 * 表单：名称 · 账号 · 职称 · 初始密码 · 角色
 */

import { useEffect, useState } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Popconfirm,
  Tag,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  KeyOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from "@ant-design/icons";
import { useMemberStore } from "@/store";
import type { Member } from "@/types";

const TITLE_OPTIONS = [
  { value: "高级前端工程师", label: "高级前端工程师" },
  { value: "前端工程师",     label: "前端工程师" },
  { value: "后端工程师",     label: "后端工程师" },
  { value: "全栈工程师",     label: "全栈工程师" },
  { value: "测试工程师",     label: "测试工程师" },
  { value: "项目经理",       label: "项目经理" },
  { value: "产品经理",       label: "产品经理" },
];

const SYSROLE_TAG: Record<string, { label: string; color: string }> = {
  DEVELOPER: { label: "DEVELOPER", color: "green" },
  MANAGER:   { label: "MANAGER",   color: "orange" },
  CLIENT:    { label: "CLIENT",    color: "blue" },
};

export default function MemberManage() {
  const {
    members,
    loading,
    fetchMembers,
    createMember,
    updateMember,
    deleteMember,
    resetPassword,
  } = useMemberStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Member | null>(null);
  const [form] = Form.useForm();
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Member | null>(null);
  const [resetForm] = Form.useForm();
  const [showPwd, setShowPwd] = useState<Record<number, boolean>>({});

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const openModal = (item?: Member) => {
    setEditItem(item || null);
    form.resetFields();
    if (item) {
      form.setFieldsValue({
        name: item.name,
        title: item.title,
        username: item.username,
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      let ok: boolean;
      if (editItem) {
        ok = await updateMember(editItem.id, {
          name: values.name,
          title: values.title,
        });
      } else {
        ok = await createMember(values);
      }
      if (ok) setModalOpen(false);
    } catch {}
  };

  const handleDelete = async (id: number) => {
    await deleteMember(id);
  };

  const openResetModal = (member: Member) => {
    setResetTarget(member);
    resetForm.resetFields();
    setResetModalOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    const values = resetForm.getFieldsValue();
    const ok = await resetPassword(resetTarget.id, values.new_password || undefined);
    if (ok) setResetModalOpen(false);
  };

  const columns = [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      width: 130,
      render: (v: string) => (
        <span style={{ fontWeight: 600 }}>
          <UserOutlined style={{ marginRight: 6 }} />
          {v}
        </span>
      ),
    },
    {
      title: "账号",
      dataIndex: "username",
      key: "username",
      width: 120,
      render: (v: string | null) => v || <span style={{ color: "#bbb" }}>—</span>,
    },
    {
      title: "职称",
      dataIndex: "title",
      key: "title",
      width: 150,
      render: (v: string | null) => v
        ? <Tag style={{ fontSize: 12 }}>{v}</Tag>
        : <span style={{ color: "#bbb" }}>未设置</span>,
    },
    {
      title: "密码",
      dataIndex: "initial_password",
      key: "initial_password",
      width: 170,
      render: (v: string | null, record: Member) => {
        if (!v) return <span style={{ color: "#bbb" }}>—</span>;
        const visible = !!showPwd[record.id];
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <span style={{ fontFamily: "monospace", color: visible ? "#1f2937" : "#bbb", letterSpacing: 1 }}>
              {visible ? v : "••••••••"}
            </span>
            <Button
              type="text"
              size="small"
              icon={visible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => setShowPwd(prev => ({ ...prev, [record.id]: !prev[record.id] }))}
              style={{ padding: 0, minWidth: 0 }}
            />
          </span>
        );
      },
    },
    {
      title: "角色",
      dataIndex: "system_role",
      key: "system_role",
      width: 130,
      render: (v: string | null) => {
        const info = SYSROLE_TAG[v || ""];
        return info
          ? <Tag color={info.color}>{info.label}</Tag>
          : <span style={{ color: "#bbb" }}>未绑定账号</span>;
      },
    },
    {
      title: "操作",
      key: "action",
      width: 200,
      render: (_: unknown, record: Member) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>
            编辑
          </Button>
          <Tooltip title="重置密码">
            <Button type="link" size="small" icon={<KeyOutlined />} onClick={() => openResetModal(record)}>
              重置密码
            </Button>
          </Tooltip>
          <Popconfirm title="确定删除该成员？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="成员管理"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          添加成员
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={members}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="middle"
      />

      {/* ===== 添加/编辑成员 ===== */}
      <Modal
        title={editItem ? "编辑成员" : "添加成员"}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={520}
      >
        <Form form={form} layout="vertical"
          initialValues={{ password: "Dev@123456" }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入成员姓名" }]}>
            <Input placeholder="如：成员A" maxLength={50} />
          </Form.Item>

          {!editItem && (
            <Form.Item name="username" label="账号" rules={[{ required: true, message: "请输入登录账号" }]}>
              <Input placeholder="如：memberA" maxLength={50} />
            </Form.Item>
          )}

          <Form.Item name="title" label="职称">
            <Select
              placeholder="选择或输入职称"
              options={TITLE_OPTIONS}
              showSearch
              allowClear
              optionFilterProp="label"
            />
          </Form.Item>

          {!editItem && (
            <Form.Item name="password" label="初始密码"
              extra="用户首次登录密码，可在此修改"
            >
              <Input.Password placeholder="默认 Dev@123456" maxLength={100} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* ===== 重置密码 ===== */}
      <Modal
        title={`重置密码 — ${resetTarget?.name || ""}`}
        open={resetModalOpen}
        onOk={handleResetPassword}
        onCancel={() => setResetModalOpen(false)}
        okText="确认重置"
        cancelText="取消"
        width={400}
      >
        <Form form={resetForm} layout="vertical">
          <Form.Item name="new_password" label="新密码" extra="留空则重置为 Dev@123456">
            <Input.Password placeholder="默认 Dev@123456" maxLength={100} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

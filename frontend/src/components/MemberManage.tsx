/**
 * 成员管理页面

 * 支持添加、编辑、删除团队成员。
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
  Popconfirm,
  Tag,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useMemberStore } from "@/store";
import type { Member } from "@/types";

export default function MemberManage() {
  const {
    members,
    loading,
    fetchMembers,
    createMember,
    updateMember,
    deleteMember,
  } = useMemberStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Member | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const openModal = (item?: Member) => {
    setEditItem(item || null);
    form.resetFields();
    if (item) {
      form.setFieldsValue({ name: item.name, role: item.role });
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      let ok: boolean;
      if (editItem) {
        ok = await updateMember(editItem.id, values);
      } else {
        ok = await createMember(values);
      }
      if (ok) {
        setModalOpen(false);
      }
    } catch {}
  };

  const handleDelete = async (id: number) => {
    await deleteMember(id);
  };

  const columns = [
    {
      title: "姓名",
      dataIndex: "name",
      key: "name",
      width: 150,
      render: (v: string) => (
        <span>
          <UserOutlined style={{ marginRight: 8 }} />
          {v}
        </span>
      ),
    },
    {
      title: "角色/职位",
      dataIndex: "role",
      key: "role",
      render: (v: string) => v || <span style={{ color: "#999" }}>未设置</span>,
    },
    {
      title: "操作",
      key: "action",
      width: 160,
      render: (_: unknown, record: Member) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除该成员？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="成员管理"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openModal()}
        >
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

      <Modal
        title={editItem ? "编辑成员" : "添加成员"}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: "请输入成员姓名" }]}
          >
            <Input placeholder="请输入姓名" maxLength={50} />
          </Form.Item>
          <Form.Item name="role" label="角色/职位">
            <Input placeholder="如：前端开发、产品经理" maxLength={100} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

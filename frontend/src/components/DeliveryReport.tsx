/**
 * 交付报告组件

 * 从后端获取 Markdown 报告，用 react-markdown 渲染，
 * 支持一键复制 Markdown 原文。
 */

import { useState, useEffect } from "react";
import { Modal, Button, Spin, message, Space } from "antd";
import { CopyOutlined, FileTextOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import { requirementApi } from "@/api";

interface Props {
  requirementId: number;
  requirementTitle: string;
  open: boolean;
  onClose: () => void;
}

export default function DeliveryReport({ requirementId, requirementTitle, open, onClose }: Props) {
  const [markdown, setMarkdown] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) loadReport();
  }, [open]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await requirementApi.deliveryReport(requirementId);
      setMarkdown(res.markdown);
    } catch {
      message.error("生成报告失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      message.success("已复制到剪贴板");
    } catch {
      message.error("复制失败，请手动选择复制");
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={800}
      title={
        <span>
          <FileTextOutlined style={{ marginRight: 8 }} />
          {requirementTitle} — 交付报告
        </span>
      }
      footer={
        <Space>
          <Button onClick={onClose}>关闭</Button>
          <Button icon={<CopyOutlined />} onClick={handleCopy} disabled={!markdown}>
            复制 Markdown
          </Button>
        </Space>
      }
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <Spin size="large" tip="正在生成报告..." />
        </div>
      ) : markdown ? (
        <div style={{
          maxHeight: "70vh", overflowY: "auto", padding: "0 8px",
          fontSize: 14, lineHeight: 1.8, color: "#262626",
        }}>
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 60, color: "#999" }}>
          暂无数据
        </div>
      )}
    </Modal>
  );
}

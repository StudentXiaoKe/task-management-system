/**
 * 任务评论组件

 * 嵌入任务详情中，支持查看和添加评论。
 */

import { useEffect, useState } from "react";
import { Input, Button, List, Avatar, Typography, Popconfirm, Empty } from "antd";
import { UserOutlined, DeleteOutlined, SendOutlined } from "@ant-design/icons";
import { useCommentStore } from "@/store";
import { useMemberStore } from "@/store";
import dayjs from "dayjs";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface TaskCommentsProps {
  taskId: number;
}

export default function TaskComments({ taskId }: TaskCommentsProps) {
  const { comments, loading, fetchComments, createComment, deleteComment } = useCommentStore();
  const { members, fetchMembers } = useMemberStore();
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState<string | undefined>();

  useEffect(() => {
    fetchComments({ task_id: taskId });
    fetchMembers();
  }, [taskId, fetchComments, fetchMembers]);

  const handleSubmit = async () => {
    if (!content.trim() || !author) return;
    const ok = await createComment({ content: content.trim(), author, task_id: taskId });
    if (ok) {
      setContent("");
      fetchComments({ task_id: taskId });
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      {/* 评论输入 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <SelectAuthor value={author} onChange={setAuthor} members={members.map((m) => m.name)} />
        <TextArea
          placeholder="添加评论..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={1}
          autoSize={{ minRows: 1, maxRows: 3 }}
          style={{ flex: 1 }}
          onPressEnter={(e) => {
            if (!e.shiftKey) { e.preventDefault(); handleSubmit(); }
          }}
        />
        <Button type="primary" icon={<SendOutlined />} onClick={handleSubmit}
          disabled={!content.trim() || !author} />
      </div>

      {/* 评论列表 */}
      {comments.length > 0 ? (
        <List
          dataSource={comments}
          size="small"
          loading={loading}
          renderItem={(item) => (
            <List.Item style={{ padding: "8px 0" }}
              actions={[
                <Popconfirm title="删除此评论？" onConfirm={() => {
                  deleteComment(item.id).then(() => fetchComments({ task_id: taskId }));
                }}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              ]}
            >
              <List.Item.Meta
                avatar={<Avatar size="small" icon={<UserOutlined />} style={{ background: "#1677ff" }} />}
                title={
                  <span>
                    <Text strong style={{ fontSize: 13 }}>{item.author}</Text>
                    <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                      {dayjs(item.created_at).format("MM-DD HH:mm")}
                    </Text>
                  </span>
                }
                description={<Paragraph style={{ margin: 0, fontSize: 13 }}>{item.content}</Paragraph>}
              />
            </List.Item>
          )}
        />
      ) : (
        <div style={{ textAlign: "center", padding: "12px 0", color: "#bbb", fontSize: 12 }}>
          暂无评论
        </div>
      )}
    </div>
  );
}

/** 选择评论人 */
function SelectAuthor({ value, onChange, members }: { value?: string; onChange: (v: string) => void; members: string[] }) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: 90, height: 32, borderRadius: 6, border: "1px solid #d9d9d9",
        padding: "0 8px", fontSize: 13, background: "#fff", cursor: "pointer",
      }}
    >
      <option value="" disabled>评论人</option>
      {members.map((m) => <option key={m} value={m}>{m}</option>)}
    </select>
  );
}

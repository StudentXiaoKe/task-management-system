/**
 * 目标对齐视图 — React Flow 实现
 *
 * 核心架构：节点为纯 HTML DOM（原生字体渲染，绝对锐利），
 * 连线由 React Flow 内部 SVG 绘制。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
  type ColorMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Drawer, Spin, Button, Space, Tag, Progress, Empty, Tooltip, Select } from "antd";
import {
  ApartmentOutlined, FilterOutlined, SwapOutlined,
} from "@ant-design/icons";
import { useAlignmentTreeStore } from "@/store";
import type { AlignmentTreeNode } from "@/types";
import { STATUS_LABELS } from "@/types";

/* ------------------------------------------------------------------ */
/*  状态配置                                                           */
/* ------------------------------------------------------------------ */

const STATUS_DOT: Record<string, string> = {
  todo: "#9ca3af", planning: "#9ca3af",
  in_progress: "#3b82f6",
  review: "#f59e0b",
  done: "#22c55e", completed: "#22c55e",
  archived: "#9ca3af",
};

const dotColor = (s: string) => STATUS_DOT[s] || "#9ca3af";

/* ------------------------------------------------------------------ */
/*  子树提取：在全量树中精确找到指定节点并返回完整子树                       */
/* ------------------------------------------------------------------ */

function findSubTree(tree: AlignmentTreeNode | null, targetId: string): AlignmentTreeNode | null {
  if (!tree) return null;
  if (tree.id === targetId) return tree;
  for (const child of tree.children || []) {
    const found = findSubTree(child, targetId);
    if (found) return found;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  过滤：递归判定节点是否命中                                          */
/* ------------------------------------------------------------------ */

function collectAssignees(node: AlignmentTreeNode): string[] {
  const res: string[] = [];
  if (node.assignee) res.push(node.assignee);
  for (const c of node.children || []) res.push(...collectAssignees(c));
  return res;
}

function isMatch(n: AlignmentTreeNode, sf: string, af: string): boolean {
  if ((!sf || n.status === sf) && (!af || n.assignee === af)) return true;
  return (n.children || []).some(c => isMatch(c, sf, af));
}

function buildVisibleIds(root: AlignmentTreeNode, sf: string, af: string): Set<string> {
  const ids = new Set<string>();
  if (!sf && !af) {
    const walk = (n: AlignmentTreeNode) => { ids.add(n.id); (n.children || []).forEach(walk); };
    walk(root);
    return ids;
  }
  const walk = (n: AlignmentTreeNode) => {
    if (isMatch(n, sf, af)) { ids.add(n.id); (n.children || []).forEach(walk); }
  };
  walk(root);
  return ids;
}

/* ------------------------------------------------------------------ */
/*  布局算法（水平方向，递归排列）                                       */
/* ------------------------------------------------------------------ */

const GAP_X = 240;   // 水平间距（父节点右缘 → 子节点左缘）
const GAP_Y = 24;    // 默认垂直间距

/** 不同层级节点尺寸 */
const NODE_SIZES: Record<string, { w: number; h: number; gapY: number }> = {
  requirement: { w: 240, h: 80, gapY: 28 },
  task_l2:     { w: 220, h: 72, gapY: 22 },
  task_l3:     { w: 200, h: 60, gapY: 18 },
  root:        { w: 240, h: 80, gapY: 28 },
};
const dims = (nt: string) => NODE_SIZES[nt] || { w: 220, h: 72, gapY: GAP_Y };

interface FlatNode {
  id: string;
  x: number;
  y: number;
  data: {
    name: string;
    nodeType: string;
    status: string;
    assignee: string;
    progress: number;
    totalTasks: number;
    doneTasks: number;
    hasChildren: boolean;
    isCollapsed: boolean;
    raw: AlignmentTreeNode;
  };
}

interface FlatEdge {
  id: string;
  source: string;
  target: string;
}

function computeSubtreeHeight(node: AlignmentTreeNode, collapsed: Set<string>): number {
  const { h, gapY } = dims(node.node_type);
  if (!node.children?.length || collapsed.has(node.id)) return h;
  let total = 0;
  for (const ch of node.children) total += computeSubtreeHeight(ch, collapsed);
  total += (node.children.length - 1) * gapY;
  return Math.max(h, total);
}

function layoutTree(
  node: AlignmentTreeNode,
  x: number,
  yStart: number,
  collapsed: Set<string>,
): { nodes: FlatNode[]; edges: FlatEdge[] } {
  const nodes: FlatNode[] = [];
  const edges: FlatEdge[] = [];
  const { w: nw, h: nh, gapY } = dims(node.node_type);
  const subtreeH = computeSubtreeHeight(node, collapsed);

  nodes.push({
    id: node.id,
    x,
    y: yStart + subtreeH / 2 - nh / 2,
    data: {
      name: node.name,
      nodeType: node.node_type,
      status: node.status || "",
      assignee: node.assignee || "",
      progress: node.progress ?? -1,
      totalTasks: node.total_tasks ?? 0,
      doneTasks: node.done_tasks ?? 0,
      hasChildren: !!(node.children?.length),
      isCollapsed: collapsed.has(node.id),
      raw: node,
    },
  });

  if (node.children?.length && !collapsed.has(node.id)) {
    let cy = yStart;
    for (const ch of node.children) {
      const chH = computeSubtreeHeight(ch, collapsed);
      const result = layoutTree(ch, x + nw + GAP_X, cy, collapsed);
      nodes.push(...result.nodes);
      edges.push(...result.edges);
      edges.push({
        id: `${node.id}__${ch.id}`,
        source: node.id,
        target: ch.id,
      });
      cy += chH + gapY;
    }
  }
  return { nodes, edges };
}

/* ------------------------------------------------------------------ */
/*  自定义 HTML 节点组件                                               */
/* ------------------------------------------------------------------ */

interface TreeNodeData {
  name: string;
  nodeType: string;
  status: string;
  assignee: string;
  progress: number;
  totalTasks: number;
  doneTasks: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  raw: AlignmentTreeNode;
  opacity?: number;  // 透明度（1=完全显示，0.2=半透明）
  onClick?: (node: AlignmentTreeNode) => void;
  onToggleCollapse?: (id: string) => void;
  [key: string]: unknown;
}

function TreeNodeComponent({ data }: { data: TreeNodeData }) {
  const {
    name, nodeType, status, assignee,
    progress, totalTasks, doneTasks,
    hasChildren, isCollapsed,
    opacity = 1, onClick, onToggleCollapse,
  } = data;

  const isRoot = nodeType === "root";
  const isRequirement = nodeType === "requirement";
  const isTask = nodeType === "task_l2";
  const isSubTask = nodeType === "task_l3";
  const color = dotColor(status);
  const progressOk = progress >= 0 && totalTasks > 0;
  const label = STATUS_LABELS[status] || status;

  return (
    <div
      onClick={() => onClick?.(data.raw)}
      style={{
        width: isRequirement ? 240 : isSubTask ? 200 : 220,
        minHeight: isRequirement ? 80 : isSubTask ? 60 : 72,
        padding: isRoot ? "12px 14px" : isSubTask ? "7px 12px" : "10px 14px",
        background: "#ffffff",
        border: `1px solid ${opacity < 1 ? "#f3f4f6" : isSubTask ? "#e5e7eb" : "#e5e7eb"}`,
        borderRadius: isSubTask ? 8 : 10,
        cursor: "pointer",
        opacity,
        transition: "opacity 0.2s, box-shadow 0.15s",
        fontFamily: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`,
        position: "relative",
        boxSizing: "border-box",
        boxShadow: isSubTask ? "none" : undefined,
      }}
      onMouseEnter={e => { if (opacity >= 1 && !isSubTask) (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"); }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* 连线锚点 */}
      <Handle type="target" position={Position.Left}  style={{ visibility: "hidden" }} />
      {hasChildren && (
        <Handle type="source" position={Position.Right} style={{ visibility: "hidden" }} />
      )}

      {/* 顶部行：圆点 + 标题 + 折叠按钮 */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
        {!isRoot && (
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: color, flexShrink: 0,
          }} />
        )}
        {isRoot && <span style={{ fontSize: 15, flexShrink: 0 }}>🎯</span>}
        <span style={{
          fontSize: isRoot ? 14 : isRequirement ? 14 : isSubTask ? 12.5 : 13.5,
          fontWeight: (isRoot || isRequirement) ? 600 : 500,
          color: "#1f2937", flex: 1, lineHeight: 1.3,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {name}
        </span>
        {/* 层级标签 */}
        {isRequirement && (
          <span style={{
            fontSize: 10, fontWeight: 600, color: "#3b82f6",
            background: "#eff6ff", padding: "1px 5px", borderRadius: 3,
            whiteSpace: "nowrap", flexShrink: 0,
          }}>
            🚀 需求
          </span>
        )}
        {isTask && (
          <span style={{
            fontSize: 10, fontWeight: 600, color: "#f59e0b",
            background: "#fffbeb", padding: "1px 5px", borderRadius: 3,
            whiteSpace: "nowrap", flexShrink: 0,
          }}>
            📦 任务
          </span>
        )}
        {isSubTask && (
          <span style={{
            fontSize: 10, fontWeight: 500, color: "#9ca3af",
            background: "#f9fafb", padding: "1px 5px", borderRadius: 3,
            whiteSpace: "nowrap", flexShrink: 0,
          }}>
            ✅ 子任务
          </span>
        )}
        {hasChildren && (
          <button
            onClick={e => { e.stopPropagation(); onToggleCollapse?.(data.raw.id); }}
            style={{
              width: 18, height: 18, borderRadius: 4,
              border: "1px solid #d1d5db", background: "#f9fafb",
              cursor: "pointer", fontSize: 10, lineHeight: "16px",
              color: "#6b7280", padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
            title={isCollapsed ? "展开" : "折叠"}
          >
            {isCollapsed ? "+" : "−"}
          </button>
        )}
      </div>

      {/* 副信息行 */}
      {!isRoot && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 15 }}>
          {assignee && (
            <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.3 }}>
              {assignee}
            </span>
          )}
          {assignee && label && <span style={{ fontSize: 11, color: "#d1d5db" }}>·</span>}
          {label && (
            <span style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.3 }}>
              {label}
            </span>
          )}
        </div>
      )}

      {/* 进度条（右下角） */}
      {progressOk && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          marginLeft: 15, marginTop: 5,
        }}>
          <div style={{
            flex: 1, height: 3, borderRadius: 2,
            background: "#f3f4f6", overflow: "hidden",
          }}>
            <div style={{
              width: `${(doneTasks / totalTasks) * 100}%`,
              height: "100%", borderRadius: 2,
              background: color, opacity: 0.7,
              transition: "width 0.3s",
            }} />
          </div>
          <span style={{
            fontSize: 11, fontWeight: 600, color: "#6b7280",
            whiteSpace: "nowrap", flexShrink: 0,
          }}>
            {doneTasks}/{totalTasks}
          </span>
        </div>
      )}
    </div>
  );
}

/* 注册自定义节点类型（组件外声明，避免重渲染丢失注册） */
const nodeTypes: NodeTypes = { treeNode: TreeNodeComponent as any };

/* ------------------------------------------------------------------ */
/*  主组件                                                             */
/* ------------------------------------------------------------------ */

export default function AlignmentMap({ epicId }: { epicId?: number } = {}) {
  return (
    <ReactFlowProvider>
      <AlignmentMapInner epicId={epicId} />
    </ReactFlowProvider>
  );
}

function AlignmentMapInner({ epicId }: { epicId?: number }) {
  const { tree, loading, fetchTree } = useAlignmentTreeStore();

  const [selectedNode, setSelectedNode] = useState<AlignmentTreeNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("");
  const [epicFilter, setEpicFilter] = useState<string>(epicId ? `req_${epicId}` : "");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [direction, setDirection] = useState<"LR" | "TB">("LR");

  // 挂载时：始终获取全量树，然后由 findSubTree 在前端精确提取子树
  // 这样确保绝对的数据隔离，不依赖后端过滤
  useEffect(() => {
    fetchTree();  // 不传 rootId，获取全量树
  }, [fetchTree]);

  /* Epic 下拉选项：从根节点的直接子节点（一级需求）中提取；
     聚焦模式（epicId 存在）下无需选择，故返回空 */
  const epicOptions = useMemo(() => {
    if (!tree || epicId) return [];
    return tree.children.map(epic => ({
      label: epic.name,
      value: epic.id,
    }));
  }, [tree, epicId]);

  // epicId 变化时：清空折叠状态，重置筛选
  useEffect(() => {
    setCollapsedIds(new Set());
    setStatusFilter("");
    setAssigneeFilter("");
  }, [epicId]);

  /* 按 Epic 筛选后的显示树：
     - 聚焦模式（epicId 存在）：用 findSubTree 精确提取子树
     - 全量模式 + epicFilter：用 findSubTree 提取选中的 Epic 子树
     - 全量模式 + 无 epicFilter：返回全量树 */
  const displayTree = useMemo<AlignmentTreeNode | null>(() => {
    if (!tree) return null;

    // 聚焦模式：精确提取指定节点的子树
    if (epicId) {
      const targetId = `req_${epicId}`;
      const subTree = findSubTree(tree, targetId);
      if (!subTree) {
        console.warn(`[AlignmentMap] 找不到节点 ${targetId}，显示全量树`);
        return tree;
      }
      return subTree;
    }

    // 全量模式 + Epic 筛选：提取选中的 Epic 子树
    if (epicFilter) {
      const subTree = findSubTree(tree, epicFilter);
      if (!subTree) {
        console.warn(`[AlignmentMap] 找不到 Epic ${epicFilter}，显示全量树`);
        return tree;
      }
      return subTree;
    }

    // 全量模式 + 无筛选：返回全量树
    return tree;
  }, [tree, epicId, epicFilter]);

  /* 下拉选项 */
  const assigneeOptions = useMemo(() => {
    if (!tree) return [];
    return [...new Set(collectAssignees(tree))].sort().map(a => ({ label: a, value: a }));
  }, [tree]);

  const statusOptions = useMemo(() => [
    { label: "待办",   value: "todo" },
    { label: "进行中", value: "in_progress" },
    { label: "待验收", value: "review" },
    { label: "已完成", value: "done" },
  ], []);

  /* 计算可见节点集合（基于 displayTree，用于透明度降级） */
  const visibleIds = useMemo(
    () => displayTree ? buildVisibleIds(displayTree, statusFilter, assigneeFilter) : new Set<string>(),
    [displayTree, statusFilter, assigneeFilter],
  );
  const hasFilter = !!(statusFilter || assigneeFilter);

  /* 折叠切换 */
  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  /* 布局计算 */
  const { rfNodes, rfEdges } = useMemo(() => {
    if (!displayTree) return { rfNodes: [] as Node[], rfEdges: [] as Edge[] };
    const { nodes, edges } = layoutTree(displayTree, 40, 40, collapsedIds);

    const isLR = direction === "LR";
    const mappedNodes: Node[] = nodes.map(n => {
      // 根据状态和负责人过滤设置透明度
      const opacity = hasFilter ? (visibleIds.has(n.id) ? 1 : 0.2) : 1;

      return {
        id: n.id,
        type: "treeNode",
        position: { x: isLR ? n.x : n.y, y: isLR ? n.y : n.x },
        data: {
          ...n.data,
          opacity,  // 传递透明度给节点组件
          onClick: (raw: AlignmentTreeNode) => { setSelectedNode(raw); setDrawerOpen(true); },
          onToggleCollapse: toggleCollapse,
        },
      };
    });

    const mappedEdges: Edge[] = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      animated: false,
      style: {
        stroke: "#d1d5db",
        strokeWidth: 1.5,
      },
      pathOptions: { borderRadius: 16 },
    }));

    return { rfNodes: mappedNodes, rfEdges: mappedEdges };
  }, [displayTree, collapsedIds, direction, hasFilter, visibleIds, toggleCollapse]);

  /* React Flow 状态 */
  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);
  const { fitView } = useReactFlow();

  useEffect(() => { setNodes(rfNodes); }, [rfNodes, setNodes]);
  useEffect(() => { setEdges(rfEdges); }, [rfEdges, setEdges]);

  /* 筛选或树数据变更后自动居中并 fitView */
  useEffect(() => {
    if (!nodes.length) return;
    const timer = setTimeout(() => fitView({ padding: 0.15, duration: 350 }), 50);
    return () => clearTimeout(timer);
  }, [epicId, epicFilter, nodes.length, fitView]);

  /* 清空所有筛选 */
  const clearFilter = useCallback(() => {
    setStatusFilter("");
    setAssigneeFilter("");
    if (!epicId) setEpicFilter("");  // 外部传入的 epicId 不可清除
  }, [epicId]);

  /* ---------- Drawer 内容 ---------- */

  const renderDrawerContent = () => {
    if (!selectedNode) return null;
    const sc = dotColor(selectedNode.status || "");
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <Tag color={sc} style={{ fontSize: 13 }}>
            {STATUS_LABELS[selectedNode.status || ""] || selectedNode.status || "—"}
          </Tag>
          {selectedNode.assignee && (
            <span style={{ color: "#6b7280", marginLeft: 8 }}>{selectedNode.assignee}</span>
          )}
        </div>
        {selectedNode.progress != null && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
              完成进度
              {selectedNode.total_tasks != null
                ? `（${selectedNode.done_tasks ?? 0} / ${selectedNode.total_tasks}）`
                : ""}
            </div>
            <Progress
              percent={selectedNode.progress}
              status={selectedNode.progress >= 100 ? "success" : "active"}
              strokeColor={sc}
            />
          </div>
        )}
        {selectedNode.children.length > 0 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, margin: "16px 0 8px", color: "#1f2937" }}>
              子节点（{selectedNode.children.length}）
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {selectedNode.children.map(ch => (
                <div key={ch.id} style={{
                  padding: "10px 14px", borderRadius: 10,
                  border: "1px solid #e5e7eb", background: "#fff",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: dotColor(ch.status || ""), flexShrink: 0,
                    }} />
                    <span style={{ fontWeight: 500, fontSize: 13, color: "#1f2937", flex: 1 }}>
                      {ch.name}
                    </span>
                    <Tag color={dotColor(ch.status || "")} style={{ margin: 0, fontSize: 11 }}>
                      {STATUS_LABELS[ch.status || ""] || ch.status}
                    </Tag>
                  </div>
                  {ch.assignee && (
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, marginLeft: 16 }}>
                      {ch.assignee}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  /* ---------- 加载 / 空状态 ---------- */

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }
  if (!tree) {
    return <Empty description="暂无对齐数据" style={{ marginTop: 120 }} />;
  }

  /* ---------- 主渲染 ---------- */

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ==================== 顶部操作栏 ==================== */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "8px 12px", background: "#fff",
        border: "1px solid #e5e7eb", borderRadius: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FilterOutlined style={{ color: "#9ca3af", fontSize: 14 }} />
          {!epicId && (
            <Select
              value={epicFilter || undefined}
              onChange={v => setEpicFilter(v ?? "")}
              allowClear onClear={() => setEpicFilter("")}
              placeholder="所属需求" size="middle" style={{ width: 168 }}
              showSearch optionFilterProp="label"
              options={epicOptions}
            />
          )}
          <Select
            value={statusFilter || undefined}
            onChange={v => setStatusFilter(v ?? "")}
            allowClear onClear={() => setStatusFilter("")}
            placeholder="状态筛选" size="middle" style={{ width: 132 }}
            options={statusOptions}
          />
          <Select
            value={assigneeFilter || undefined}
            onChange={v => setAssigneeFilter(v ?? "")}
            allowClear onClear={() => setAssigneeFilter("")}
            placeholder="负责人筛选" size="middle" style={{ width: 152 }}
            showSearch optionFilterProp="label"
            options={assigneeOptions}
          />
          {(statusFilter || assigneeFilter || epicFilter) && (
            <Button size="small" type="link" onClick={clearFilter} style={{ padding: 0, fontSize: 12 }}>
              清空筛选
            </Button>
          )}
        </div>

        <div style={{ flex: 1 }} />

        <Space size={8}>
          <Tooltip title="切换横纵方向">
            <Button size="middle" icon={<SwapOutlined />} onClick={() =>
              setDirection(d => d === "LR" ? "TB" : "LR")
            }>
              {direction === "LR" ? "纵向" : "横向"}
            </Button>
          </Tooltip>
          <Tag icon={<ApartmentOutlined />} color="blue" style={{ fontSize: 12, margin: 0 }}>
            {tree.total_tasks ?? tree.children.length} 个需求
          </Tag>
        </Space>
      </div>

      {/* ==================== React Flow 画布 ==================== */}
      <div style={{
        width: "100%",
        height: "calc(100vh - 310px)",
        minHeight: 480,
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        overflow: "hidden",
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable={false}
          nodesConnectable={false}
          colorMode={"light" as ColorMode}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e5e7eb" gap={20} size={0.8} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {/* ==================== 节点详情抽屉 ==================== */}
      <Drawer
        title={selectedNode?.name || "节点详情"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={420}
        styles={{ body: { paddingTop: 20 } }}
      >
        {renderDrawerContent()}
      </Drawer>
    </div>
  );
}

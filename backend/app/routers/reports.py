"""
统计报表 API 路由

按部门聚合需求完成数据，支持时间范围筛选和 Markdown 报告生成。
"""

from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.auth import get_current_user

router = APIRouter(prefix="/api/reports", tags=["统计报表"])


@router.get("/department-stats", summary="按部门统计需求数据")
def get_department_stats(
    start_date: Optional[str] = Query(None, description="起始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """
    按 department 分组统计需求总数、已完成数、各状态数量。
    支持可选时间范围过滤。
    """
    q = db.query(
        models.Requirement.department,
        models.Requirement.status,
        func.count(models.Requirement.id).label("cnt"),
    )

    # 时间范围筛选
    if start_date:
        q = q.filter(models.Requirement.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        q = q.filter(models.Requirement.created_at < datetime.fromisoformat(end_date))

    rows = q.group_by(models.Requirement.department, models.Requirement.status).all()

    # 二次聚合：按 department 汇总
    dept_map: dict[str, dict] = {}
    for dept, status, cnt in rows:
        d = dept or "未分配"
        if d not in dept_map:
            dept_map[d] = {
                "department": d,
                "total": 0,
                "completed": 0,
                "in_progress": 0,
                "planning": 0,
                "archived": 0,
                "rate": 0.0,
            }
        dept_map[d]["total"] += cnt
        if status == models.RequirementStatus.COMPLETED:
            dept_map[d]["completed"] += cnt
        elif status == models.RequirementStatus.IN_PROGRESS:
            dept_map[d]["in_progress"] += cnt
        elif status == models.RequirementStatus.PLANNING:
            dept_map[d]["planning"] += cnt
        elif status == models.RequirementStatus.ARCHIVED:
            dept_map[d]["archived"] += cnt

    # 计算完成率
    for v in dept_map.values():
        v["rate"] = round(v["completed"] / v["total"] * 100, 1) if v["total"] else 0.0

    result = sorted(dept_map.values(), key=lambda x: x["total"], reverse=True)

    # 全局汇总
    total_all   = sum(r["total"]     for r in result)
    done_all    = sum(r["completed"] for r in result)
    ip_all      = sum(r["in_progress"] for r in result)
    plan_all    = sum(r["planning"]  for r in result)
    arch_all    = sum(r["archived"]  for r in result)

    return {
        "departments": result,
        "overall": {
            "total": total_all,
            "completed": done_all,
            "in_progress": ip_all,
            "planning": plan_all,
            "archived": arch_all,
            "rate": round(done_all / total_all * 100, 1) if total_all else 0.0,
        },
    }


@router.get("/summary-report", summary="生成时间范围内的交付总结报告")
def get_summary_report(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    department: Optional[str] = Query(None, description="指定部门，不传则全量"),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    """生成 Markdown 格式的交付总结报告。"""
    q = db.query(models.Requirement)
    if start_date:
        q = q.filter(models.Requirement.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        q = q.filter(models.Requirement.created_at < datetime.fromisoformat(end_date))
    if department and department != "全部":
        q = q.filter(models.Requirement.department == department)

    reqs = q.order_by(models.Requirement.department, models.Requirement.updated_at.desc()).all()

    # 按部门分组
    by_dept: dict[str, list] = {}
    for r in reqs:
        d = r.department or "未分配"
        by_dept.setdefault(d, []).append(r)

    # 时间段描述
    def fmt_period():
        parts = []
        if start_date: parts.append(f"自 {start_date}")
        if end_date:   parts.append(f"至 {end_date}")
        return " ".join(parts) if parts else "全量"

    title_dept = department if department and department != "全部" else "全公司"
    period = fmt_period()

    lines = [
        f"# {title_dept} 需求交付总结报告",
        f"",
        f"> 统计周期：{period}　｜　生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"",
        "---",
        "",
    ]

    for dept, items in by_dept.items():
        total = len(items)
        done  = sum(1 for i in items if i.status == models.RequirementStatus.COMPLETED)
        rate  = f"{done/total*100:.0f}%" if total else "—"

        lines.append(f"## {dept}　（完成率 {rate}，共 {total} 项）")
        lines.append("")
        lines.append("| # | 标题 | 状态 | 优先级 | 版本 |")
        lines.append("|---|------|------|--------|------|")
        for idx, r in enumerate(items, 1):
            st = r.status.value if hasattr(r.status, "value") else r.status
            pr = r.priority.value if hasattr(r.priority, "value") else r.priority
            lines.append(f"| {idx} | {r.title} | {st} | {pr} | {r.version} |")
        lines.append("")

    if not by_dept:
        lines.append("暂无符合筛选条件的需求数据。")

    return {"markdown": "\n".join(lines), "total": len(reqs)}

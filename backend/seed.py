"""
数据库种子脚本 - 创建测试账号（幂等，可重复运行）

运行方式：python seed.py
也可直接运行 uvicorn（lifespan 会自动调用 _insert_demo_data）
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# bcrypt 兼容性修复
try:
    import bcrypt
    if not hasattr(bcrypt, "__about__"):
        import types
        bcrypt.__about__ = types.SimpleNamespace(__version__=bcrypt.__version__)
except Exception:
    pass

from app.database import engine, Base, SessionLocal
from app.models import User, UserRole, Member
from app.auth import hash_password, verify_password


ACCOUNTS = [
    {"username": "admin",   "password": "Admin@123456",  "role": UserRole.MANAGER,    "member_name": None,      "title": "项目经理"},
    {"username": "client",  "password": "Client@123456", "role": UserRole.CLIENT,     "member_name": None,      "title": "产品经理"},
    {"username": "memberA", "password": "Dev@123456",    "role": UserRole.DEVELOPER,  "member_name": "成员A",   "title": "高级前端工程师"},
    {"username": "memberB", "password": "Dev@123456",    "role": UserRole.DEVELOPER,  "member_name": "成员B",   "title": "后端工程师"},
    {"username": "memberC", "password": "Dev@123456",    "role": UserRole.DEVELOPER,  "member_name": "成员C",   "title": "全栈工程师"},
    {"username": "memberD", "password": "Dev@123456",    "role": UserRole.DEVELOPER,  "member_name": "成员D",   "title": "测试工程师"},
]


def seed():
    print("[SEED] 开始初始化数据库...")

    Base.metadata.create_all(bind=engine)
    print("[SEED] 表结构已就绪")

    db = SessionLocal()
    try:
        # 确保有成员记录
        members_by_name = {m.name: m for m in db.query(Member).all()}
        for acct in ACCOUNTS:
            name = acct["member_name"]
            if name and name not in members_by_name:
                m = Member(name=name, title=acct.get("title"), initial_password=acct["password"])
                db.add(m)
                db.flush()
                members_by_name[name] = m
                print(f"[SEED] 新建成员: {name}")

        # 幂等创建用户（已存在则跳过）
        created = 0
        for acct in ACCOUNTS:
            existing = db.query(User).filter(User.username == acct["username"]).first()
            if existing:
                continue
            member = members_by_name.get(acct["member_name"]) if acct["member_name"] else None
            user = User(
                username=acct["username"],
                password_hash=hash_password(acct["password"]),
                role=acct["role"],
                member_id=member.id if member else None,
                is_active=True,
            )
            db.add(user)
            created += 1

        db.commit()

        if created > 0:
            print(f"[SEED] 新建 {created} 个账号")
        else:
            print("[SEED] 所有账号已存在，无需创建")

        # 验证
        print("[SEED] 账号列表：")
        for u in db.query(User).order_by(User.id).all():
            member_name = u.member.name if u.member else "—"
            print(f"  {u.username:10s} | {u.role.value:10s} | {member_name}")

    except Exception as e:
        print(f"[ERROR] {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()

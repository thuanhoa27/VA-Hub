"""
parse-seed.py
------------------------------------------------------------------------------
Doc supabase/migrations/0002_seed.sql bang parser Postgres that (libpg_query qua
pglast) va xuat ra .tmp/db_rows.json — mo phong ket qua truy van tung bang.

Dung cho verify-roundtrip.mjs: chung minh DATA -> SQL -> adapter -> DATA' khong
lam sai lech so lieu nao.

Cai dat:  pip install pglast
Chay:     python scripts/parse-seed.py
"""
import json
import os
import sys

try:
    from pglast import parse_sql
    from pglast.ast import A_Const, TypeCast, A_Expr
except ImportError:
    sys.exit("Thieu pglast. Chay: pip install pglast")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED = os.path.join(ROOT, "supabase", "migrations", "0002_seed.sql")
OUT_DIR = os.path.join(ROOT, ".tmp")
os.makedirs(OUT_DIR, exist_ok=True)
OUT = os.path.join(OUT_DIR, "db_rows.json")


def val(n):
    """Boc gia tri hang so tu AST."""
    if isinstance(n, A_Const):
        if n.isnull:
            return None
        v = n.val
        for k in ("sval", "fval", "ival", "boolval"):
            if hasattr(v, k):
                r = getattr(v, k)
                return float(r) if k == "fval" else r
        return None
    if isinstance(n, TypeCast):
        return val(n.arg)
    if isinstance(n, A_Expr):  # so am duoc parse thanh unary minus
        r = val(n.rexpr)
        return -r if isinstance(r, (int, float)) else r
    return None


tables = {}
for raw in parse_sql(open(SEED, encoding="utf-8").read()):
    ins = raw.stmt
    if ins.__class__.__name__ != "InsertStmt":
        continue
    tbl = ins.relation.relname
    cols = [c.name for c in ins.cols]
    for vl in ins.selectStmt.valuesLists:
        tables.setdefault(tbl, []).append(dict(zip(cols, [val(x) for x in vl])))

json.dump(tables, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
print("[parse-seed] " + " · ".join(f"{t}={len(r)}" for t, r in sorted(tables.items())))
print("[parse-seed] -> " + OUT)

# 上游采购工具 上线前打磨 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不扩大已收窄范围的前提下,把已完成的 MVP 打磨到"可放心上线"——补齐规范遗漏(按分类分组)、加固健壮性(防重复提交、错误兜底)、补测试、加质量门禁(ESLint + CI 跑测试)、补实用导出。

**Architecture:** 现有 Vite + React 19 + TS + Tailwind + Supabase 单页应用,纯手动 CRUD,无服务器、无爬虫。本计划只在现有文件内做增量改动,5 个轨道文件互不重叠,可在各自 git worktree 并行开发,合并顺序 A→B→C→D→E。

**Tech Stack:** Vite, React 19, TypeScript(strict), Tailwind, @supabase/supabase-js, Vitest, ESLint, GitHub Actions。

**范围红线(不可触碰):** 不加爬虫/抓价;不加订单/支付/库存;不做对外/代理/客户页面;不引入后端服务;不改鉴权与 RLS 模型。所有改动服务于"2 人内部手动工具"的可用性与可靠性。

---

## File Structure(改动边界)

| 轨道 | 拥有文件(独占,互不重叠) | 职责 |
|---|---|---|
| A 数据层 | `src/lib/channels.ts`, `src/__tests__/channels.test.ts` | 抽出可测的批量构建纯函数 + 关键词同时匹配渠道名/产品 + 补测试 |
| B 分组表格 | `src/components/ChannelTable.tsx` | 规范 §4「表格按分类分组」:分组表头 + 每组计数 + 空状态 |
| C 表单加固 | `src/components/ChannelForm.tsx`, `src/components/Login.tsx` | 保存/登录防重复提交(禁用+loading)+ 分类预设 datalist |
| D 主页实用 | `src/components/Dashboard.tsx` | 导出当前视图 CSV + 删除失败兜底 + 分类筛选并入预设 |
| E 质量门禁 | `.github/workflows/deploy.yml`, `package.json`, `eslint.config.js` | 部署前先跑 tsc + 测试 + ESLint |

每个轨道独立可测、独立可合并。

---

## Task A: 数据层可测化 + 关键词匹配产品

**Files:**
- Modify: `src/lib/channels.ts`
- Test: `src/__tests__/channels.test.ts`

- [ ] **Step 1: 写失败测试(追加到 `src/__tests__/channels.test.ts` 末尾)**

```ts
import { buildBatchRows } from "../lib/channels";

describe("buildBatchRows", () => {
  it("每行用各自分类,产品/价格按行展开", () => {
    const rows = buildBatchRows(
      { name: "jayron", category: "忽略" },
      [
        { category: "GPT", product: "Plus", manual_price: "100" },
        { category: "Claude", product: "Pro" },
      ],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].category).toBe("GPT");
    expect(rows[0].product).toBe("Plus");
    expect(rows[0].manual_price).toBe("100");
    expect(rows[1].category).toBe("Claude");
    expect(rows[1].product).toBe("Pro");
    expect(rows[1].risk).toBe("低");
    expect(rows[1].status).toBe("在售");
  });
  it("行内分类为空时报错(分类必填)", () => {
    expect(() =>
      buildBatchRows({ name: "x" }, [{ product: "p" }]),
    ).toThrow();
  });
});

describe("filterChannels 关键词匹配产品", () => {
  const r2 = [
    { id: "1", category: "GPT", name: "渠道甲", product: "ChatGPT Plus", risk: "低", status: "在售" },
    { id: "2", category: "GPT", name: "渠道乙", product: "Sora", risk: "低", status: "在售" },
  ] as Channel[];
  it("关键词命中产品名也返回", () => {
    expect(
      filterChannels(r2, { category: "全部", risk: "全部", kw: "sora", status: "全部" }),
    ).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test`
Expected: FAIL —— `buildBatchRows` 未导出 / 关键词测试不通过。

- [ ] **Step 3: 在 `src/lib/channels.ts` 抽出 `buildBatchRows` 并让 `createChannelBatch` 复用**

把现有 `createChannelBatch` 替换为:

```ts
export function buildBatchRows(base: ChannelInput, lines: ProductLine[]) {
  return lines.map((ln) =>
    sanitizeChannelInput({
      ...base,
      category: ln.category,
      product: ln.product,
      manual_price: ln.manual_price,
      warranty: ln.warranty,
      risk: ln.risk,
      status: ln.status,
    }),
  );
}

export async function createChannelBatch(
  base: ChannelInput,
  lines: ProductLine[],
): Promise<void> {
  const rows = buildBatchRows(base, lines);
  const { error } = await supabase.from("channels").insert(rows);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: 关键词同时匹配渠道名与产品**

把 `filterChannels` 中的关键词行替换为(并更新上方注释):

```ts
// keyword matches channel name OR product (not category/note/contact) — intentional
export function filterChannels(rows: Channel[], f: Filters): Channel[] {
  const kw = f.kw.toLowerCase();
  return rows.filter(
    (r) =>
      (f.category === "全部" || r.category === f.category) &&
      (f.risk === "全部" || r.risk === f.risk) &&
      (kw === "" ||
        r.name.toLowerCase().includes(kw) ||
        (r.product ?? "").toLowerCase().includes(kw)) &&
      (f.status === "全部" || r.status === f.status),
  );
}
```

- [ ] **Step 5: 运行确认全绿**

Run: `npm test`
Expected: PASS(原 8 + 新增用例全过)。

- [ ] **Step 6: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无输出(通过)。

- [ ] **Step 7: Commit**

```bash
git add src/lib/channels.ts src/__tests__/channels.test.ts
git commit -m "refactor: 抽出 buildBatchRows 可测 + 关键词匹配产品(TDD)"
```

---

## Task B: 表格按分类分组(规范 §4 遗漏补齐)

**Files:**
- Modify: `src/components/ChannelTable.tsx`

- [ ] **Step 1: 用完整实现替换 `src/components/ChannelTable.tsx`**

去掉每行冗余的「分类」列,改为每个分类一个分组表头(含该组条数);无数据时显示空状态。

```tsx
import { useMemo } from "react";
import type { Channel } from "../lib/channels";

const RISK_COLOR: Record<string, string> = {
  低: "bg-green-100 text-green-800",
  中: "bg-yellow-100 text-yellow-800",
  高: "bg-red-100 text-red-800",
};

const COLS = ["渠道", "产品", "链接", "价格", "质保", "风险", "状态", "联系方式", "备注", "操作"];

export default function ChannelTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: Channel[];
  onEdit: (c: Channel) => void;
  onDelete: (id: string) => void;
}) {
  // 按出现顺序分组,保留服务端 category 排序
  const groups = useMemo(() => {
    const m = new Map<string, Channel[]>();
    for (const r of rows) {
      const k = r.category || "(未分类)";
      (m.get(k) ?? m.set(k, []).get(k)!).push(r);
    }
    return Array.from(m.entries());
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-10 text-center text-sm text-gray-500">
        暂无匹配的渠道
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 text-left">
          <tr>
            {COLS.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(([cat, list]) => (
            <GroupRows
              key={cat}
              cat={cat}
              list={list}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({
  cat,
  list,
  onEdit,
  onDelete,
}: {
  cat: string;
  list: Channel[];
  onEdit: (c: Channel) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <tr className="border-t bg-gray-50">
        <td colSpan={COLS.length} className="px-3 py-1.5 text-xs font-semibold text-gray-700">
          {cat} · {list.length} 条
        </td>
      </tr>
      {list.map((r) => (
        <tr key={r.id} className="border-t align-top">
          <td className="px-3 py-2 font-medium">{r.name}</td>
          <td className="px-3 py-2">{r.product ?? "—"}</td>
          <td className="px-3 py-2">
            {r.url ? (
              <a href={r.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                打开
              </a>
            ) : (
              "—"
            )}
          </td>
          <td className="px-3 py-2">{r.manual_price ?? "—"}</td>
          <td className="px-3 py-2">{r.warranty ?? "—"}</td>
          <td className="px-3 py-2">
            <span className={`rounded px-2 py-0.5 text-xs ${RISK_COLOR[r.risk]}`}>
              {r.risk}
            </span>
          </td>
          <td className="px-3 py-2">{r.status}</td>
          <td className="px-3 py-2">{r.contact ?? "—"}</td>
          <td className="max-w-xs px-3 py-2 text-gray-600">{r.note ?? "—"}</td>
          <td className="whitespace-nowrap px-3 py-2">
            <button onClick={() => onEdit(r)} className="mr-2 text-blue-600">编辑</button>
            <button onClick={() => onDelete(r.id)} className="text-red-600">删除</button>
          </td>
        </tr>
      ))}
    </>
  );
}
```

- [ ] **Step 2: 类型检查 + 构建**

Run: `npx tsc --noEmit && npm run build`
Expected: 通过,生成 `dist/`。

- [ ] **Step 3: Commit**

```bash
git add src/components/ChannelTable.tsx
git commit -m "feat: 表格按分类分组+每组计数+空状态(规范 §4)"
```

---

## Task C: 表单/登录防重复提交 + 分类预设

**Files:**
- Modify: `src/components/ChannelForm.tsx`
- Modify: `src/components/Login.tsx`

- [ ] **Step 1: `ChannelForm.tsx` 加保存中状态,禁用按钮防重复提交**

在 `const [err, setErr] = useState("");` 下一行加:

```tsx
  const [saving, setSaving] = useState(false);
```

把 `save` 函数替换为:

```tsx
  async function save() {
    if (saving) return;
    setErr("");
    setSaving(true);
    try {
      if (channel) {
        await updateChannel(channel.id, form);
      } else {
        await createChannelBatch(form, lines);
      }
      onSaved();
    } catch (e) {
      setErr(String(e));
      setSaving(false);
    }
  }
```

把底部两个按钮替换为:

```tsx
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded border px-4 py-1.5 text-sm disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded bg-gray-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {saving ? "保存中…" : "保存"}
          </button>
```

- [ ] **Step 2: `ChannelForm.tsx` 加分类预设 datalist**

在组件 `return (` 内最外层 `<div ...>` 之后、`<div className="max-h-[90vh]...">` 之前插入:

```tsx
        <datalist id="cat-presets">
          {["GPT", "Claude", "Google", "Grok", "Suno", "其他"].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
```

给编辑模式 `EDIT_FIELDS` 里 `category` 对应 input 以及创建模式产品行内「分类」input 都加 `list="cat-presets"`。具体:编辑模式 input(`EDIT_FIELDS.map` 里那个 `<input>`)改为按 `f.key === "category"` 条件加 `list`:

```tsx
                <input
                  value={(form[f.key] as string) ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  list={f.key === "category" ? "cat-presets" : undefined}
                  className="w-full rounded border px-2 py-1"
                />
```

产品行内分类 input 改为:

```tsx
                        <input
                          value={ln.category ?? ""}
                          onChange={(e) => setLine(idx, "category", e.target.value)}
                          list="cat-presets"
                          className="w-full rounded border px-2 py-1"
                        />
```

- [ ] **Step 3: `Login.tsx` 防重复提交**

把整文件替换为:

```tsx
import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErr("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pw,
    });
    if (error) {
      setErr("邮箱或密码错误");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <form onSubmit={submit} className="w-80 space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-lg font-semibold">上游采购渠道 · 登录</h1>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="邮箱"
          className="w-full rounded border px-3 py-2"
          autoFocus
        />
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="密码"
          className="w-full rounded border px-3 py-2"
        />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          disabled={loading}
          className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50"
        >
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: 类型检查 + 构建**

Run: `npx tsc --noEmit && npm run build`
Expected: 通过。

- [ ] **Step 5: Commit**

```bash
git add src/components/ChannelForm.tsx src/components/Login.tsx
git commit -m "feat: 保存/登录防重复提交 + 分类预设 datalist"
```

---

## Task D: 主页 CSV 导出 + 删除失败兜底 + 分类筛选并入预设

**Files:**
- Modify: `src/components/Dashboard.tsx`

- [ ] **Step 1: 用完整实现替换 `src/components/Dashboard.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  listChannels,
  filterChannels,
  deleteChannel,
  type Channel,
} from "../lib/channels";
import ChannelTable from "./ChannelTable";
import ChannelForm from "./ChannelForm";

const CATEGORY_PRESETS = ["GPT", "Claude", "Google", "Grok", "Suno", "其他"];

const CSV_COLS: { key: keyof Channel; label: string }[] = [
  { key: "category", label: "分类" },
  { key: "name", label: "渠道名" },
  { key: "product", label: "产品" },
  { key: "url", label: "链接" },
  { key: "manual_price", label: "价格" },
  { key: "warranty", label: "质保" },
  { key: "risk", label: "风险" },
  { key: "status", label: "状态" },
  { key: "contact", label: "联系方式" },
  { key: "card_format", label: "卡密格式" },
  { key: "redeem_url", label: "兑换地址" },
  { key: "note", label: "备注" },
];

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(rows: Channel[]) {
  const head = CSV_COLS.map((c) => c.label).join(",");
  const body = rows
    .map((r) => CSV_COLS.map((c) => csvCell(r[c.key])).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + head + "\n" + body], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `渠道导出-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Dashboard() {
  const [rows, setRows] = useState<Channel[]>([]);
  const [category, setCategory] = useState("全部");
  const [risk, setRisk] = useState("全部");
  const [status, setStatus] = useState("全部");
  const [kw, setKw] = useState("");
  const [editing, setEditing] = useState<Channel | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  async function refresh() {
    try {
      setRows(await listChannels());
    } catch (e) {
      setErr(String(e));
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  const categories = useMemo(
    () => [
      "全部",
      ...Array.from(
        new Set([...CATEGORY_PRESETS, ...rows.map((r) => r.category)]),
      ),
    ],
    [rows],
  );
  const filtered = filterChannels(rows, { category, risk, kw, status });

  async function remove(id: string) {
    if (!confirm("确认删除该渠道?")) return;
    try {
      await deleteChannel(id);
      refresh();
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">上游采购渠道</h1>
        <button
          onClick={() => setCreating(true)}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white"
        >
          + 新增渠道
        </button>
        <label className="flex items-center gap-1 text-sm text-gray-500">
          分类
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border px-2 py-1 text-sm text-gray-900">
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-500">
          风险
          <select value={risk} onChange={(e) => setRisk(e.target.value)} className="rounded border px-2 py-1 text-sm text-gray-900">
            {["全部", "低", "中", "高"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-500">
          状态
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border px-2 py-1 text-sm text-gray-900">
            {["全部", "在售", "空仓", "停售"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <input
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          placeholder="搜索渠道名/产品"
          className="rounded border px-2 py-1 text-sm"
        />
        <button
          onClick={() => exportCsv(filtered)}
          className="rounded border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          导出 CSV
        </button>
        <button
          onClick={async () => { await supabase.auth.signOut(); }}
          className="ml-auto text-sm text-gray-500 underline"
        >
          退出
        </button>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <ChannelTable rows={filtered} onEdit={setEditing} onDelete={remove} />

      {(creating || editing) && (
        <ChannelForm
          channel={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); refresh(); }}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 2: 类型检查 + 构建**

Run: `npx tsc --noEmit && npm run build`
Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add src/components/Dashboard.tsx
git commit -m "feat: 导出当前视图 CSV + 删除失败兜底 + 分类筛选并入预设"
```

---

## Task E: 质量门禁(ESLint + CI 跑 tsc/测试)

**Files:**
- Create: `eslint.config.js`
- Modify: `package.json`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: 装 ESLint 依赖**

Run(项目根):
```bash
npm i -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks
```

- [ ] **Step 2: 写 `eslint.config.js`(flat config)**

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["dist", ".tmp", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
```

- [ ] **Step 3: `package.json` 加 lint script**

把 `"scripts"` 中加入 `"lint": "eslint ."`,并新增聚合脚本 `"verify": "tsc -b && eslint . && npm test"`。最终 `scripts`:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "TMPDIR=$(pwd)/.tmp vitest run",
    "lint": "eslint .",
    "verify": "tsc -b && eslint . && npm test"
  },
```

- [ ] **Step 4: 跑 lint,修掉报错(只修 error,不大改逻辑)**

Run: `npm run lint`
Expected: 通过(若有 error 就地修正,如未用变量加 `_` 前缀;`no-explicit-any` 为 warn 不阻断)。

- [ ] **Step 5: CI 在构建前先 verify**

把 `.github/workflows/deploy.yml` 中 `- run: npm run build` 这一步**之前**插入一步:

```yaml
      - run: npm run verify
```

(保持其余 steps 不变;`npm ci` 之后、`npm run build` 之前。)

- [ ] **Step 6: 本地全量校验**

Run: `npm run verify && npm run build`
Expected: 全通过。

- [ ] **Step 7: Commit**

```bash
git add eslint.config.js package.json package-lock.json .github/workflows/deploy.yml
git commit -m "ci: ESLint + 部署前跑 tsc/lint/测试 门禁"
```

---

## Self-Review

- **范围合规:** 5 个轨道均为打磨/健壮性/规范补齐/质量门禁,无爬虫、无订单支付库存、无对外页面、未动鉴权 RLS。符合 v2 规范红线。
- **规范覆盖:** §4「表格按分类分组」此前缺失 → Task B 补齐;其余规范项 MVP 已实现,本计划不回归。
- **占位扫描:** 无 TBD/TODO;每步均含完整代码或确切命令与预期。
- **类型一致:** `buildBatchRows(base, lines)` 在 Task A 定义并被 `createChannelBatch` 复用;`Filters` 签名不变(Task A 仅改内部实现),故 Dashboard(Task D)调用 `filterChannels({category,risk,kw,status})` 不受影响;`ChannelTable`/`ChannelForm` props 签名未变,Dashboard 调用一致。
- **并行安全:** A=channels.ts+test;B=ChannelTable.tsx;C=ChannelForm.tsx+Login.tsx;D=Dashboard.tsx;E=eslint/package.json/deploy.yml —— 文件集两两不相交,worktree 并行无冲突。分类预设常量在 C(datalist)与 D(筛选)各自局部声明,刻意小重复以保证轨道完全独立。
- **合并顺序:** A→B→C→D→E,每次合并后跑 `npm run build` + `npm test` 把关。

# 上游采购渠道工具 Implementation Plan(v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给本人 + 合伙人内部私用的上游采购渠道工具:登录后纯手动增删改查渠道信息,链接可跳转,托管在 GitHub Pages。

**Architecture:** Vite + React 静态单页应用,发布到 GitHub Pages(无服务器)。数据与登录用 Supabase:Auth(邮箱密码,各自账号)+ Postgres + 行级安全 RLS(未登录拿不到任何数据)。无爬虫。

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS, `@supabase/supabase-js`, Vitest, GitHub Actions(仅构建发布)。

参考规范:`docs/superpowers/specs/2026-05-16-upstream-procurement-tool-design.md`(v2)

---

## File Structure

```
package.json
vite.config.ts
tsconfig.json
index.html
.env.example
.gitignore
src/
  main.tsx               # 挂载 React
  App.tsx                # 鉴权门:未登录->Login,已登录->Dashboard
  index.css              # Tailwind 入口
  lib/
    supabase.ts          # Supabase 客户端(VITE_ env)
    channels.ts          # channels CRUD + 类型 + sanitize + 过滤纯函数
  components/
    Login.tsx            # 邮箱密码登录
    Dashboard.tsx        # 主页:工具栏 + 表格
    ChannelTable.tsx     # 表格渲染(纯展示)
    ChannelForm.tsx      # 新增/编辑弹窗
  __tests__/
    channels.test.ts     # sanitize + filter 纯函数测试
supabase/
  schema.sql             # 建表 + RLS
.github/workflows/
  deploy.yml             # 构建并发布 GitHub Pages
README.md
docs/DEPLOY.md           # Supabase + GitHub Pages 步骤
```

---

## Task 1: Vite + React + Tailwind 脚手架

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `tailwind.config.js`, `postcss.config.js`
- Modify: `.gitignore`

- [ ] **Step 1: 安装依赖**

Run(项目根 `~/Desktop/上游采购工具`):
```bash
npm init -y
npm i react react-dom @supabase/supabase-js
npm i -D vite @vitejs/plugin-react typescript @types/react @types/react-dom tailwindcss postcss autoprefixer vitest jsdom
npx tailwindcss init -p
```

- [ ] **Step 2: 写 `package.json` scripts**

把 `"scripts"` 替换为:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: 配置文件**

`vite.config.ts`(GitHub Pages 子路径:`base` 用 `/<仓库名>/`,仓库名暂定 `upstream-procurement`,部署时按真实仓库名改):
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/upstream-procurement/",
  test: { environment: "jsdom" },
});
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

`index.html`:
```html
<!doctype html>
<html lang="zh">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>上游采购渠道</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/App.tsx`(占位,Task 5 替换):
```tsx
export default function App() {
  return <div className="p-6">上游采购渠道</div>;
}
```

- [ ] **Step 4: 更新 `.gitignore`**

确保包含:
```
node_modules/
dist/
.env
.env.local
```

- [ ] **Step 5: 验证可构建**

Run: `npm run build`
Expected: 构建成功,生成 `dist/`

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: Vite + React + Tailwind 脚手架"
```

---

## Task 2: Supabase 建表 + RLS + 部署文档

**Files:**
- Create: `supabase/schema.sql`, `docs/DEPLOY.md`

- [ ] **Step 1: 写 `supabase/schema.sql`**

```sql
create table if not exists channels (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  url text,
  manual_price text,
  warranty text,
  risk text not null default '低' check (risk in ('低','中','高')),
  contact text,
  note text,
  card_format text,
  redeem_url text,
  status text not null default '在售' check (status in ('在售','空仓','停售')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_channels_category on channels(category);

create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_channels_updated_at on channels;
create trigger trg_channels_updated_at
  before update on channels
  for each row execute function set_updated_at();

-- 行级安全:仅登录用户可读写,未登录拿不到任何行
alter table channels enable row level security;

drop policy if exists channels_authenticated_all on channels;
create policy channels_authenticated_all on channels
  for all
  to authenticated
  using (true)
  with check (true);
```

- [ ] **Step 2: 写 `docs/DEPLOY.md`(Supabase 部分)**

```markdown
# 部署步骤

## 1. Supabase
1. supabase.com 注册,新建免费 project
2. SQL Editor 粘贴执行 `supabase/schema.sql`(建表 + RLS)
3. Project Settings → API,记下 `Project URL` 和 `anon` public key(前端用这两个)
4. Authentication → Providers → Email:保持启用
5. Authentication → Sign In / Providers(或 Settings)→ 关闭 "Allow new users to sign up"(禁止公开注册)
6. Authentication → Users → Add user,手动创建 2 个账号(你和合伙人的邮箱+密码)
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: Supabase channels 表 + RLS + 部署文档"
```

---

## Task 3: Supabase 客户端

**Files:**
- Create: `src/lib/supabase.ts`, `.env.example`

- [ ] **Step 1: 写 `.env.example`**

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

- [ ] **Step 2: 写 `src/lib/supabase.ts`**

```ts
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  throw new Error("缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url, anon);
```

- [ ] **Step 3: 本地 `.env`**

Run: `cp .env.example .env`,然后把 `.env` 填成 Task 2 拿到的真实 `Project URL` 和 `anon key`(`.env` 已 gitignore)。若此时还没注册 Supabase,先填占位,Task 6 真实联调时再补。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: Supabase 浏览器客户端"
```

---

## Task 4: 数据层 + 纯函数(TDD)

**Files:**
- Create: `src/lib/channels.ts`
- Test: `src/__tests__/channels.test.ts`

- [ ] **Step 1: 写失败测试 `src/__tests__/channels.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { sanitizeChannelInput, filterChannels, type Channel } from "../lib/channels";

describe("sanitizeChannelInput", () => {
  it("trims and applies defaults", () => {
    const out = sanitizeChannelInput({ category: " GPT ", name: " jayron " });
    expect(out.category).toBe("GPT");
    expect(out.name).toBe("jayron");
    expect(out.risk).toBe("低");
    expect(out.status).toBe("在售");
  });
  it("rejects empty name", () => {
    expect(() => sanitizeChannelInput({ category: "GPT", name: " " })).toThrow();
  });
  it("rejects invalid risk", () => {
    expect(() =>
      sanitizeChannelInput({ category: "GPT", name: "x", risk: "x" }),
    ).toThrow();
  });
});

const rows = [
  { id: "1", category: "GPT", name: "jayron", risk: "低" },
  { id: "2", category: "Claude", name: "gugu", risk: "高" },
] as Channel[];

describe("filterChannels", () => {
  it("filters by category", () => {
    expect(filterChannels(rows, { category: "GPT", risk: "全部", kw: "" })).toHaveLength(1);
  });
  it("filters by risk", () => {
    expect(filterChannels(rows, { category: "全部", risk: "高", kw: "" })).toHaveLength(1);
  });
  it("filters by keyword (case-insensitive)", () => {
    expect(filterChannels(rows, { category: "全部", risk: "全部", kw: "JAY" })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/__tests__/channels.test.ts`
Expected: FAIL,找不到 `../lib/channels`

- [ ] **Step 3: 写 `src/lib/channels.ts`**

```ts
import { supabase } from "./supabase";

export type Risk = "低" | "中" | "高";
export type Status = "在售" | "空仓" | "停售";

export interface Channel {
  id: string;
  category: string;
  name: string;
  url: string | null;
  manual_price: string | null;
  warranty: string | null;
  risk: Risk;
  contact: string | null;
  note: string | null;
  card_format: string | null;
  redeem_url: string | null;
  status: Status;
  created_at: string;
  updated_at: string;
}

export type ChannelInput = Partial<Channel>;

const RISKS: Risk[] = ["低", "中", "高"];
const STATUSES: Status[] = ["在售", "空仓", "停售"];

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function sanitizeChannelInput(input: ChannelInput) {
  const name = s(input.name);
  const category = s(input.category);
  if (!name) throw new Error("渠道名必填");
  if (!category) throw new Error("分类必填");
  const risk = (input.risk ?? "低") as Risk;
  if (!RISKS.includes(risk)) throw new Error("风险值非法");
  const status = (input.status ?? "在售") as Status;
  if (!STATUSES.includes(status)) throw new Error("状态值非法");
  return {
    category,
    name,
    url: s(input.url) || null,
    manual_price: s(input.manual_price) || null,
    warranty: s(input.warranty) || null,
    risk,
    contact: s(input.contact) || null,
    note: s(input.note) || null,
    card_format: s(input.card_format) || null,
    redeem_url: s(input.redeem_url) || null,
    status,
  };
}

export interface Filters {
  category: string;
  risk: string;
  kw: string;
}

export function filterChannels(rows: Channel[], f: Filters): Channel[] {
  return rows.filter(
    (r) =>
      (f.category === "全部" || r.category === f.category) &&
      (f.risk === "全部" || r.risk === f.risk) &&
      (f.kw === "" || r.name.toLowerCase().includes(f.kw.toLowerCase())),
  );
}

export async function listChannels(): Promise<Channel[]> {
  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .order("category")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as Channel[];
}

export async function createChannel(input: ChannelInput): Promise<void> {
  const { error } = await supabase
    .from("channels")
    .insert(sanitizeChannelInput(input));
  if (error) throw new Error(error.message);
}

export async function updateChannel(id: string, input: ChannelInput): Promise<void> {
  const { error } = await supabase
    .from("channels")
    .update(sanitizeChannelInput(input))
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteChannel(id: string): Promise<void> {
  const { error } = await supabase.from("channels").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/__tests__/channels.test.ts`
Expected: PASS(6 个用例全过)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: channels 数据层 + sanitize/filter 纯函数(TDD)"
```

---

## Task 5: 鉴权门 + 登录页

**Files:**
- Create: `src/components/Login.tsx`
- Modify: `src/App.tsx`(替换占位)

- [ ] **Step 1: 写 `src/components/Login.tsx`**

```tsx
import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pw,
    });
    if (error) setErr("邮箱或密码错误");
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
        <button className="w-full rounded bg-gray-900 py-2 text-white">登录</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: 写 `src/App.tsx`(鉴权门)**

```tsx
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="p-6 text-gray-500">加载中…</div>;
  return session ? <Dashboard /> : <Login />;
}
```

- [ ] **Step 3: 占位 `src/components/Dashboard.tsx`(Task 6 替换,先保证编译)**

```tsx
export default function Dashboard() {
  return <div className="p-6">已登录(主页待实现)</div>;
}
```

- [ ] **Step 4: 类型检查 + 构建**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: Supabase Auth 鉴权门 + 登录页"
```

---

## Task 6: 主页表格(展示 + 筛选)

**Files:**
- Create: `src/components/ChannelTable.tsx`
- Modify: `src/components/Dashboard.tsx`(替换占位)

- [ ] **Step 1: 写 `src/components/ChannelTable.tsx`(纯展示)**

```tsx
import type { Channel } from "../lib/channels";

const RISK_COLOR: Record<string, string> = {
  低: "bg-green-100 text-green-800",
  中: "bg-yellow-100 text-yellow-800",
  高: "bg-red-100 text-red-800",
};

export default function ChannelTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: Channel[];
  onEdit: (c: Channel) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 text-left">
          <tr>
            {["分类", "渠道", "链接", "价格", "质保", "风险", "状态", "联系方式", "备注", "操作"].map(
              (h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t align-top">
              <td className="px-3 py-2">{r.category}</td>
              <td className="px-3 py-2 font-medium">{r.name}</td>
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
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: 写 `src/components/Dashboard.tsx`**

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

export default function Dashboard() {
  const [rows, setRows] = useState<Channel[]>([]);
  const [category, setCategory] = useState("全部");
  const [risk, setRisk] = useState("全部");
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
    () => ["全部", ...Array.from(new Set(rows.map((r) => r.category)))],
    [rows],
  );
  const filtered = filterChannels(rows, { category, risk, kw });

  async function remove(id: string) {
    if (!confirm("确认删除该渠道?")) return;
    await deleteChannel(id);
    refresh();
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
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded border px-2 py-1 text-sm">
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={risk} onChange={(e) => setRisk(e.target.value)} className="rounded border px-2 py-1 text-sm">
          {["全部", "低", "中", "高"].map((c) => <option key={c}>{c}</option>)}
        </select>
        <input
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          placeholder="搜索渠道名"
          className="rounded border px-2 py-1 text-sm"
        />
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

- [ ] **Step 3: 占位 `src/components/ChannelForm.tsx`(Task 7 替换)**

```tsx
import type { Channel } from "../lib/channels";
export default function ChannelForm(_: {
  channel: Channel | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return null;
}
```

- [ ] **Step 4: 构建验证**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: 主页表格 + 筛选/搜索/风险徽章/链接跳转"
```

---

## Task 7: 新增/编辑弹窗

**Files:**
- Modify: `src/components/ChannelForm.tsx`(替换占位)

- [ ] **Step 1: 写完整 `src/components/ChannelForm.tsx`**

```tsx
import { useState } from "react";
import {
  createChannel,
  updateChannel,
  type Channel,
} from "../lib/channels";

const FIELDS: { key: keyof Channel; label: string }[] = [
  { key: "category", label: "分类" },
  { key: "name", label: "渠道名" },
  { key: "url", label: "链接" },
  { key: "manual_price", label: "价格" },
  { key: "warranty", label: "质保" },
  { key: "contact", label: "联系方式" },
  { key: "card_format", label: "卡密格式" },
  { key: "redeem_url", label: "兑换地址" },
  { key: "note", label: "备注" },
];

export default function ChannelForm({
  channel,
  onClose,
  onSaved,
}: {
  channel: Channel | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, unknown>>(
    channel ?? { risk: "低", status: "在售" },
  );
  const [err, setErr] = useState("");

  function set(k: string, v: unknown) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setErr("");
    try {
      if (channel) await updateChannel(channel.id, form);
      else await createChannel(form);
      onSaved();
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">
          {channel ? "编辑渠道" : "新增渠道"}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="text-sm">
              <span className="mb-1 block text-gray-600">{f.label}</span>
              <input
                value={(form[f.key] as string) ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                className="w-full rounded border px-2 py-1"
              />
            </label>
          ))}
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">风险</span>
            <select value={(form.risk as string) ?? "低"} onChange={(e) => set("risk", e.target.value)} className="w-full rounded border px-2 py-1">
              {["低", "中", "高"].map((v) => <option key={v}>{v}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-600">状态</span>
            <select value={(form.status as string) ?? "在售"} onChange={(e) => set("status", e.target.value)} className="w-full rounded border px-2 py-1">
              {["在售", "空仓", "停售"].map((v) => <option key={v}>{v}</option>)}
            </select>
          </label>
        </div>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="rounded border px-4 py-1.5 text-sm">取消</button>
          <button onClick={save} className="rounded bg-gray-900 px-4 py-1.5 text-sm text-white">保存</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 全量测试 + 构建**

Run: `npm test && npm run build`
Expected: 测试 PASS,构建成功

- [ ] **Step 3: 真实联调(需 Task 2/3 的 Supabase 已配好 + .env 真实值 + 已建账号)**

Run: `npm run dev`,浏览器开 `http://localhost:5173`:登录 → 新增渠道 → 表格出现 → 编辑改风险(徽章变色)→ 删除二次确认 → 退出回登录页。若 Supabase 未就绪,先跳过,部署后验证。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: 新增/编辑渠道弹窗"
```

---

## Task 8: GitHub Pages 部署 + README

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`
- Modify: `docs/DEPLOY.md`(补 GitHub Pages 部分)

- [ ] **Step 1: 写 `.github/workflows/deploy.yml`**

```yaml
name: deploy-pages
on:
  push:
    branches: [main]
  workflow_dispatch: {}
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deploy
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 补 `docs/DEPLOY.md`(GitHub Pages 部分)**

```markdown
## 2. GitHub Pages
1. 新建 GitHub 仓库(仓库名需与 vite.config.ts 的 base `/<仓库名>/` 一致;
   若用默认 `upstream-procurement`,仓库就叫这个,否则改 vite.config.ts 后再 push)
2. Settings → Secrets and variables → Actions,新增:
   - `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`
3. Settings → Pages → Build and deployment → Source 选 "GitHub Actions"
4. push 到 main 触发部署;完成后 Pages 给出网址
5. 打开网址 → 登录页 → 用 Supabase 后台建好的账号登录
6. 仅把网址和账号给合伙人。前端代码不含价格,价格全在登录后由 Supabase 受 RLS 保护返回
```

- [ ] **Step 3: 写 `README.md`**

```markdown
# 上游采购渠道工具(内部私用)

本人 + 合伙人内部使用,纯手动增删改查渠道信息。无爬虫。

## 本地开发
```bash
npm install
cp .env.example .env   # 填 Supabase URL / anon key
npm run dev
```

## 测试
```bash
npm test
```

## 部署
见 `docs/DEPLOY.md`(Supabase + GitHub Pages)。

## 安全说明
- 登录用 Supabase Auth(各自账号),数据受行级安全 RLS 保护:未登录拿不到任何价格数据。
- 公开注册在 Supabase 后台关闭,账号由管理员手动创建。
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "ci+docs: GitHub Pages 部署 + README"
```

---

## Self-Review(已执行)

- **Spec(v2)覆盖:** §2 架构(Vite/React/Pages/Supabase)→Task 1/3/8;§3 数据模型→Task 2/4;§4 功能页面(登录/表格/筛选/弹窗/删除)→Task 5/6/7;RLS+各自账号+关闭注册→Task 2;§5 范围(单 MVP)→全计划;§6 风险(RLS 真锁、anon key 正常)→Task 2/8 文档。无遗漏。
- **占位扫描:** 无 TBD/TODO;占位组件(Dashboard/ChannelForm)均在后续 Task 显式给出完整替换实现,非计划占位。
- **类型一致:** `Channel`/`ChannelInput`/`Risk`/`Status`/`Filters`(Task 4)在 Task 5/6/7 一致引用;`listChannels`/`createChannel`/`updateChannel`/`deleteChannel`/`filterChannels`/`sanitizeChannelInput` 命名前后一致;`ChannelForm`/`ChannelTable` props 签名在 Dashboard 调用处一致;`supabase` 单例(Task 3)在各处一致引用。
- **爬虫已彻底移除:** 计划与规范均无 crawl_* 字段、无适配器、无定时任务,仅保留 Pages 构建发布。

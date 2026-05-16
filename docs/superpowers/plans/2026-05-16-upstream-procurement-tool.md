# 上游采购渠道工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给本人 + 合伙人内部私用的上游采购渠道工具:口令登录、渠道增删改查、链接可跳转、部分发卡网价格定时自动抓取。

**Architecture:** Next.js(App Router)单仓库,前端表格 + Route Handler API;Supabase Postgres 存数据;共用口令 + 签名 Cookie 鉴权;爬虫为仓库内 Node 脚本,由 GitHub Actions 定时触发并写回 Supabase。手动 CRUD 是可靠地基,自动抓价为尽力而为的增强。

**Tech Stack:** Next.js 14 (App Router, TypeScript), Tailwind CSS, Supabase (`@supabase/supabase-js`), Vitest, cheerio, GitHub Actions。

参考规范:`docs/superpowers/specs/2026-05-16-upstream-procurement-tool-design.md`

---

## File Structure

```
package.json
next.config.mjs
tsconfig.json
vitest.config.ts
.env.example
.gitignore
src/
  lib/
    env.ts                 # 读取并校验环境变量
    auth.ts                # 口令校验 + 会话 token 签名/验签
    supabase.ts            # 服务端 Supabase 客户端(service key)
    channels.ts            # channels 表数据访问层 + 类型
  middleware.ts            # 全站鉴权,未登录重定向 /login
  app/
    login/page.tsx         # 登录页
    api/login/route.ts     # 校验口令,种 Cookie
    api/logout/route.ts    # 清 Cookie
    api/channels/route.ts          # GET 列表 / POST 新增
    api/channels/[id]/route.ts     # PUT 更新 / DELETE 删除
    page.tsx               # 主表格页(服务端取数)
    ChannelTable.tsx       # 表格 + 筛选 + 排序(客户端组件)
    ChannelForm.tsx        # 新增/编辑弹窗(客户端组件)
    globals.css
scripts/
  crawler/
    types.ts               # 适配器接口与抓取结果类型
    registry.ts            # 域名 -> 适配器 映射
    adapters/
      ldxp.ts              # pay.ldxp.cn 适配器
      redeemgpt.ts         # redeemgpt.com 适配器
    run.ts                 # 主流程:读 Supabase -> 抓 -> 写回
  __tests__/
    auth.test.ts
    channels.test.ts
    ldxp.test.ts
    redeemgpt.test.ts
    fixtures/
      ldxp.html
      redeemgpt.html
supabase/
  schema.sql               # 建表 SQL
.github/workflows/
  crawl.yml                # 定时 + 手动触发爬虫
README.md
docs/DEPLOY.md             # Supabase + Vercel + Secrets 部署步骤
```

---

## Task 1: 项目脚手架

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `src/app/globals.css`, `src/app/layout.tsx`
- Modify: `.gitignore`

- [ ] **Step 1: 初始化 Next.js + 依赖**

Run(在项目根 `~/Desktop/上游采购工具`):
```bash
npm init -y
npm i next@14 react react-dom @supabase/supabase-js cheerio
npm i -D typescript @types/react @types/node @types/react-dom tailwindcss postcss autoprefixer vitest tsx
npx tailwindcss init -p
```

- [ ] **Step 2: 写 `package.json` 的 scripts**

把 `package.json` 的 `"scripts"` 替换为:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "crawl": "tsx scripts/crawler/run.ts"
  }
}
```

- [ ] **Step 3: 写配置文件**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "ES2020"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "incremental": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node" } });
```

`tailwind.config.js`(覆盖 content):
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

`src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`src/app/layout.tsx`:
```tsx
import "./globals.css";

export const metadata = { title: "上游采购渠道" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: 更新 `.gitignore`**

确保内容包含:
```
.env
.env.local
node_modules/
.next/
next-env.d.ts
```

- [ ] **Step 5: 验证可启动**

Run: `npm run build`
Expected: 构建成功(此时无页面也应通过;若报缺 `src/app/page.tsx`,Task 7 会补,此处可临时建空 `src/app/page.tsx` 返回 `<main/>` 后再 build)

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: Next.js + Tailwind + Vitest 脚手架"
```

---

## Task 2: 环境变量与校验

**Files:**
- Create: `src/lib/env.ts`, `.env.example`

- [ ] **Step 1: 写 `.env.example`**

```
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=service-role-key-here
# 登录共用口令(明文,部署时设为强口令)
APP_PASSWORD=change-me
# 会话 Cookie 签名密钥(随机 32+ 字节十六进制)
SESSION_SECRET=replace-with-random-hex
```

- [ ] **Step 2: 写 `src/lib/env.ts`**

```ts
function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export const env = {
  supabaseUrl: () => required("SUPABASE_URL"),
  supabaseServiceKey: () => required("SUPABASE_SERVICE_KEY"),
  appPassword: () => required("APP_PASSWORD"),
  sessionSecret: () => required("SESSION_SECRET"),
};
```

- [ ] **Step 3: 本地 `.env` 占位**

Run:
```bash
cp .env.example .env
```
然后手动把 `.env` 里的值改成本地可用值(`APP_PASSWORD=test123`,`SESSION_SECRET` 用 `openssl rand -hex 32` 生成;Supabase 值在 Task 3 部署文档里获取,本地测试先随意填)。`.env` 已被 gitignore。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: 环境变量定义与校验"
```

---

## Task 3: Supabase 表结构

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
  crawl_enabled boolean not null default false,
  crawl_price text,
  crawl_at timestamptz,
  crawl_status text check (crawl_status in ('成功','失败','不支持')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_channels_category on channels(category);

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_channels_updated_at on channels;
create trigger trg_channels_updated_at
  before update on channels
  for each row execute function set_updated_at();
```

- [ ] **Step 2: 写 `docs/DEPLOY.md` 的 Supabase 部分**

```markdown
# 部署步骤

## 1. Supabase
1. supabase.com 注册,新建免费 project
2. 进 Project Settings → API,记下 `Project URL` 和 `service_role` key
3. 进 SQL Editor,粘贴执行 `supabase/schema.sql`
4. (RLS 不开启;本表只经服务端 service key 访问,前端不直连)
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: Supabase channels 表结构与部署文档"
```

---

## Task 4: 鉴权逻辑(TDD)

**Files:**
- Create: `src/lib/auth.ts`
- Test: `scripts/__tests__/auth.test.ts`

- [ ] **Step 1: 写失败测试 `scripts/__tests__/auth.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { signSession, verifySession, checkPassword } from "../../src/lib/auth";

const SECRET = "test-secret-0123456789";

describe("session token", () => {
  it("signs and verifies a valid token", () => {
    const token = signSession(SECRET, 1000 * 60);
    expect(verifySession(SECRET, token)).toBe(true);
  });

  it("rejects a tampered token", () => {
    const token = signSession(SECRET, 1000 * 60);
    expect(verifySession(SECRET, token + "x")).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = signSession(SECRET, -1000);
    expect(verifySession(SECRET, token)).toBe(false);
  });

  it("rejects token signed with a different secret", () => {
    const token = signSession(SECRET, 1000 * 60);
    expect(verifySession("other-secret", token)).toBe(false);
  });
});

describe("checkPassword", () => {
  it("accepts correct password", () => {
    expect(checkPassword("hunter2", "hunter2")).toBe(true);
  });
  it("rejects wrong password", () => {
    expect(checkPassword("hunter2", "nope")).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run scripts/__tests__/auth.test.ts`
Expected: FAIL,提示找不到 `../../src/lib/auth`

- [ ] **Step 3: 写 `src/lib/auth.ts`**

```ts
import crypto from "crypto";

// token 格式: <expiresAtMs>.<hmacHex>
export function signSession(secret: string, ttlMs: number): string {
  const expiresAt = Date.now() + ttlMs;
  const payload = String(expiresAt);
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySession(secret: string, token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return false;
  }
  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt)) return false;
  return Date.now() < expiresAt;
}

export function checkPassword(expected: string, given: string): boolean {
  if (expected.length !== given.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

export const SESSION_COOKIE = "ucp_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 天
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run scripts/__tests__/auth.test.ts`
Expected: PASS(6 个用例全过)

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: 口令校验与签名会话(TDD)"
```

---

## Task 5: 全站鉴权 + 登录/登出

**Files:**
- Create: `src/middleware.ts`, `src/app/login/page.tsx`, `src/app/api/login/route.ts`, `src/app/api/logout/route.ts`

- [ ] **Step 1: 写 `src/middleware.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

const PUBLIC = ["/login", "/api/login"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret && verifySession(secret, token)) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: 写 `src/app/api/login/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  checkPassword,
  signSession,
  SESSION_COOKIE,
  SESSION_TTL_MS,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (!checkPassword(env.appPassword(), String(password ?? ""))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const token = signSession(env.sessionSecret(), SESSION_TTL_MS);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return res;
}
```

- [ ] **Step 3: 写 `src/app/api/logout/route.ts`**

```ts
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
```

- [ ] **Step 4: 写 `src/app/login/page.tsx`**

```tsx
"use client";
import { useState } from "react";

export default function LoginPage() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(false);
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (r.ok) window.location.href = "/";
    else setErr(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={submit} className="w-80 space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-lg font-semibold">上游采购渠道 · 登录</h1>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="访问口令"
          className="w-full rounded border px-3 py-2"
          autoFocus
        />
        {err && <p className="text-sm text-red-600">口令错误</p>}
        <button className="w-full rounded bg-gray-900 py-2 text-white">进入</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: 手动验证**

Run: `npm run dev`,浏览器开 `http://localhost:3000` → 应被重定向到 `/login`;输入 `.env` 里的 `APP_PASSWORD` → 进入后(主页 Task 7 完成前可能 404,属正常);输错口令 → 显示"口令错误"。

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: 全站鉴权 + 登录/登出"
```

---

## Task 6: 数据访问层(TDD)

**Files:**
- Create: `src/lib/supabase.ts`, `src/lib/channels.ts`
- Test: `scripts/__tests__/channels.test.ts`

- [ ] **Step 1: 写 `src/lib/supabase.ts`**

```ts
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

export function supabaseAdmin() {
  return createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
    auth: { persistSession: false },
  });
}
```

- [ ] **Step 2: 写失败测试 `scripts/__tests__/channels.test.ts`**

只测纯函数(输入清洗 / 校验),不打真实网络:
```ts
import { describe, it, expect } from "vitest";
import { sanitizeChannelInput } from "../../src/lib/channels";

describe("sanitizeChannelInput", () => {
  it("trims strings and applies defaults", () => {
    const out = sanitizeChannelInput({ category: " GPT ", name: " jayron " });
    expect(out.category).toBe("GPT");
    expect(out.name).toBe("jayron");
    expect(out.risk).toBe("低");
    expect(out.status).toBe("在售");
    expect(out.crawl_enabled).toBe(false);
  });

  it("rejects empty name", () => {
    expect(() => sanitizeChannelInput({ category: "GPT", name: "  " })).toThrow();
  });

  it("rejects invalid risk", () => {
    expect(() =>
      sanitizeChannelInput({ category: "GPT", name: "x", risk: "爆炸" }),
    ).toThrow();
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run scripts/__tests__/channels.test.ts`
Expected: FAIL,找不到 `sanitizeChannelInput`

- [ ] **Step 4: 写 `src/lib/channels.ts`**

```ts
import { supabaseAdmin } from "./supabase";

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
  crawl_enabled: boolean;
  crawl_price: string | null;
  crawl_at: string | null;
  crawl_status: "成功" | "失败" | "不支持" | null;
  created_at: string;
  updated_at: string;
}

export type ChannelInput = Partial<Channel> & {
  category?: string;
  name?: string;
};

const RISKS: Risk[] = ["低", "中", "高"];
const STATUSES: Status[] = ["在售", "空仓", "停售"];

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function sanitizeChannelInput(input: ChannelInput) {
  const name = s(input.name);
  const category = s(input.category);
  if (!name) throw new Error("name is required");
  if (!category) throw new Error("category is required");
  const risk = (input.risk ?? "低") as Risk;
  if (!RISKS.includes(risk)) throw new Error("invalid risk");
  const status = (input.status ?? "在售") as Status;
  if (!STATUSES.includes(status)) throw new Error("invalid status");
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
    crawl_enabled: Boolean(input.crawl_enabled),
  };
}

export async function listChannels(): Promise<Channel[]> {
  const { data, error } = await supabaseAdmin()
    .from("channels")
    .select("*")
    .order("category", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Channel[];
}

export async function createChannel(input: ChannelInput): Promise<Channel> {
  const row = sanitizeChannelInput(input);
  const { data, error } = await supabaseAdmin()
    .from("channels")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Channel;
}

export async function updateChannel(
  id: string,
  input: ChannelInput,
): Promise<Channel> {
  const row = sanitizeChannelInput(input);
  const { data, error } = await supabaseAdmin()
    .from("channels")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Channel;
}

export async function deleteChannel(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("channels").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run scripts/__tests__/channels.test.ts`
Expected: PASS(3 个用例全过)

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: channels 数据访问层 + 输入清洗(TDD)"
```

---

## Task 7: CRUD API 路由

**Files:**
- Create: `src/app/api/channels/route.ts`, `src/app/api/channels/[id]/route.ts`

- [ ] **Step 1: 写 `src/app/api/channels/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { listChannels, createChannel } from "@/lib/channels";

export async function GET() {
  try {
    return NextResponse.json(await listChannels());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return NextResponse.json(await createChannel(body), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
```

- [ ] **Step 2: 写 `src/app/api/channels/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { updateChannel, deleteChannel } from "@/lib/channels";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();
    return NextResponse.json(await updateChannel(params.id, body));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await deleteChannel(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 3: 验证类型编译**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: channels CRUD API 路由"
```

---

## Task 8: 主表格页

**Files:**
- Create: `src/app/page.tsx`, `src/app/ChannelTable.tsx`

- [ ] **Step 1: 写 `src/app/page.tsx`(服务端取数)**

```tsx
import { listChannels } from "@/lib/channels";
import ChannelTable from "./ChannelTable";

export const dynamic = "force-dynamic";

export default async function Home() {
  const channels = await listChannels();
  return (
    <main className="mx-auto max-w-7xl p-6">
      <ChannelTable initial={channels} />
    </main>
  );
}
```

- [ ] **Step 2: 写 `src/app/ChannelTable.tsx`**

```tsx
"use client";
import { useMemo, useState } from "react";
import type { Channel } from "@/lib/channels";
import ChannelForm from "./ChannelForm";

const RISK_COLOR: Record<string, string> = {
  低: "bg-green-100 text-green-800",
  中: "bg-yellow-100 text-yellow-800",
  高: "bg-red-100 text-red-800",
};

export default function ChannelTable({ initial }: { initial: Channel[] }) {
  const [rows, setRows] = useState<Channel[]>(initial);
  const [cat, setCat] = useState("全部");
  const [risk, setRisk] = useState("全部");
  const [kw, setKw] = useState("");
  const [editing, setEditing] = useState<Channel | null>(null);
  const [creating, setCreating] = useState(false);

  const categories = useMemo(
    () => ["全部", ...Array.from(new Set(rows.map((r) => r.category)))],
    [rows],
  );

  const filtered = rows.filter(
    (r) =>
      (cat === "全部" || r.category === cat) &&
      (risk === "全部" || r.risk === risk) &&
      (kw === "" || r.name.toLowerCase().includes(kw.toLowerCase())),
  );

  async function refresh() {
    const r = await fetch("/api/channels");
    setRows(await r.json());
  }

  async function remove(id: string) {
    if (!confirm("确认删除该渠道?")) return;
    await fetch(`/api/channels/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">上游采购渠道</h1>
        <button
          onClick={() => setCreating(true)}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white"
        >
          + 新增渠道
        </button>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded border px-2 py-1 text-sm">
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
        <a href="#" onClick={async (e) => { e.preventDefault(); await fetch("/api/logout", { method: "POST" }); location.href = "/login"; }} className="ml-auto text-sm text-gray-500 underline">退出</a>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              {["分类", "渠道", "链接", "手填价", "抓取价/时间", "质保", "风险", "状态", "联系方式", "备注", "操作"].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-3 py-2">{r.category}</td>
                <td className="px-3 py-2 font-medium">{r.name}</td>
                <td className="px-3 py-2">
                  {r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">打开</a> : "—"}
                </td>
                <td className="px-3 py-2">{r.manual_price ?? "—"}</td>
                <td className="px-3 py-2">
                  {r.crawl_status === "成功" ? (
                    <span>{r.crawl_price} <span className="text-xs text-gray-400">{r.crawl_at?.slice(0, 16).replace("T", " ")}</span></span>
                  ) : (
                    <span className="text-xs text-gray-400">{r.crawl_status ?? "未抓"}</span>
                  )}
                </td>
                <td className="px-3 py-2">{r.warranty ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${RISK_COLOR[r.risk]}`}>{r.risk}</span>
                </td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2">{r.contact ?? "—"}</td>
                <td className="max-w-xs px-3 py-2 text-gray-600">{r.note ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <button onClick={() => setEditing(r)} className="mr-2 text-blue-600">编辑</button>
                  <button onClick={() => remove(r.id)} className="text-red-600">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <ChannelForm
          channel={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: 验证编译(ChannelForm 下个 Task 写,先放占位避免编译失败)**

临时建 `src/app/ChannelForm.tsx`:
```tsx
"use client";
import type { Channel } from "@/lib/channels";
export default function ChannelForm(_: {
  channel: Channel | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return null;
}
```
Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: 主表格页(筛选/搜索/风险徽章/链接跳转)"
```

---

## Task 9: 新增/编辑表单弹窗

**Files:**
- Modify: `src/app/ChannelForm.tsx`(替换 Task 8 的占位实现)

- [ ] **Step 1: 写完整 `src/app/ChannelForm.tsx`**

```tsx
"use client";
import { useState } from "react";
import type { Channel } from "@/lib/channels";

const FIELDS: { key: keyof Channel; label: string }[] = [
  { key: "category", label: "分类" },
  { key: "name", label: "渠道名" },
  { key: "url", label: "链接" },
  { key: "manual_price", label: "手填价格" },
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
    channel ?? { risk: "低", status: "在售", crawl_enabled: false },
  );
  const [err, setErr] = useState("");

  function set(k: string, v: unknown) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    setErr("");
    const url = channel ? `/api/channels/${channel.id}` : "/api/channels";
    const r = await fetch(url, {
      method: channel ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    if (r.ok) onSaved();
    else setErr((await r.json()).error ?? "保存失败");
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
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(form.crawl_enabled)}
              onChange={(e) => set("crawl_enabled", e.target.checked)}
            />
            对该链接启用自动抓价
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

- [ ] **Step 2: 手动验证全链路**

Run: `npm run dev`,登录后:新增一条渠道(填分类/渠道名等)→ 保存 → 表格出现;编辑 → 改风险 → 保存 → 徽章颜色变;删除 → 二次确认 → 消失。

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: 新增/编辑渠道弹窗表单"
```

---

## Task 10: 爬虫核心接口与注册表

**Files:**
- Create: `scripts/crawler/types.ts`, `scripts/crawler/registry.ts`

- [ ] **Step 1: 写 `scripts/crawler/types.ts`**

```ts
export interface CrawlResult {
  status: "成功" | "失败";
  price?: string;
  error?: string;
}

// 解析器:输入页面 HTML,返回价格文本或抛错
export type Adapter = (html: string) => string;
```

- [ ] **Step 2: 写 `scripts/crawler/registry.ts`(适配器在 Task 11/12 加,先空映射)**

```ts
import type { Adapter } from "./types";

const adapters: Record<string, Adapter> = {};

export function registerAdapter(domain: string, fn: Adapter) {
  adapters[domain] = fn;
}

// 按 url 的 host 后缀匹配适配器;无则返回 null
export function findAdapter(url: string): Adapter | null {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return null;
  }
  for (const domain of Object.keys(adapters)) {
    if (host === domain || host.endsWith("." + domain)) {
      return adapters[domain];
    }
  }
  return null;
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: 爬虫适配器接口与注册表"
```

---

## Task 11: 适配器 — pay.ldxp.cn(TDD)

**Files:**
- Create: `scripts/crawler/adapters/ldxp.ts`
- Test: `scripts/__tests__/ldxp.test.ts`, `scripts/__tests__/fixtures/ldxp.html`

- [ ] **Step 1: 抓真实页面存为 fixture**

Run:
```bash
curl -sL "https://pay.ldxp.cn/shop/GPT" -o scripts/__tests__/fixtures/ldxp.html
head -c 400 scripts/__tests__/fixtures/ldxp.html
```
查看返回的 HTML,定位价格所在元素(异次元发卡类页面价格通常在 class 含 `price`/`money` 的元素或商品卡片内)。若 curl 被墙/被封返回非商品页,改用浏览器另存该页 HTML 放到该路径。**Step 3 的选择器需按 fixture 实际结构确定。**

- [ ] **Step 2: 写失败测试 `scripts/__tests__/ldxp.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { ldxpAdapter } from "../../scripts/crawler/adapters/ldxp";

const html = readFileSync(join(__dirname, "fixtures/ldxp.html"), "utf8");

describe("ldxpAdapter", () => {
  it("extracts a price string containing a number", () => {
    const price = ldxpAdapter(html);
    expect(price).toMatch(/\d/);
  });

  it("throws on unrelated html", () => {
    expect(() => ldxpAdapter("<html><body>nope</body></html>")).toThrow();
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run scripts/__tests__/ldxp.test.ts`
Expected: FAIL,找不到 `ldxpAdapter`

- [ ] **Step 4: 写 `scripts/crawler/adapters/ldxp.ts`**

按 Step 1 fixture 的真实结构确定选择器。以异次元发卡常见结构(价格在 `.shop-goods .price` 或含"¥"的文本)为基础实现:
```ts
import * as cheerio from "cheerio";
import { registerAdapter } from "../registry";

export function ldxpAdapter(html: string): string {
  const $ = cheerio.load(html);
  // 优先取明确的价格元素;退化为页面中第一个 ¥ 数字
  const el = $('[class*="price"], [class*="money"]').first();
  let text = el.text().trim();
  if (!text) {
    const m = html.match(/[¥￥]\s?\d+(\.\d+)?/);
    if (m) text = m[0];
  }
  const clean = text.replace(/\s+/g, " ").trim();
  if (!/\d/.test(clean)) throw new Error("price not found");
  return clean;
}

registerAdapter("ldxp.cn", ldxpAdapter);
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run scripts/__tests__/ldxp.test.ts`
Expected: PASS。若 PASS 失败因选择器不匹配,依据 fixture 实际 HTML 调整 Step 4 选择器后重跑,直到通过。

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: ldxp.cn 价格适配器(TDD)"
```

---

## Task 12: 适配器 — redeemgpt.com(TDD)

**Files:**
- Create: `scripts/crawler/adapters/redeemgpt.ts`
- Test: `scripts/__tests__/redeemgpt.test.ts`, `scripts/__tests__/fixtures/redeemgpt.html`

- [ ] **Step 1: 抓真实页面存为 fixture**

Run:
```bash
curl -sL "https://redeemgpt.com" -o scripts/__tests__/fixtures/redeemgpt.html
head -c 400 scripts/__tests__/fixtures/redeemgpt.html
```
定位价格元素;若被墙改用浏览器另存。**Step 3 选择器按 fixture 实际结构定。**

- [ ] **Step 2: 写失败测试 `scripts/__tests__/redeemgpt.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { redeemgptAdapter } from "../../scripts/crawler/adapters/redeemgpt";

const html = readFileSync(join(__dirname, "fixtures/redeemgpt.html"), "utf8");

describe("redeemgptAdapter", () => {
  it("extracts a price string containing a number", () => {
    expect(redeemgptAdapter(html)).toMatch(/\d/);
  });
  it("throws on unrelated html", () => {
    expect(() => redeemgptAdapter("<html>nope</html>")).toThrow();
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run scripts/__tests__/redeemgpt.test.ts`
Expected: FAIL,找不到 `redeemgptAdapter`

- [ ] **Step 4: 写 `scripts/crawler/adapters/redeemgpt.ts`**

```ts
import * as cheerio from "cheerio";
import { registerAdapter } from "../registry";

export function redeemgptAdapter(html: string): string {
  const $ = cheerio.load(html);
  const el = $('[class*="price"], [class*="money"], [class*="amount"]').first();
  let text = el.text().trim();
  if (!text) {
    const m = html.match(/[¥￥]\s?\d+(\.\d+)?/);
    if (m) text = m[0];
  }
  const clean = text.replace(/\s+/g, " ").trim();
  if (!/\d/.test(clean)) throw new Error("price not found");
  return clean;
}

registerAdapter("redeemgpt.com", redeemgptAdapter);
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run scripts/__tests__/redeemgpt.test.ts`
Expected: PASS(选择器不匹配则依 fixture 调整后重跑直至通过)

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: redeemgpt.com 价格适配器(TDD)"
```

---

## Task 13: 爬虫主流程

**Files:**
- Create: `scripts/crawler/run.ts`

- [ ] **Step 1: 写 `scripts/crawler/run.ts`**

```ts
import { supabaseAdmin } from "../../src/lib/supabase";
import { findAdapter } from "./registry";
// 注册副作用:导入即把适配器注册进 registry
import "./adapters/ldxp";
import "./adapters/redeemgpt";

async function fetchHtml(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "user-agent": "Mozilla/5.0 (procurement-bot)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("channels")
    .select("id,url")
    .eq("crawl_enabled", true);
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const url: string | null = row.url;
    if (!url) continue;
    const adapter = findAdapter(url);
    if (!adapter) {
      await db
        .from("channels")
        .update({ crawl_status: "不支持", crawl_at: new Date().toISOString() })
        .eq("id", row.id);
      console.log(`[skip] ${url} 无适配器`);
      continue;
    }
    try {
      const html = await fetchHtml(url);
      const price = adapter(html);
      await db
        .from("channels")
        .update({
          crawl_price: price,
          crawl_status: "成功",
          crawl_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      console.log(`[ok] ${url} -> ${price}`);
    } catch (e) {
      await db
        .from("channels")
        .update({
          crawl_status: "失败",
          crawl_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      console.log(`[fail] ${url} -> ${String(e)}`);
    }
  }
  console.log("crawl done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: 验证脚本可解析(不连库的语法/类型检查)**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: 真实联调(需 `.env` 已配好真实 Supabase + 库里有一条 crawl_enabled 且 url 为 ldxp/redeemgpt 的记录)**

Run: `npm run crawl`
Expected: 控制台打印 `[ok]`/`[fail]`/`[skip]`,最后 `crawl done`;Supabase 对应行 `crawl_*` 字段被写入。若 Supabase 未配置则跳过此步,留待 Task 15 部署后验证。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: 爬虫主流程(读库->抓->写回,失败容忍)"
```

---

## Task 14: GitHub Actions 定时抓价

**Files:**
- Create: `.github/workflows/crawl.yml`

- [ ] **Step 1: 写 `.github/workflows/crawl.yml`**

```yaml
name: crawl-prices
on:
  schedule:
    - cron: "0 */6 * * *" # 每 6 小时
  workflow_dispatch: {}
jobs:
  crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run crawl
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          APP_PASSWORD: ${{ secrets.APP_PASSWORD }}
          SESSION_SECRET: ${{ secrets.SESSION_SECRET }}
```

- [ ] **Step 2: 在部署文档记录所需 Secrets**

把以下追加进 `docs/DEPLOY.md`:
```markdown
## GitHub
1. 仓库设为 Private,推送代码
2. Settings → Secrets and variables → Actions,新增:
   - `SUPABASE_URL`、`SUPABASE_SERVICE_KEY`、`APP_PASSWORD`、`SESSION_SECRET`
3. Actions 页可手动 "Run workflow" 验证抓价;之后每 6 小时自动跑
4. 注意:Actions 海外 IP 可能被部分国内发卡网屏蔽,失败行会标"失败",属预期
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "ci: GitHub Actions 定时抓价"
```

---

## Task 15: 部署收尾与 README

**Files:**
- Create: `README.md`
- Modify: `docs/DEPLOY.md`(补 Vercel 部分)

- [ ] **Step 1: 补 `docs/DEPLOY.md` 的 Vercel 部分**

```markdown
## Vercel
1. vercel.com 用 GitHub 登录,Import 该私有仓库
2. Environment Variables 配置:`SUPABASE_URL`、`SUPABASE_SERVICE_KEY`、`APP_PASSWORD`、`SESSION_SECRET`
3. Deploy。打开分配的域名 → 应跳登录页 → 输入 APP_PASSWORD 进入
4. 仅把域名 + 口令告诉合伙人;不对外公开
```

- [ ] **Step 2: 写 `README.md`**

```markdown
# 上游采购渠道工具(内部私用)

本人 + 合伙人内部使用。渠道增删改查 + 部分发卡网价格定时抓取。

## 本地开发
```bash
npm install
cp .env.example .env   # 填好 Supabase / APP_PASSWORD / SESSION_SECRET
npm run dev
```

## 测试
```bash
npm test
```

## 抓价(本地手动跑一次)
```bash
npm run crawl
```

## 部署
见 `docs/DEPLOY.md`(Supabase + Vercel + GitHub Actions)。

## 重要说明
- 手动维护是可靠地基;自动抓价仅对公开发卡网尽力而为(Telegram/需登录后台不抓)。
- 抓取失败会在表格标记,不覆盖手填价。
```

- [ ] **Step 3: 全量测试 + 构建**

Run: `npm test && npm run build`
Expected: 所有测试 PASS,构建成功

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: README 与完整部署文档"
```

---

## Self-Review(已执行)

- **Spec 覆盖:** §3 架构→Task 1/14/15;§4 数据模型→Task 3/6;§5 功能页面→Task 7/8/9;§6 鉴权安全→Task 2/4/5;§7 爬虫→Task 10–14;§8 范围(MVP 单计划)→全计划即 MVP;§9 风险(失败容忍/抓不到不覆盖手填)→Task 13。无遗漏。
- **占位扫描:** 无 TBD/TODO;选择器依赖真实 fixture 处已显式说明"按 fixture 实际结构确定"并给出可运行的退化实现(正则兜底),非占位。
- **类型一致:** `Channel`/`ChannelInput`/`Risk`/`Status`(Task 6)在 Task 7/8/9 一致引用;`Adapter`/`CrawlResult`(Task 10)在 Task 11/12/13 一致;`registerAdapter`/`findAdapter` 命名前后一致;`SESSION_COOKIE`/`signSession`/`verifySession`/`checkPassword`(Task 4)在 Task 5 一致引用。

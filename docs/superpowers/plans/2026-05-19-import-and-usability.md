# 上游采购工具 CSV 导入 + 实用性增量 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在已收窄范围内补齐"复刻飞书手册"最后一块拼图——CSV 批量导入(与已有导出对称、可 export→编辑→import 往返),并做 3 项小而真的实用性增强(表格列排序、弹窗 Esc 关闭+必填校验、列表加载态)。

**Architecture:** 现有 Vite + React 19 + TS(strict) + Tailwind + Supabase 单页应用,纯手动 CRUD。导入是用户提供文件/文本的手动批量录入(**非爬虫、非自动抓取**),复用现有 `channels` 表与 `sanitizeChannelInput`,无 schema 变更、无后端、无部署。4 个轨道文件互不重叠,各自 worktree 并行,合并序 A→B→C→D(B 依赖 A 的 csv.ts/channels.ts 契约,故 A 先并)。

**Tech Stack:** Vite, React 19, TypeScript(strict), Tailwind, @supabase/supabase-js, Vitest, ESLint。

**范围红线(不可触碰):** 不加爬虫/自动抓价;不加订单/支付/库存;不做对外/代理/客户页面;不引入后端服务;不动 Supabase Auth/RLS 模型;不改 `supabase/schema.sql`;不 push/部署。

---

## File Structure(改动边界,4 轨道文件集两两不相交)

| 轨道 | 拥有文件(独占) | 职责 |
|---|---|---|
| A 导入逻辑 | `src/lib/csv.ts`(新), `src/lib/channels.ts`, `src/__tests__/csv.test.ts`(新), `src/__tests__/channels.test.ts` | 纯函数 CSV 解析+逐行校验(TDD)+ 批量插入数据访问 |
| B 导入 UI | `src/components/ImportDialog.tsx`(新), `src/components/Dashboard.tsx` | 导入弹窗(粘贴/选文件→预览校验→提交)+ 列表加载态 |
| C 表格排序 | `src/components/ChannelTable.tsx` | 列头点击排序(组内排序,保留按分类分组) |
| D 弹窗 UX | `src/components/ChannelForm.tsx` | Esc 关闭 + 首字段聚焦 + 创建态必填行内提示 |

**契约(A 提供,B 依赖,写死在本计划以便并行):**
- `src/lib/channels.ts` 新增 `export type SanitizedChannel = ReturnType<typeof sanitizeChannelInput>;` 与 `export async function createChannelsBulk(rows: SanitizedChannel[]): Promise<void>`。
- `src/lib/csv.ts` 导出 `export interface ImportResult { ok: SanitizedChannel[]; errors: { line: number; message: string }[] }` 与 `export function parseChannelsCsv(text: string): ImportResult`。

---

## Task A: CSV 解析 + 校验(纯函数 TDD)+ 批量插入

**Files:**
- Create: `src/lib/csv.ts`
- Modify: `src/lib/channels.ts`
- Create test: `src/__tests__/csv.test.ts`
- Modify test: `src/__tests__/channels.test.ts`

参考当前 `src/lib/channels.ts` 已有:`sanitizeChannelInput(input)`(校验 渠道名/分类 必填、risk∈{低,中,高}、status∈{在售,空仓,停售},trim,空串转 null,返回规范对象);`ChannelInput` 类型;`supabase` 来自 "./supabase"。

- [ ] **Step 1: 在 `src/lib/channels.ts` 末尾追加类型与批量插入**

```ts
export type SanitizedChannel = ReturnType<typeof sanitizeChannelInput>;

export async function createChannelsBulk(
  rows: SanitizedChannel[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("channels").insert(rows);
  if (error) throw new Error(error.message);
}
```

- [ ] **Step 2: 写失败测试 `src/__tests__/csv.test.ts`**

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parseChannelsCsv } from "../lib/csv";

const HEADER = "分类,渠道名,产品,链接,价格,质保,风险,状态,联系方式,卡密格式,兑换地址,备注";

describe("parseChannelsCsv", () => {
  it("解析合法行,返回规范化 ok", () => {
    const r = parseChannelsCsv(
      HEADER + "\nGPT,渠道甲,Plus,https://x.com,100,7天,低,在售,@tg,卡密,兑换,备注1",
    );
    expect(r.errors).toHaveLength(0);
    expect(r.ok).toHaveLength(1);
    expect(r.ok[0]).toMatchObject({
      category: "GPT",
      name: "渠道甲",
      product: "Plus",
      url: "https://x.com",
      manual_price: "100",
      risk: "低",
      status: "在售",
      contact: "@tg",
    });
  });

  it("列顺序可乱、未知列忽略", () => {
    const r = parseChannelsCsv("渠道名,分类,垃圾列\n甲,GPT,xxx");
    expect(r.errors).toHaveLength(0);
    expect(r.ok[0]).toMatchObject({ name: "甲", category: "GPT" });
  });

  it("缺渠道名/分类列 → 整文件错误", () => {
    const r = parseChannelsCsv("产品,价格\nPlus,100");
    expect(r.ok).toHaveLength(0);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors[0].message).toMatch(/分类|渠道名/);
  });

  it("逐行校验:第 3 行缺分类记错且不进 ok,合法行仍进 ok", () => {
    const r = parseChannelsCsv(
      HEADER +
        "\nGPT,甲,,,,,低,在售,,,,\n,乙,,,,,低,在售,,,,",
    );
    expect(r.ok).toHaveLength(1);
    expect(r.ok[0].name).toBe("甲");
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].line).toBe(3);
  });

  it("非法风险值记错", () => {
    const r = parseChannelsCsv(HEADER + "\nGPT,甲,,,,,爆炸,在售,,,,");
    expect(r.ok).toHaveLength(0);
    expect(r.errors[0].line).toBe(2);
  });

  it("还原导出的防注入前缀(' @x → @x),处理引号/CRLF/BOM/空行", () => {
    const text =
      "﻿" +
      HEADER +
      '\r\nGPT,"甲,乙",,,,,低,在售,\'@tg,,,"含""引号"\r\n\r\n';
    const r = parseChannelsCsv(text);
    expect(r.errors).toHaveLength(0);
    expect(r.ok).toHaveLength(1);
    expect(r.ok[0].name).toBe("甲,乙");
    expect(r.ok[0].contact).toBe("@tg");
    expect(r.ok[0].note).toBe('含"引号');
  });

  it("空文本 → 空结果且报错", () => {
    const r = parseChannelsCsv("");
    expect(r.ok).toHaveLength(0);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: 运行确认失败**

Run: `npm test`
Expected: FAIL —— 找不到 `../lib/csv`。

- [ ] **Step 4: 写 `src/lib/csv.ts`**

```ts
import { sanitizeChannelInput, type SanitizedChannel } from "./channels";

export interface ImportResult {
  ok: SanitizedChannel[];
  errors: { line: number; message: string }[];
}

// 表头中文 → Channel 字段名
const HEADER_MAP: Record<string, string> = {
  分类: "category",
  渠道名: "name",
  产品: "product",
  链接: "url",
  价格: "manual_price",
  质保: "warranty",
  风险: "risk",
  状态: "status",
  联系方式: "contact",
  卡密格式: "card_format",
  兑换地址: "redeem_url",
  备注: "note",
};

// RFC4180 解析:支持引号、转义双引号、字段内逗号/换行、CRLF、BOM。
// 返回行数组(每行是字段字符串数组),自动跳过完全空行。
function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
  };
  while (i < t.length) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      pushField();
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      pushRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}

// 去掉导出时为防表格软件公式注入加的前导单引号
function unescapeInjectionGuard(s: string): string {
  return s.startsWith("'") && /^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s;
}

export function parseChannelsCsv(text: string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { ok: [], errors: [{ line: 0, message: "内容为空,没有可导入的行" }] };
  }
  const header = rows[0].map((h) => h.trim());
  const keys = header.map((h) => HEADER_MAP[h] ?? null);
  if (!keys.includes("name") || !keys.includes("category")) {
    return {
      ok: [],
      errors: [{ line: 1, message: "表头必须至少包含「分类」和「渠道名」两列" }],
    };
  }
  const ok: SanitizedChannel[] = [];
  const errors: { line: number; message: string }[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const raw: Record<string, string> = {};
    keys.forEach((k, idx) => {
      if (k) raw[k] = unescapeInjectionGuard((cells[idx] ?? "").trim());
    });
    try {
      ok.push(sanitizeChannelInput(raw));
    } catch (e) {
      errors.push({
        line: r + 1,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return { ok, errors };
}
```

- [ ] **Step 5: 在 `src/__tests__/channels.test.ts` 末尾追加 `createChannelsBulk`/类型导出存在性测试**

(该文件顶部已 `import { ... } from "../lib/channels"`;新增一段,用动态属性断言避免引入 supabase 运行时)

```ts
import * as channelsMod from "../lib/channels";

describe("createChannelsBulk 导出契约", () => {
  it("导出 createChannelsBulk 函数", () => {
    expect(typeof channelsMod.createChannelsBulk).toBe("function");
  });
});
```

- [ ] **Step 6: 运行确认全绿 + 类型检查**

Run: `npm test`
Expected: PASS（原 11 + csv.test.ts 7 + channels 契约 1）。
Run: `npx tsc --noEmit`
Expected: 干净。

- [ ] **Step 7: Commit(仅本 worktree)**

```bash
git add src/lib/csv.ts src/lib/channels.ts src/__tests__/csv.test.ts src/__tests__/channels.test.ts
git commit -m "feat: CSV 解析+逐行校验纯函数 + createChannelsBulk(TDD)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 8:** 自审 diff(范围:仅这 4 文件;csv.ts 无 supabase 依赖、纯函数;往返还原前缀正确)。报告 DONE/DONE_WITH_CONCERNS/BLOCKED + 测试计数 + tsc + commit SHA。

---

## Task B: 导入弹窗 + 列表加载态

**Files:**
- Create: `src/components/ImportDialog.tsx`
- Modify: `src/components/Dashboard.tsx`

依赖 Task A 契约:`parseChannelsCsv(text): { ok, errors }`(来自 `../lib/csv`)、`createChannelsBulk(rows)`(来自 `../lib/channels`)。

- [ ] **Step 1: 写 `src/components/ImportDialog.tsx`**

```tsx
import { useState } from "react";
import { parseChannelsCsv } from "../lib/csv";
import { createChannelsBulk } from "../lib/channels";

export default function ImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const result = text.trim() ? parseChannelsCsv(text) : null;

  async function readFile(f: File | undefined) {
    if (!f) return;
    setText(await f.text());
  }

  async function doImport() {
    if (busy || !result || result.ok.length === 0) return;
    setErr("");
    setBusy(true);
    try {
      await createChannelsBulk(result.ok);
      onImported();
    } catch (e) {
      setErr(String(e));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6">
        <h2 className="mb-1 text-lg font-semibold">导入 CSV</h2>
        <p className="mb-3 text-xs text-gray-500">
          表头需含「分类」「渠道名」(其余列可选、顺序不限)。可直接粘贴,或选择导出的 CSV 文件;支持先导出→编辑→再导入。
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => readFile(e.target.files?.[0])}
          className="mb-2 block text-sm"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="在此粘贴 CSV 文本…"
          rows={8}
          className="w-full rounded border px-2 py-1 font-mono text-xs"
        />

        {result && (
          <div className="mt-3 text-sm">
            <p className="text-gray-700">
              可导入 <b className="text-green-700">{result.ok.length}</b> 行,
              有误 <b className="text-red-600">{result.errors.length}</b> 行
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-40 overflow-y-auto rounded border bg-red-50 p-2 text-xs text-red-700">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    第 {e.line} 行:{e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded border px-4 py-1.5 text-sm disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={doImport}
            disabled={busy || !result || result.ok.length === 0}
            className="rounded bg-gray-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {busy ? "导入中…" : `导入 ${result?.ok.length ?? 0} 行`}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 修改 `src/components/Dashboard.tsx` 接入导入 + 加载态**

精确改动(基于当前文件,逐处加,不要动其它逻辑):

(a) import 区在 `import ChannelForm from "./ChannelForm";` 下一行加:
```tsx
import ImportDialog from "./ImportDialog";
```

(b) 状态区在 `const [creating, setCreating] = useState(false);` 下一行加:
```tsx
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);
```

(c) 把 `refresh` 函数替换为:
```tsx
  async function refresh() {
    setLoading(true);
    try {
      setRows(await listChannels());
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }
```

(d) 在「导出 CSV」按钮的 `</button>` 之后、`<button onClick={async () => { await supabase.auth.signOut(); }}` 之前,插入导入按钮:
```tsx
        <button
          onClick={() => setImporting(true)}
          className="rounded border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          导入 CSV
        </button>
```

(e) 把 `<ChannelTable rows={filtered} onEdit={setEditing} onDelete={remove} />` 这一行替换为:
```tsx
      {loading ? (
        <p className="rounded-lg border bg-white p-10 text-center text-sm text-gray-500">
          加载中…
        </p>
      ) : (
        <ChannelTable rows={filtered} onEdit={setEditing} onDelete={remove} />
      )}
```

(f) 在 ChannelForm 的 `{(creating || editing) && ( ... )}` 块之后插入:
```tsx
      {importing && (
        <ImportDialog
          onClose={() => setImporting(false)}
          onImported={() => { setImporting(false); refresh(); }}
        />
      )}
```

- [ ] **Step 3: 类型检查 + 构建**

Run: `npx tsc --noEmit && npm run build`
Expected: 通过。

- [ ] **Step 4: Commit(仅本 worktree)**

```bash
git add src/components/ImportDialog.tsx src/components/Dashboard.tsx
git commit -m "feat: CSV 导入弹窗(粘贴/选文件→预览校验→批量入库)+ 列表加载态

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 5:** 自审(仅这 2 文件;不改筛选/导出/删除既有逻辑;弹窗与 ChannelForm 风格一致)。报告状态 + tsc + build + commit SHA。

---

## Task C: 表格列头排序(保留按分类分组)

**Files:**
- Modify: `src/components/ChannelTable.tsx`

当前 `ChannelTable.tsx`:props `{ rows, onEdit, onDelete }`;`COLS = ["渠道","产品","链接","价格","质保","风险","状态","联系方式","备注","操作"]`;用 `useMemo` 把 rows 按 `r.category`(空→"(未分类)")分组为 `groups: [string, Channel[]][]`;空 rows 显示"暂无匹配的渠道";`GroupRows` 子组件渲染组头(`{cat} · {list.length} 条`)+ 行。

- [ ] **Step 1: 先读 `src/components/ChannelTable.tsx` 全文**,然后做如下精确改造(保持分组、空态、props、样式不变):

1. 顶部 `import { useMemo } from "react";` 改为 `import { useMemo, useState } from "react";`
2. 定义可排序列到 Channel 字段的映射(放在 `RISK_COLOR` 之后):
```tsx
const SORT_KEYS: Record<string, "name" | "product" | "manual_price" | "warranty" | "risk" | "status" | "contact"> = {
  渠道: "name",
  产品: "product",
  价格: "manual_price",
  质保: "warranty",
  风险: "risk",
  状态: "status",
  联系方式: "contact",
};
const RISK_ORDER: Record<string, number> = { 低: 0, 中: 1, 高: 2 };
```
3. 组件内加排序状态:
```tsx
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  function toggleSort(col: string) {
    const k = SORT_KEYS[col];
    if (!k) return;
    if (sortKey === k) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setSortDir(1);
    }
  }
```
4. 在现有 `groups` 的 `useMemo` 之后新增组内排序(不改分组逻辑,只对每组 list 排序):
```tsx
  const sortedGroups = useMemo(() => {
    if (!sortKey) return groups;
    const cmp = (a: Channel, b: Channel) => {
      let av: string | number;
      let bv: string | number;
      if (sortKey === "risk") {
        av = RISK_ORDER[a.risk] ?? 99;
        bv = RISK_ORDER[b.risk] ?? 99;
      } else if (sortKey === "manual_price") {
        const pa = parseFloat(String(a.manual_price ?? ""));
        const pb = parseFloat(String(b.manual_price ?? ""));
        av = isNaN(pa) ? Number.POSITIVE_INFINITY : pa;
        bv = isNaN(pb) ? Number.POSITIVE_INFINITY : pb;
      } else {
        av = String((a as unknown as Record<string, unknown>)[sortKey] ?? "");
        bv = String((b as unknown as Record<string, unknown>)[sortKey] ?? "");
      }
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return 0;
    };
    return groups.map(
      ([cat, list]) => [cat, [...list].sort(cmp)] as [string, Channel[]],
    );
  }, [groups, sortKey, sortDir]);
```
5. 表头 `<th>` 渲染改为可点击(仅对 `SORT_KEYS` 内的列加指针/箭头),并把渲染 `groups.map(...)` 改为 `sortedGroups.map(...)`:
```tsx
            {COLS.map((h) => {
              const sortable = h in SORT_KEYS;
              const active = sortable && SORT_KEYS[h] === sortKey;
              return (
                <th
                  key={h}
                  onClick={() => toggleSort(h)}
                  className={`whitespace-nowrap px-3 py-2 ${sortable ? "cursor-pointer select-none hover:bg-gray-200" : ""}`}
                >
                  {h}
                  {active ? (sortDir === 1 ? " ▲" : " ▼") : ""}
                </th>
              );
            })}
```
保留 `if (rows.length === 0)` 空态分支与 `GroupRows` 子组件不变(只是把 `groups.map` 换成 `sortedGroups.map`)。

- [ ] **Step 2: 类型检查 + 构建**

Run: `npx tsc --noEmit && npm run build`
Expected: 通过。

- [ ] **Step 3: Commit(仅本 worktree)**

```bash
git add src/components/ChannelTable.tsx
git commit -m "feat: 表格列头点击排序(组内排序,保留分类分组)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 4:** 自审(仅此 1 文件;分组/空态/props/样式未变;价格按数值、风险按低中高排序)。报告状态 + tsc + build + commit SHA。

---

## Task D: 弹窗 Esc 关闭 + 首字段聚焦 + 创建态必填行内提示

**Files:**
- Modify: `src/components/ChannelForm.tsx`

当前 `ChannelForm.tsx`:`import { useState } from "react";`;props `{ channel, onClose, onSaved }`;create 模式有 `BASE_FIELDS`(name/url/contact/card_format/redeem_url/note)+ 产品行 `lines`(每行 category/product/manual_price/warranty/risk/status),`emptyLine()`,`addLine/removeLine/setLine/fillCategory`;edit 模式 `EDIT_FIELDS` 含 category;`save()` 已有 `if (saving) return` 防重复;catch 里 `setErr(String(e))`。`sanitizeChannelInput` 会对缺 渠道名/分类 抛错并以 `err` 文本展示。

- [ ] **Step 1: 先读 `src/components/ChannelForm.tsx` 全文**,然后做如下精确改动:

1. 顶部 import 改为:
```tsx
import { useEffect, useState } from "react";
```
2. 在 `const [saving, setSaving] = useState(false);` 之后加 Esc 关闭副作用(放在 `save` 函数定义之前的组件体内):
```tsx
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, onClose]);
```
3. 首字段聚焦:给"渲染的第一个输入框"加 `autoFocus`。
   - edit 模式:`EDIT_FIELDS.map((f) => ...)` 的 `<input>` 增加 `autoFocus={f.key === "category"}`。
   - create 模式:`BASE_FIELDS.map((f) => ...)` 的 `<input>` 增加 `autoFocus={f.key === "name"}`。
   仅新增该属性,其它属性/结构不变。
4. 创建态必填行内提示:在 create 模式产品行内"分类"输入框所在 `<label>` 内,`<input>` 之后追加(当该行 category 为空时显示红字),并给该 input 在空时加红框:
   - 该行分类 input 的 `className` 改为:
```tsx
className={`w-full rounded border px-2 py-1 ${(ln.category ?? "").trim() === "" ? "border-red-400" : ""}`}
```
   - 紧随该 input 之后(仍在同一 `<label>` 内)加:
```tsx
                        {(ln.category ?? "").trim() === "" && (
                          <span className="mt-1 block text-xs text-red-500">分类必填</span>
                        )}
```
   同理给 create 模式 `BASE_FIELDS` 中"渠道名"那个输入(`f.key === "name"`)做必填提示:其 input className 改为:
```tsx
className={`w-full rounded border px-2 py-1 ${f.key === "name" && ((form[f.key] as string) ?? "").trim() === "" ? "border-red-400" : ""}`}
```
   并在该 `<label>` 内 input 之后加:
```tsx
                  {f.key === "name" && ((form[f.key] as string) ?? "").trim() === "" && (
                    <span className="mt-1 block text-xs text-red-500">渠道名必填</span>
                  )}
```
   (edit 模式不加行内提示,维持原 `err` 文本行为即可。)
5. 不改 `save()` 逻辑、不改提交/关闭语义。仅做以上 UX 增强。

- [ ] **Step 2: 类型检查 + 构建**

Run: `npx tsc --noEmit && npm run build`
Expected: 通过。

- [ ] **Step 3: Commit(仅本 worktree)**

```bash
git add src/components/ChannelForm.tsx
git commit -m "feat: 弹窗 Esc 关闭 + 首字段聚焦 + 创建态必填行内提示

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 4:** 自审(仅此 1 文件;Esc 在 saving 时不关闭并正确解绑监听;必填提示不误伤 edit 模式;保存语义不变)。报告状态 + tsc + build + commit SHA。

---

## Self-Review

- **范围合规:** CSV 导入是用户提供文件/文本的手动批量录入,直接服务"复刻飞书手册",**非爬虫**;无订单/支付/库存;无对外页面;无后端;未动 Auth/RLS/schema;不 push。其余三轨道为纯前端 UX 增强。符合 v2 红线。
- **价值判断:** 导入是已有导出的对称缺口(支持 export→编辑→import 往返),对 2 人迁移既有手册价值最高;排序/Esc/加载态为低成本真实可用性提升,非镀金。未纳入组件测试扩展以避免与并行改动耦合脆弱,留作后续增量。
- **占位扫描:** 无 TBD/TODO;A 给出完整可运行代码与 7 条 TDD 用例;B/C/D 给出精确增量改动(C/D 要求先读文件再按列出的逐处修改执行,与上轮成功模式一致)。
- **类型一致:** `SanitizedChannel = ReturnType<typeof sanitizeChannelInput>` 在 channels.ts 定义,csv.ts 与 createChannelsBulk 共用;`ImportResult{ok,errors}` 契约 A 实现、B 消费一致;`parseChannelsCsv`/`createChannelsBulk` 命名前后一致;Dashboard 对 ChannelTable/ChannelForm props 签名未变(C/D 不改 props),故 B 改 Dashboard 与 C/D 互不影响。
- **并行安全:** A=csv.ts+channels.ts+2 测试文件;B=ImportDialog.tsx(新)+Dashboard.tsx;C=ChannelTable.tsx;D=ChannelForm.tsx —— 文件集两两不相交。合并序 A→B→C→D(B 依赖 A 的契约),每次合并后跑 `npm run verify`+`npm run build` 把关;集成后另跑一次全量并防 .worktrees 污染(配置已在上一轮加排除)。

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
  let s = v == null ? "" : String(v);
  // Neutralize spreadsheet formula injection: contact fields here are often
  // "@tg_handle" / "=...". Prefix risky leading chars with ' so Excel/Sheets
  // treat the cell as text, not a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
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

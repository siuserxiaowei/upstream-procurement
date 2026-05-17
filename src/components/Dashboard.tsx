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
    () => ["全部", ...Array.from(new Set(rows.map((r) => r.category)))],
    [rows],
  );
  const filtered = filterChannels(rows, { category, risk, kw, status });

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
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border px-2 py-1 text-sm">
          {["全部", "在售", "空仓", "停售"].map((c) => <option key={c}>{c}</option>)}
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

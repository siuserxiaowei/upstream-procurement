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
    channel ? { ...channel } : { risk: "低", status: "在售" },
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

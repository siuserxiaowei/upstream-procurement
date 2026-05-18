import { useState } from "react";
import {
  createChannelBatch,
  updateChannel,
  type Channel,
  type ProductLine,
} from "../lib/channels";

// Channel-level fields (shared across all product rows on create)
const BASE_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "渠道名" },
  { key: "url", label: "链接" },
  { key: "contact", label: "联系方式" },
  { key: "card_format", label: "卡密格式" },
  { key: "redeem_url", label: "兑换地址" },
  { key: "note", label: "备注" },
];

// All fields including product for edit mode
const EDIT_FIELDS: { key: keyof Channel; label: string }[] = [
  { key: "category", label: "分类" },
  { key: "name", label: "渠道名" },
  { key: "product", label: "产品" },
  { key: "url", label: "链接" },
  { key: "manual_price", label: "价格" },
  { key: "warranty", label: "质保" },
  { key: "contact", label: "联系方式" },
  { key: "card_format", label: "卡密格式" },
  { key: "redeem_url", label: "兑换地址" },
  { key: "note", label: "备注" },
];

const emptyLine = (): ProductLine => ({
  category: "",
  product: "",
  manual_price: "",
  warranty: "",
  risk: "低",
  status: "在售",
});

export default function ChannelForm({
  channel,
  onClose,
  onSaved,
}: {
  channel: Channel | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Edit mode: single flat form
  const [form, setForm] = useState<Record<string, unknown>>(
    channel ? { ...channel } : { risk: "低", status: "在售" },
  );
  // Create mode: product lines
  const [lines, setLines] = useState<ProductLine[]>([emptyLine()]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  function set(k: string, v: unknown) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setLine(idx: number, k: keyof ProductLine, v: unknown) {
    setLines((prev) =>
      prev.map((ln, i) => (i === idx ? { ...ln, [k]: v } : ln)),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function fillCategory(idx: number) {
    const cat = lines[idx]?.category ?? "";
    setLines((prev) => prev.map((ln) => ({ ...ln, category: cat })));
  }

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

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6">
        <datalist id="cat-presets">
          {["GPT", "Claude", "Google", "Grok", "Suno", "其他"].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <h2 className="mb-4 text-lg font-semibold">
          {channel ? "编辑渠道" : "新增渠道(可多产品)"}
        </h2>

        {channel ? (
          /* ── Edit mode: single-row form with all fields ── */
          <div className="grid grid-cols-2 gap-3">
            {EDIT_FIELDS.map((f) => (
              <label key={f.key} className="text-sm">
                <span className="mb-1 block text-gray-600">{f.label}</span>
                <input
                  value={(form[f.key] as string) ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  list={f.key === "category" ? "cat-presets" : undefined}
                  className="w-full rounded border px-2 py-1"
                />
              </label>
            ))}
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">风险</span>
              <select
                value={(form.risk as string) ?? "低"}
                onChange={(e) => set("risk", e.target.value)}
                className="w-full rounded border px-2 py-1"
              >
                {["低", "中", "高"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-600">状态</span>
              <select
                value={(form.status as string) ?? "在售"}
                onChange={(e) => set("status", e.target.value)}
                className="w-full rounded border px-2 py-1"
              >
                {["在售", "空仓", "停售"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          /* ── Create mode: channel-level fields + product lines ── */
          <>
            <div className="grid grid-cols-2 gap-3">
              {BASE_FIELDS.map((f) => (
                <label key={f.key} className="text-sm">
                  <span className="mb-1 block text-gray-600">{f.label}</span>
                  <input
                    value={(form[f.key] as string) ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="w-full rounded border px-2 py-1"
                  />
                </label>
              ))}
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">产品行</span>
                <button
                  type="button"
                  onClick={addLine}
                  className="rounded border px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >
                  + 添加产品行
                </button>
              </div>

              <div className="space-y-3">
                {lines.map((ln, idx) => (
                  <div
                    key={idx}
                    className="rounded border bg-gray-50 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs text-gray-500">产品行 {idx + 1}</span>
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          删除
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-sm">
                        <span className="mb-1 flex items-center justify-between text-gray-600">
                          <span>分类</span>
                          {lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => fillCategory(idx)}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              应用到所有行
                            </button>
                          )}
                        </span>
                        <input
                          value={ln.category ?? ""}
                          onChange={(e) => setLine(idx, "category", e.target.value)}
                          list="cat-presets"
                          className="w-full rounded border px-2 py-1"
                        />
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block text-gray-600">产品</span>
                        <input
                          value={ln.product ?? ""}
                          onChange={(e) => setLine(idx, "product", e.target.value)}
                          className="w-full rounded border px-2 py-1"
                        />
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block text-gray-600">价格</span>
                        <input
                          value={ln.manual_price ?? ""}
                          onChange={(e) => setLine(idx, "manual_price", e.target.value)}
                          className="w-full rounded border px-2 py-1"
                        />
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block text-gray-600">质保</span>
                        <input
                          value={ln.warranty ?? ""}
                          onChange={(e) => setLine(idx, "warranty", e.target.value)}
                          className="w-full rounded border px-2 py-1"
                        />
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block text-gray-600">风险</span>
                        <select
                          value={ln.risk ?? "低"}
                          onChange={(e) =>
                            setLine(idx, "risk", e.target.value)
                          }
                          className="w-full rounded border px-2 py-1"
                        >
                          {["低", "中", "高"].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block text-gray-600">状态</span>
                        <select
                          value={ln.status ?? "在售"}
                          onChange={(e) =>
                            setLine(idx, "status", e.target.value)
                          }
                          className="w-full rounded border px-2 py-1"
                        >
                          {["在售", "空仓", "停售"].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        <div className="mt-5 flex justify-end gap-3">
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
        </div>
      </div>
    </div>
  );
}

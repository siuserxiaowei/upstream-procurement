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

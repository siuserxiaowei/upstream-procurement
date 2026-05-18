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
  const groups = useMemo(() => {
    const m = new Map<string, Channel[]>();
    for (const r of rows) {
      const k = r.category || "(未分类)";
      const arr = m.get(k);
      if (arr) arr.push(r);
      else m.set(k, [r]);
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

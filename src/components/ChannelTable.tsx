import { useMemo, useState } from "react";
import type { Channel } from "../lib/channels";

const RISK_COLOR: Record<string, string> = {
  低: "bg-green-100 text-green-800",
  中: "bg-yellow-100 text-yellow-800",
  高: "bg-red-100 text-red-800",
};

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
          </tr>
        </thead>
        <tbody>
          {sortedGroups.map(([cat, list]) => (
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

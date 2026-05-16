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
            {["分类", "渠道", "产品", "链接", "价格", "质保", "风险", "状态", "联系方式", "备注", "操作"].map(
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
              <td className="px-3 py-2 font-normal">{r.product ?? "—"}</td>
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

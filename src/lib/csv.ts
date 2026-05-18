import { sanitizeChannelInput, type SanitizedChannel } from "./channels";

export interface ImportResult {
  ok: SanitizedChannel[];
  errors: { line: number; message: string }[];
}

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

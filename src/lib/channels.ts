import { supabase } from "./supabase";

export type Risk = "低" | "中" | "高";
export type Status = "在售" | "空仓" | "停售";

export interface Channel {
  id: string;
  category: string;
  name: string;
  product: string | null;
  url: string | null;
  manual_price: string | null;
  warranty: string | null;
  risk: Risk;
  contact: string | null;
  note: string | null;
  card_format: string | null;
  redeem_url: string | null;
  status: Status;
  created_at: string;
  updated_at: string;
}

// id / created_at / updated_at are DB-assigned and must never be supplied by callers
export type ChannelInput = Omit<Partial<Channel>, "id" | "created_at" | "updated_at">;

const RISKS: Risk[] = ["低", "中", "高"];
const STATUSES: Status[] = ["在售", "空仓", "停售"];

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function sanitizeChannelInput(input: ChannelInput) {
  const name = s(input.name);
  const category = s(input.category);
  if (!name) throw new Error("渠道名必填");
  if (!category) throw new Error("分类必填");
  const risk = (input.risk ?? "低") as Risk;
  if (!RISKS.includes(risk)) throw new Error("风险值非法");
  const status = (input.status ?? "在售") as Status;
  if (!STATUSES.includes(status)) throw new Error("状态值非法");
  return {
    category,
    name,
    product: s(input.product) || null,
    url: s(input.url) || null,
    manual_price: s(input.manual_price) || null,
    warranty: s(input.warranty) || null,
    risk,
    contact: s(input.contact) || null,
    note: s(input.note) || null,
    card_format: s(input.card_format) || null,
    redeem_url: s(input.redeem_url) || null,
    status,
  };
}

export interface Filters {
  category: string;
  risk: string;
  kw: string;
  status: string;
}

// keyword matches channel name OR product (not category/note/contact) — intentional
export function filterChannels(rows: Channel[], f: Filters): Channel[] {
  const kw = f.kw.toLowerCase();
  return rows.filter(
    (r) =>
      (f.category === "全部" || r.category === f.category) &&
      (f.risk === "全部" || r.risk === f.risk) &&
      (kw === "" ||
        r.name.toLowerCase().includes(kw) ||
        (r.product ?? "").toLowerCase().includes(kw)) &&
      (f.status === "全部" || r.status === f.status),
  );
}

export async function listChannels(): Promise<Channel[]> {
  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .order("category")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as Channel[];
}

export async function createChannel(input: ChannelInput): Promise<void> {
  const { error } = await supabase
    .from("channels")
    .insert(sanitizeChannelInput(input));
  if (error) throw new Error(error.message);
}

export async function updateChannel(id: string, input: ChannelInput): Promise<void> {
  const { error } = await supabase
    .from("channels")
    .update(sanitizeChannelInput(input))
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteChannel(id: string): Promise<void> {
  const { error } = await supabase.from("channels").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface ProductLine {
  category?: string;
  product?: string;
  manual_price?: string;
  warranty?: string;
  risk?: Risk;
  status?: Status;
}

export function buildBatchRows(base: ChannelInput, lines: ProductLine[]) {
  return lines.map((ln) =>
    sanitizeChannelInput({
      ...base,
      category: ln.category,
      product: ln.product,
      manual_price: ln.manual_price,
      warranty: ln.warranty,
      risk: ln.risk,
      status: ln.status,
    }),
  );
}

export async function createChannelBatch(
  base: ChannelInput,
  lines: ProductLine[],
): Promise<void> {
  const rows = buildBatchRows(base, lines);
  const { error } = await supabase.from("channels").insert(rows);
  if (error) throw new Error(error.message);
}

export type SanitizedChannel = ReturnType<typeof sanitizeChannelInput>;

export async function createChannelsBulk(
  rows: SanitizedChannel[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("channels").insert(rows);
  if (error) throw new Error(error.message);
}

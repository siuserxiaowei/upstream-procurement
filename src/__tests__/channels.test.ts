// @vitest-environment node
import { describe, it, expect } from "vitest";
import { sanitizeChannelInput, filterChannels, buildBatchRows, type Channel, type Risk } from "../lib/channels";

describe("sanitizeChannelInput", () => {
  it("trims and applies defaults", () => {
    const out = sanitizeChannelInput({ category: " GPT ", name: " jayron " });
    expect(out.category).toBe("GPT");
    expect(out.name).toBe("jayron");
    expect(out.risk).toBe("低");
    expect(out.status).toBe("在售");
  });
  it("rejects empty name", () => {
    expect(() => sanitizeChannelInput({ category: "GPT", name: " " })).toThrow();
  });
  it("rejects empty category", () => {
    expect(() => sanitizeChannelInput({ category: " ", name: "x" })).toThrow();
  });
  it("rejects invalid risk", () => {
    expect(() =>
      sanitizeChannelInput({ category: "GPT", name: "x", risk: "x" as Risk }),
    ).toThrow();
  });
});

const rows = [
  { id: "1", category: "GPT", name: "jayron", risk: "低", status: "在售" },
  { id: "2", category: "Claude", name: "gugu", risk: "高", status: "停售" },
] as Channel[];

describe("filterChannels", () => {
  it("filters by category", () => {
    expect(filterChannels(rows, { category: "GPT", risk: "全部", kw: "", status: "全部" })).toHaveLength(1);
  });
  it("filters by risk", () => {
    expect(filterChannels(rows, { category: "全部", risk: "高", kw: "", status: "全部" })).toHaveLength(1);
  });
  it("filters by keyword (case-insensitive)", () => {
    expect(filterChannels(rows, { category: "全部", risk: "全部", kw: "JAY", status: "全部" })).toHaveLength(1);
  });
  it("filters by status", () => {
    expect(filterChannels(rows, { category: "全部", risk: "全部", kw: "", status: "停售" })).toHaveLength(1);
  });
});

describe("buildBatchRows", () => {
  it("每行用各自分类,产品/价格按行展开", () => {
    const rows = buildBatchRows(
      { name: "jayron", category: "忽略" },
      [
        { category: "GPT", product: "Plus", manual_price: "100" },
        { category: "Claude", product: "Pro" },
      ],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].category).toBe("GPT");
    expect(rows[0].product).toBe("Plus");
    expect(rows[0].manual_price).toBe("100");
    expect(rows[1].category).toBe("Claude");
    expect(rows[1].product).toBe("Pro");
    expect(rows[1].risk).toBe("低");
    expect(rows[1].status).toBe("在售");
  });
  it("行内分类为空时报错(分类必填)", () => {
    expect(() =>
      buildBatchRows({ name: "x" }, [{ product: "p" }]),
    ).toThrow();
  });
});

describe("filterChannels 关键词匹配产品", () => {
  const r2 = [
    { id: "1", category: "GPT", name: "渠道甲", product: "ChatGPT Plus", risk: "低", status: "在售" },
    { id: "2", category: "GPT", name: "渠道乙", product: "Sora", risk: "低", status: "在售" },
  ] as Channel[];
  it("关键词命中产品名也返回", () => {
    expect(
      filterChannels(r2, { category: "全部", risk: "全部", kw: "sora", status: "全部" }),
    ).toHaveLength(1);
  });
});

// @vitest-environment node
import { describe, it, expect } from "vitest";
import { sanitizeChannelInput, filterChannels, type Channel, type Risk } from "../lib/channels";

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
  it("rejects invalid risk", () => {
    expect(() =>
      sanitizeChannelInput({ category: "GPT", name: "x", risk: "x" as Risk }),
    ).toThrow();
  });
});

const rows = [
  { id: "1", category: "GPT", name: "jayron", risk: "低" },
  { id: "2", category: "Claude", name: "gugu", risk: "高" },
] as Channel[];

describe("filterChannels", () => {
  it("filters by category", () => {
    expect(filterChannels(rows, { category: "GPT", risk: "全部", kw: "" })).toHaveLength(1);
  });
  it("filters by risk", () => {
    expect(filterChannels(rows, { category: "全部", risk: "高", kw: "" })).toHaveLength(1);
  });
  it("filters by keyword (case-insensitive)", () => {
    expect(filterChannels(rows, { category: "全部", risk: "全部", kw: "JAY" })).toHaveLength(1);
  });
});

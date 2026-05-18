// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parseChannelsCsv } from "../lib/csv";

const HEADER = "分类,渠道名,产品,链接,价格,质保,风险,状态,联系方式,卡密格式,兑换地址,备注";

describe("parseChannelsCsv", () => {
  it("解析合法行,返回规范化 ok", () => {
    const r = parseChannelsCsv(
      HEADER + "\nGPT,渠道甲,Plus,https://x.com,100,7天,低,在售,@tg,卡密,兑换,备注1",
    );
    expect(r.errors).toHaveLength(0);
    expect(r.ok).toHaveLength(1);
    expect(r.ok[0]).toMatchObject({
      category: "GPT",
      name: "渠道甲",
      product: "Plus",
      url: "https://x.com",
      manual_price: "100",
      risk: "低",
      status: "在售",
      contact: "@tg",
    });
  });

  it("列顺序可乱、未知列忽略", () => {
    const r = parseChannelsCsv("渠道名,分类,垃圾列\n甲,GPT,xxx");
    expect(r.errors).toHaveLength(0);
    expect(r.ok[0]).toMatchObject({ name: "甲", category: "GPT" });
  });

  it("缺渠道名/分类列 → 整文件错误", () => {
    const r = parseChannelsCsv("产品,价格\nPlus,100");
    expect(r.ok).toHaveLength(0);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors[0].message).toMatch(/分类|渠道名/);
  });

  it("逐行校验:第 3 行缺分类记错且不进 ok,合法行仍进 ok", () => {
    const r = parseChannelsCsv(
      HEADER +
        "\nGPT,甲,,,,,低,在售,,,,\n,乙,,,,,低,在售,,,,",
    );
    expect(r.ok).toHaveLength(1);
    expect(r.ok[0].name).toBe("甲");
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].line).toBe(3);
  });

  it("非法风险值记错", () => {
    const r = parseChannelsCsv(HEADER + "\nGPT,甲,,,,,爆炸,在售,,,,");
    expect(r.ok).toHaveLength(0);
    expect(r.errors[0].line).toBe(2);
  });

  it("还原导出的防注入前缀(' @x → @x),处理引号/CRLF/BOM/空行", () => {
    const text =
      "﻿" +
      HEADER +
      '\r\nGPT,"甲,乙",,,,,低,在售,\'@tg,,,"含""引号"\r\n\r\n';
    const r = parseChannelsCsv(text);
    expect(r.errors).toHaveLength(0);
    expect(r.ok).toHaveLength(1);
    expect(r.ok[0].name).toBe("甲,乙");
    expect(r.ok[0].contact).toBe("@tg");
    expect(r.ok[0].note).toBe('含"引号');
  });

  it("空文本 → 空结果且报错", () => {
    const r = parseChannelsCsv("");
    expect(r.ok).toHaveLength(0);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

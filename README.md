# 上游采购渠道工具(内部私用)

<!-- SIUSER-SEO-INTRO:START -->

## 项目介绍 / Project Introduction

**中文介绍**：上游采购与供应链协作项目，围绕供应商筛选、采购流程、信息整理和业务自动化做实践。

**English**: An upstream procurement and supply-chain workflow project for supplier sourcing, purchasing processes, information organization, and business automation.

**SEO 关键词 / SEO Keywords**: procurement, supply chain, supplier sourcing, workflow automation, 采购管理

<!-- SIUSER-SEO-INTRO:END -->


本人 + 合伙人内部使用,纯手动增删改查渠道信息。无爬虫。

## 本地开发

    npm install
    cp .env.example .env   # 填 Supabase URL / anon key
    npm run dev

## 测试

    npm test

## 部署

见 `docs/DEPLOY.md`(Supabase + GitHub Pages)。

## 安全说明

- 登录用 Supabase Auth(各自账号),数据受行级安全 RLS 保护:未登录拿不到任何价格数据。
- 公开注册在 Supabase 后台关闭,账号由管理员手动创建。

<!-- SIUSER-CONTACT:START -->

## 联系我 / Contact

想交流 AI 工具、内容自动化、SEO、私域增长或项目合作，可以扫码加我微信。

For collaboration on AI tools, content automation, SEO, private-domain growth, or product experiments, scan the WeChat QR code below.

<img src="https://raw.githubusercontent.com/siuserxiaowei/siuserxiaowei/main/assets/contact/wechat-qrcode.jpg" width="180" alt="WeChat QR code / 微信二维码" />

**关键词 / Keywords**: procurement, supply chain, supplier sourcing, workflow automation, AI tools, AI automation, GitHub Pages, SEO

<!-- SIUSER-CONTACT:END -->

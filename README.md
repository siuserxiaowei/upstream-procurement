# 上游采购渠道工具(内部私用)

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

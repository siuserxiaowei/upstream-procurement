# 上游采购渠道工具 — 设计文档(v2)

- 日期:2026-05-16
- 状态:已定稿(v2,用户确认:纯 GitHub Pages、不爬取、各自账号)
- 使用者:本人 + 合伙人(共 2 人,内部私用)

## 变更说明(相对 v1)

用户明确收窄范围:

1. **去掉爬虫**:不做任何自动抓价,所有字段纯手动增删改查
2. **改纯 GitHub Pages 托管**:不要 Vercel、不要服务器
3. **登录改各自账号**:纯静态站无法安全实现"共用口令"(客户端校验是假锁),改用 Supabase Auth,你和合伙人各一个账号,安全由数据库行级安全(RLS)在服务端强制

## 1. 背景与目标

把飞书《上游采购手册》复刻为一个**自己的内部静态网站**,纯手动维护渠道信息。

功能:

- 渠道增删改查(CRUD)
- 链接可点击跳转(新窗口)
- 按分类/风险筛选、按渠道名搜索
- 登录后才能看到和操作数据

非目标:

- 不对外公开,不做面向代理/客户的页面
- **不做任何自动抓价/爬虫**
- 不做订单、支付、库存

## 2. 技术架构

全部免费层,全部围绕 GitHub:

| 组件 | 选型 | 说明 |
|---|---|---|
| 代码仓库 | GitHub 私有仓库 | 仅 2 人 |
| 网站 | **Vite + React + TypeScript 静态单页**,发布到 **GitHub Pages** | 纯静态,无服务器 |
| 样式 | Tailwind CSS | |
| 数据库 | Supabase 免费版(Postgres) | 浏览器经 `@supabase/supabase-js` 用 anon key 直连 |
| 登录 | Supabase Auth(邮箱+密码) | 你和合伙人各 1 个账号,关闭公开注册 |
| 数据保护 | Supabase 行级安全(RLS) | 仅 `authenticated` 角色可读写 `channels`,未登录什么都拿不到 |
| 部署 | GitHub Actions 构建并发布到 Pages | 仅做构建发布,无爬虫 |

安全要点:anon key 暴露在前端是 Supabase 的正常设计——真正的门禁是 RLS。未登录用户即使拿到 anon key,RLS 也会让查询返回空、写入被拒。公开注册在 Supabase 后台关闭,2 个账号由管理员手动创建。

数据流:

```
浏览器(GitHub Pages 静态站)
  ──未登录──> 显示登录页
  ──邮箱密码──> Supabase Auth ──签发 JWT──> 浏览器
  ──带 JWT 的 CRUD──> Supabase(RLS 校验 authenticated)──> channels 表
```

## 3. 数据模型

单表 `channels`(对齐飞书手册字段):

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid (pk) | 主键 |
| category | text | 分类:GPT / Claude / Google / Grok / Suno / 其他 |
| name | text | 渠道名 |
| url | text | 链接(可点击跳转) |
| manual_price | text | 当前价格(自由文本) |
| warranty | text | 质保(自由文本) |
| risk | text(enum) | 风险:`低` / `中` / `高` |
| contact | text | 联系方式 |
| note | text | 备注 |
| card_format | text | 卡密格式 |
| redeem_url | text | 兑换地址 |
| status | text(enum) | 状态:`在售` / `空仓` / `停售` |
| created_at / updated_at | timestamptz | 时间戳 |

(v1 中的 crawl_* 字段已全部删除)

## 4. 功能与页面

静态单页:

1. **未登录**:登录表单(邮箱 + 密码),错误提示
2. **已登录主页**:
   - 顶部:新增按钮、分类筛选、风险筛选、渠道名搜索、退出登录
   - 表格:按分类分组;列含渠道名、链接(点击新窗口打开)、价格、质保、风险(绿/黄/红徽章)、状态、联系方式、备注、操作
3. **新增/编辑**:弹窗表单,覆盖所有可填字段
4. **删除**:二次确认

## 5. 范围

单个实现计划即 MVP:Supabase 建表 + RLS + 建 2 个账号 → Vite/React 静态站(登录 + CRUD 表格)→ GitHub Actions 发布到 GitHub Pages。

## 6. 风险与取舍

- 纯静态无法做"共用口令"安全门 → 改 Supabase Auth 各自账号(用户已确认)
- 私有仓库 + GitHub Pages:GitHub Pages 对私有仓库的发布需账户支持(免费账户私有仓库 Pages 站点为 private 访问需 GitHub Pages 私有可见性,或仓库设为 public 但数据安全完全由 Supabase RLS + Auth 保证,页面本身不含敏感数据,价格数据全在登录后才从 Supabase 拉取)→ 部署文档说明两种选择,默认:仓库可 public,因为前端代码不含价格,价格受 Auth+RLS 保护
- Supabase 免费层用量上限:2 人手动操作远低于额度
- anon key 暴露:Supabase 正常设计,安全靠 RLS,非缺陷

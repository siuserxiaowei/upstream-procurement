# 上游采购渠道工具 — 设计文档

- 日期:2026-05-16
- 状态:待用户评审
- 使用者:本人 + 合伙人(共 2 人,内部私用)

## 1. 背景与目标

目前上游采购渠道信息维护在一份飞书《上游采购手册》里(渠道总览 + 联系方式 + 风险标注),靠手动整理。需要一个**自己托管的内部网站**复刻这份手册的操作体验,并在飞书基础上增加:

- 标准增删改查(CRUD)
- 链接可点击跳转(新窗口打开)
- 部分公开发卡网价格**定时自动抓取**,作为手动维护的补充

非目标(明确不做):

- 不对外公开,不做面向代理/客户的展示页(这是纯内部采购参考工具)
- 不抓 Telegram / 微信群 / 需登录后台的价格(技术上不可行,只手动维护)
- 不做订单、支付、库存等业务系统

## 2. 关键现实约束(必须先认可)

"定时抓价"只对一部分来源可行:

| 来源类型 | 例子 | 自动抓价 |
|---|---|---|
| 公开发卡网(HTML 价格) | `pay.ldxp.cn`、`redeemgpt.com`、`getgpt.pro`、`shop.gptai.vip`、`aieasy.plus`、`chong.plus` | ✅ 能,逐站写适配器,会偶尔失效 |
| Telegram 频道/群/机器人 | `t.me/LanChongAI`、`@zhizhishu` | ❌ 不能,只手动 |
| 海外站 | `plati.market`、`funpay.com` | ⚠️ 勉强,价格波动大,仅作参考 |

设计原则:**手动 CRUD 是永远可靠的地基;自动抓价是尽力而为的增强。抓不到不影响手动维护的数据,只标记抓取状态。**

额外约束:GitHub Actions 运行器在海外(Azure IP),部分国内发卡网可能屏蔽。抓取失败属预期内,通过"抓取状态"字段透明呈现,不视为系统故障。

## 3. 技术架构(方案 A)

全部免费层:

| 组件 | 选型 | 说明 |
|---|---|---|
| 代码仓库 | GitHub 私有仓库 | 仅 2 人协作 |
| 网站(前端+API) | Next.js,部署到 Vercel(或 Cloudflare Pages) | App Router,Server Actions / Route Handler 做 API |
| 数据库 | Supabase 免费版(Postgres) | 通过 Supabase JS 客户端访问 |
| 定时爬虫 | GitHub Actions 定时任务(cron,每 6 小时) | Node 脚本,逐站适配器,结果写回 Supabase |
| 登录 | 共用单口令 + 签名 Cookie 会话 | 见 §6 |

数据流:

```
浏览器 ──登录口令──> Next.js(校验 Cookie)
浏览器 ──CRUD──> Next.js API ──> Supabase(Postgres)
GitHub Actions(cron) ──跑爬虫──> 各发卡网 ──解析价格──> 写回 Supabase(crawl_* 字段)
浏览器刷新表格 ──> 看到最新抓取价 + 抓取时间 + 抓取状态
```

## 4. 数据模型

单表 `channels`(对齐飞书手册字段):

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid (pk) | 主键 |
| category | text | 分类:GPT / Claude / Google / Grok / Suno / 其他 |
| name | text | 渠道名(如 jayron、gugu 咕咕) |
| url | text | 链接(可点击跳转) |
| manual_price | text | 手填的当前价格(自由文本,如 "¥9 起 / 批发 7.5") |
| warranty | text | 质保(自由文本,如 "✅ 失败退款" / "❌" / "首登") |
| risk | text(enum) | 风险:`低` / `中` / `高` |
| contact | text | 联系方式(微信/TG/QQ 等) |
| note | text | 备注 |
| card_format | text | 卡密格式(如 16位 / 4-4-4) |
| redeem_url | text | 兑换地址 |
| status | text(enum) | 状态:`在售` / `空仓` / `停售` |
| crawl_enabled | bool | 是否对该 url 启用自动抓价 |
| crawl_price | text | 最近一次抓到的价格(只读,爬虫写) |
| crawl_at | timestamptz | 最近一次抓取时间(爬虫写) |
| crawl_status | text(enum) | `成功` / `失败` / `不支持`(爬虫写) |
| created_at / updated_at | timestamptz | 时间戳 |

排序:前端按 `category` 分组、可按价格/风险排序(飞书里的"排名"用拖拽/手动序号成本高,先用排序替代,后续按需再加 `sort_order`)。

## 5. 功能与页面

单页应用,一张表 + 操作:

1. **登录页**:输入共用口令,正确则种 Cookie,跳转主页面
2. **主表格**:
   - 按分类(GPT/Claude/...)分组展示
   - 列:渠道名、链接(可点击,新标签打开)、手填价格、抓取价格+抓取时间、质保、风险(颜色徽章:绿/黄/红)、状态、联系方式、备注
   - 顶部筛选:按分类、风险、状态过滤;关键词搜索渠道名
   - 列排序:按价格、风险、抓取时间
3. **新增 / 编辑**:弹窗表单,覆盖 §4 所有可手填字段;`crawl_enabled` 勾选框
4. **删除**:二次确认
5. **抓取状态可见**:每行显示抓取价 vs 手填价,抓取时间,失败行有明显标识(让人知道这条要手动核)

## 6. 登录与安全

- 共用单口令:口令哈希存环境变量(`APP_PASSWORD`),不入库不进仓库
- 登录成功后下发 **HttpOnly + Secure 签名 Cookie**(`SESSION_SECRET` 签名),有效期如 30 天
- 所有页面与 API 在服务端校验 Cookie,未登录一律重定向登录页
- Supabase 的 service key 只在服务端 / GitHub Actions 使用,绝不暴露到前端;前端经 Next.js API 间接访问数据库
- 仓库私有;`.env` 进 `.gitignore`;Vercel 与 GitHub Actions 用各自的 Secrets 配置

## 7. 爬虫设计

- 位置:仓库内 `scripts/crawler/`,Node + 轻量 HTML 解析(如 cheerio)
- 触发:GitHub Actions `schedule` cron(每 6 小时)+ 可手动触发(workflow_dispatch)
- 逻辑:
  1. 从 Supabase 读 `crawl_enabled = true` 的渠道
  2. 按 url 域名匹配**站点适配器**(每个发卡网一个解析器);无适配器 → `crawl_status=不支持`
  3. 抓成功 → 写 `crawl_price`、`crawl_at=now`、`crawl_status=成功`
  4. 抓失败(超时/被封/结构变)→ 写 `crawl_at=now`、`crawl_status=失败`,**不覆盖手填价**
- 首批适配器范围(MVP):公开发卡网中结构清晰的 2–3 个(如 `pay.ldxp.cn` 异次元发卡类、`redeemgpt.com`),其余先标 `不支持`,后续按需逐个加
- 失败容忍:单站失败不影响其他站;整体 job 不因个别失败而 fail

## 8. 范围划分(单个实现计划即可)

MVP 一次交付:登录 → CRUD 表格(全字段)→ 2–3 个发卡网适配器 + GitHub Actions 定时抓价 → 部署到 Vercel + Supabase。

后续可选(不在本次):更多发卡网适配器、拖拽排序、变价历史曲线、价格异常提醒。

## 9. 风险与已知取舍

- 发卡网结构会变 → 适配器需偶尔维护;通过"抓取状态"透明暴露,不静默出错
- GitHub Actions 海外 IP 可能被国内发卡网屏蔽 → 抓取尽力而为;若大面积失败,后续可加自托管 runner(本机)作为补充,本次不做
- Supabase / Vercel 免费层有用量上限 → 2 人 + 每 6 小时抓一次,远在免费额度内
- 共用口令安全性弱于独立账号 → 按用户明确选择;口令泄露风险靠私有部署 + 不外传缓解

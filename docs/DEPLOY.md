# 部署步骤

## 1. Supabase
1. supabase.com 注册,新建免费 project
2. SQL Editor 粘贴执行 `supabase/schema.sql`(建表 + RLS)
3. Project Settings → API,记下 `Project URL` 和 `anon` public key(前端用这两个)
4. Authentication → Providers → Email:保持启用
5. Authentication → Sign In / Providers(或 Settings)→ 关闭 "Allow new users to sign up"(禁止公开注册)
6. Authentication → Users → Add user,手动创建 2 个账号(你和合伙人的邮箱+密码)

## 2. GitHub Pages
1. 新建 GitHub 仓库(仓库名需与 vite.config.ts 的 base `/<仓库名>/` 一致;
   若用默认 `upstream-procurement`,仓库就叫这个,否则改 vite.config.ts 后再 push)
2. Settings → Secrets and variables → Actions,新增:
   - `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`
3. Settings → Pages → Build and deployment → Source 选 "GitHub Actions"
4. push 到 main 触发部署;完成后 Pages 给出网址
5. 打开网址 → 登录页 → 用 Supabase 后台建好的账号登录
6. 仅把网址和账号给合伙人。前端代码不含价格,价格全在登录后由 Supabase 受 RLS 保护返回

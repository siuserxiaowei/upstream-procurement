# 部署步骤

## 1. Supabase
1. supabase.com 注册,新建免费 project
2. SQL Editor 粘贴执行 `supabase/schema.sql`(建表 + RLS)
3. Project Settings → API,记下 `Project URL` 和 `anon` public key(前端用这两个)
4. Authentication → Providers → Email:保持启用
5. Authentication → Sign In / Providers(或 Settings)→ 关闭 "Allow new users to sign up"(禁止公开注册)
6. Authentication → Users → Add user,手动创建 2 个账号(你和合伙人的邮箱+密码)

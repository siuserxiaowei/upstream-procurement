import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setErr("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pw,
    });
    if (error) {
      setErr("邮箱或密码错误");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <form onSubmit={submit} className="w-80 space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-lg font-semibold">上游采购渠道 · 登录</h1>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="邮箱"
          className="w-full rounded border px-3 py-2"
          autoFocus
        />
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="密码"
          className="w-full rounded border px-3 py-2"
        />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          disabled={loading}
          className="w-full rounded bg-gray-900 py-2 text-white disabled:opacity-50"
        >
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
    </main>
  );
}

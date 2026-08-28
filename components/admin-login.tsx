"use client";

import { useState } from "react";

// 운영자 로그인 폼 — 시크릿 입력 → 세션 쿠키 발급 → 새로고침.
export function AdminLogin() {
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      if (res.ok) {
        try {
          localStorage.setItem("tyler_admin_ui", "1"); // 메뉴 노출 힌트(권한 아님 — site-nav 참조)
        } catch {
          // ignore
        }
        window.location.reload();
        return;
      }
      setError(res.status === 401 ? "시크릿이 일치하지 않습니다." : "로그인에 실패했습니다.");
    } catch {
      setError("로그인에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-xl font-bold">운영 통계</h1>
      <form
        onSubmit={submit}
        className="mt-4 space-y-3 rounded-2xl border border-stone-200 bg-white p-5"
      >
        <label className="block text-sm font-medium text-stone-600" htmlFor="admin-secret">
          운영자 시크릿
        </label>
        <input
          id="admin-secret"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          autoComplete="current-password"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || !secret}
          className="w-full rounded-lg bg-stone-900 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? "확인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}

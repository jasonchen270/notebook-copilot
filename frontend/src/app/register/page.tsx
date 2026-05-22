"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { api, setToken } from "@/lib/api";

type TokenResponse = { access_token: string };

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await api<TokenResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, display_name: displayName || null }),
      });
      setToken(res.access_token);
      router.push("/notebook");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <h1 className="mb-6 text-2xl font-semibold">Create account</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="display name (optional)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="border-ink-200 focus:border-accent-500 w-full rounded-lg border bg-white px-3 py-2 outline-none"
        />
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-ink-200 focus:border-accent-500 w-full rounded-lg border bg-white px-3 py-2 outline-none"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border-ink-200 focus:border-accent-500 w-full rounded-lg border bg-white px-3 py-2 outline-none"
        />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="bg-accent-600 hover:bg-accent-500 w-full rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {busy ? "Creating..." : "Create account"}
        </button>
      </form>
    </main>
  );
}

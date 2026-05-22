"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    const match = hash.match(/[#&]token=([^&]+)/);
    if (match) {
      setToken(decodeURIComponent(match[1]));
      history.replaceState(null, "", window.location.pathname);
      router.replace("/notebook");
    }
  }, [router]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">Notebook Copilot</h1>
      <p className="text-ink-700 text-lg leading-relaxed">
        Chat with an LLM. It writes Python. You run it in your browser, sandboxed in a Web
        Worker. No server-side execution, no install, no setup.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="bg-accent-600 hover:bg-accent-500 rounded-lg px-5 py-2.5 font-medium text-white"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="text-ink-700 hover:bg-ink-100 rounded-lg px-5 py-2.5 font-medium"
        >
          Create account
        </Link>
      </div>
    </main>
  );
}

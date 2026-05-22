"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Composer } from "@/components/Composer";
import { MessageList, Message } from "@/components/MessageList";
import { NotebookProvider } from "@/components/NotebookProvider";
import { useStreamingChat } from "@/hooks/useStreamingChat";
import { api, getToken } from "@/lib/api";

type SessionOut = { id: string; title: string };
type MessageOut = { id: string; role: "user" | "assistant"; content: string };

export default function NotebookPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const { send, streaming, buffer, error } = useStreamingChat(sessionId);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    (async () => {
      const sessions = await api<SessionOut[]>("/chat/sessions");
      const active =
        sessions[0] ??
        (await api<SessionOut>("/chat/sessions", {
          method: "POST",
          body: JSON.stringify({ title: "New notebook" }),
        }));
      setSessionId(active.id);
      const msgs = await api<MessageOut[]>(`/chat/sessions/${active.id}/messages`);
      setMessages(msgs.map((m) => ({ id: m.id, role: m.role, content: m.content })));
    })().catch((e) => console.error(e));
  }, [router]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!sessionId) return;
      const userMsg: Message = {
        id: `local-${Date.now()}`,
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);

      let finalContent = "";
      await send(text, (evt) => {
        if (evt.type === "delta") finalContent += evt.text;
        if (evt.type === "done") {
          setMessages((prev) => [
            ...prev,
            { id: evt.messageId, role: "assistant", content: finalContent },
          ]);
        }
      });
    },
    [sessionId, send],
  );

  const header = useMemo(
    () => (
      <header className="border-ink-200 bg-white/80 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <h1 className="font-semibold">Notebook Copilot</h1>
          <span className="text-ink-400 text-xs">
            {streaming ? "streaming..." : "idle"}
          </span>
        </div>
      </header>
    ),
    [streaming],
  );

  return (
    <NotebookProvider>
      {header}
      <main className="mx-auto max-w-4xl px-6">
        <MessageList messages={messages} streamingContent={buffer} />
        {error && (
          <p className="fixed inset-x-0 bottom-24 mx-auto max-w-xl rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </main>
      <Composer onSend={handleSend} disabled={!sessionId || streaming} />
    </NotebookProvider>
  );
}

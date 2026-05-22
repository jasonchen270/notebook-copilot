"use client";

import { useCallback, useRef, useState } from "react";
import { apiUrl, getToken } from "@/lib/api";

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "cells"; cells: Array<{ index: number; language: string; source: string }> }
  | { type: "done"; messageId: string }
  | { type: "error"; detail: string };

type ParsedFrame = { event: string; data: string };

function parseSSEChunk(raw: string): ParsedFrame[] {
  const frames: ParsedFrame[] = [];
  for (const block of raw.split("\n\n")) {
    if (!block.trim()) continue;
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) frames.push({ event, data: dataLines.join("\n") });
  }
  return frames;
}

export function useStreamingChat(sessionId: string | null) {
  const [streaming, setStreaming] = useState(false);
  const [buffer, setBuffer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (content: string, onEvent?: (evt: StreamEvent) => void) => {
      if (!sessionId) throw new Error("no session");
      setBuffer("");
      setError(null);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const token = getToken();
        const res = await fetch(apiUrl(`/chat/sessions/${sessionId}/messages`), {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ content }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`stream failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let pending = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          const lastBreak = pending.lastIndexOf("\n\n");
          if (lastBreak === -1) continue;
          const ready = pending.slice(0, lastBreak + 2);
          pending = pending.slice(lastBreak + 2);

          for (const frame of parseSSEChunk(ready)) {
            try {
              const payload = JSON.parse(frame.data);
              if (frame.event === "delta") {
                setBuffer((prev) => prev + payload.text);
                onEvent?.({ type: "delta", text: payload.text });
              } else if (frame.event === "cells") {
                onEvent?.({ type: "cells", cells: payload.cells });
              } else if (frame.event === "done") {
                onEvent?.({ type: "done", messageId: payload.message_id });
              } else if (frame.event === "error") {
                setError(payload.detail);
                onEvent?.({ type: "error", detail: payload.detail });
              }
            } catch {
              // ignore malformed frame
            }
          }
        }
      } catch (e: unknown) {
        if ((e as Error).name !== "AbortError") {
          const msg = e instanceof Error ? e.message : "stream error";
          setError(msg);
          onEvent?.({ type: "error", detail: msg });
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [sessionId],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { send, cancel, streaming, buffer, error };
}

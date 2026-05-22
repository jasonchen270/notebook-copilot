"use client";

import { useEffect, useRef } from "react";
import { MessageBubble, Role } from "./MessageBubble";

export type Message = { id: string; role: Role; content: string };

export function MessageList({
  messages,
  streamingContent,
}: {
  messages: Message[];
  streamingContent: string;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingContent]);

  return (
    <div className="flex flex-col gap-4 pb-32 pt-6">
      {messages.map((m) => (
        <MessageBubble key={m.id} role={m.role} content={m.content} />
      ))}
      {streamingContent && (
        <MessageBubble role="assistant" content={streamingContent} streaming />
      )}
      <div ref={endRef} />
    </div>
  );
}

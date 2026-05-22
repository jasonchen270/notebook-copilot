"use client";

import { splitProseAndCode } from "@/lib/cells";
import { NotebookCell } from "./NotebookCell";

export type Role = "user" | "assistant";

export function MessageBubble({
  role,
  content,
  streaming,
}: {
  role: Role;
  content: string;
  streaming?: boolean;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-accent-600 max-w-2xl rounded-2xl rounded-br-md px-4 py-2 text-white">
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }

  const parts = splitProseAndCode(content);

  return (
    <div className="flex flex-col gap-3">
      {parts.map((part, i) =>
        part.kind === "prose" ? (
          <div
            key={i}
            className="text-ink-900 max-w-3xl whitespace-pre-wrap rounded-2xl rounded-bl-md bg-white px-4 py-2 leading-relaxed shadow-sm"
          >
            {part.text}
          </div>
        ) : (
          <NotebookCell key={i} source={part.source} />
        ),
      )}
      {streaming && (
        <div className="text-ink-400 text-xs italic">streaming...</div>
      )}
    </div>
  );
}

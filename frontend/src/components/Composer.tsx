"use client";

import { FormEvent, KeyboardEvent, useState } from "react";

export function Composer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  function submit(e: FormEvent | KeyboardEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) submit(e);
  }

  return (
    <form
      onSubmit={submit}
      className="border-ink-200 bg-ink-50/90 fixed inset-x-0 bottom-0 border-t backdrop-blur"
    >
      <div className="mx-auto flex max-w-4xl items-end gap-2 px-6 py-3">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask the notebook..."
          rows={2}
          className="border-ink-200 focus:border-accent-500 max-h-48 flex-1 resize-none rounded-lg border bg-white px-3 py-2 outline-none"
        />
        <button
          type="submit"
          disabled={disabled}
          className="bg-accent-600 hover:bg-accent-500 rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </form>
  );
}

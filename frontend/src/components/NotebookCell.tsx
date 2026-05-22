"use client";

import clsx from "clsx";
import { useId, useState } from "react";
import { useNotebookContext } from "./NotebookProvider";

export function NotebookCell({ source }: { source: string }) {
  const cellId = useId();
  const { run, outputs, running, ready, initError } = useNotebookContext();
  const [collapsed, setCollapsed] = useState(false);
  const cellOutputs = outputs[cellId] ?? [];
  const isRunning = !!running[cellId];

  return (
    <div className="border-ink-200 max-w-3xl overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="border-ink-100 flex items-center justify-between border-b px-3 py-2">
        <span className="text-ink-400 font-mono text-xs uppercase tracking-wider">python</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-ink-700 hover:bg-ink-100 rounded px-2 py-0.5 text-xs"
          >
            {collapsed ? "show" : "hide"}
          </button>
          <button
            disabled={!ready || isRunning}
            onClick={() => run(cellId, source)}
            className={clsx(
              "rounded px-3 py-0.5 text-xs font-medium",
              ready && !isRunning
                ? "bg-accent-600 text-white hover:bg-accent-500"
                : "bg-ink-200 text-ink-400 cursor-not-allowed",
            )}
            title={initError ? `Pyodide failed to load: ${initError}` : undefined}
          >
            {isRunning ? "running..." : ready ? "run" : initError ? "load failed" : "loading..."}
          </button>
        </div>
      </div>
      {!collapsed && (
        <pre className="bg-ink-900 overflow-x-auto px-4 py-3 text-sm leading-relaxed text-white">
          <code>{source}</code>
        </pre>
      )}
      {cellOutputs.length > 0 && (
        <div className="bg-ink-50 border-ink-100 border-t px-4 py-3 text-sm">
          {cellOutputs.map((o, i) => {
            if (o.kind === "stdout") {
              return (
                <pre key={i} className="cell-output text-ink-900">
                  {o.text}
                </pre>
              );
            }
            if (o.kind === "stderr") {
              return (
                <pre key={i} className="cell-output text-amber-700">
                  {o.text}
                </pre>
              );
            }
            if (o.kind === "image") {
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={`data:image/png;base64,${o.pngBase64}`}
                  alt="cell output"
                  className="my-2 max-w-full rounded border"
                />
              );
            }
            return (
              <pre key={i} className="cell-output text-red-700">
                {o.message}
              </pre>
            );
          })}
        </div>
      )}
    </div>
  );
}

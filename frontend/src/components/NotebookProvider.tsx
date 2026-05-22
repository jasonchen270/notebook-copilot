"use client";

import { createContext, ReactNode, useContext } from "react";
import { useNotebookRuntime } from "@/hooks/useNotebookRuntime";

type RuntimeCtx = ReturnType<typeof useNotebookRuntime>;

const NotebookCtx = createContext<RuntimeCtx | null>(null);

export function NotebookProvider({ children }: { children: ReactNode }) {
  const runtime = useNotebookRuntime();
  return <NotebookCtx.Provider value={runtime}>{children}</NotebookCtx.Provider>;
}

export function useNotebookContext(): RuntimeCtx {
  const ctx = useContext(NotebookCtx);
  if (!ctx) {
    throw new Error("useNotebookContext must be used inside <NotebookProvider>");
  }
  return ctx;
}

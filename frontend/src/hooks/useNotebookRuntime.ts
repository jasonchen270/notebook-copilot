"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CellOutput =
  | { kind: "stdout"; text: string }
  | { kind: "stderr"; text: string }
  | { kind: "image"; pngBase64: string }
  | { kind: "error"; message: string };

const PYODIDE_VERSION = "0.26.2";
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full`;

declare global {
  interface Window {
    loadPyodide?: (opts: {
      indexURL: string;
      stdout?: (s: string) => void;
      stderr?: (s: string) => void;
    }) => Promise<PyodideInstance>;
  }
}

interface PyodideInstance {
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackagesFromImports: (code: string) => Promise<void>;
  loadPackage: (name: string | string[]) => Promise<void>;
  FS: { writeFile: (path: string, data: Uint8Array | string) => void; mkdirTree: (p: string) => void };
}

function loadPyodideScript(): Promise<void> {
  if (window.loadPyodide) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>('script[data-pyodide-loader="1"]');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("script load error")), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${PYODIDE_CDN}/pyodide.js`;
    script.async = true;
    script.dataset.pyodideLoader = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("failed to load pyodide.js"));
    document.head.appendChild(script);
  });
}

const SETUP_PY = `
import io, base64, sys
import matplotlib
matplotlib.use("AGG")
import matplotlib.pyplot as _plt

_NBC_IMAGES = []

def _capture_show(*args, **kwargs):
    fig = _plt.gcf()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    buf.seek(0)
    _NBC_IMAGES.append(base64.b64encode(buf.read()).decode("ascii"))
    _plt.close(fig)

_plt.show = _capture_show
`;

let _pyodidePromise: Promise<PyodideInstance> | null = null;
let _stdoutSink: ((s: string) => void) | null = null;
let _stderrSink: ((s: string) => void) | null = null;

function getPyodide(): Promise<PyodideInstance> {
  if (_pyodidePromise) return _pyodidePromise;
  _pyodidePromise = (async () => {
    await loadPyodideScript();
    if (!window.loadPyodide) throw new Error("loadPyodide missing after script load");
    const py = await window.loadPyodide({
      indexURL: PYODIDE_CDN,
      stdout: (s) => _stdoutSink?.(s),
      stderr: (s) => _stderrSink?.(s),
    });
    py.FS.mkdirTree("/uploads");
    await py.loadPackage(["numpy", "pandas", "matplotlib"]);
    await py.runPythonAsync(SETUP_PY);
    return py;
  })();
  return _pyodidePromise;
}

export function useNotebookRuntime() {
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<Record<string, CellOutput[]>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    getPyodide()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e) => {
        if (!cancelled) setInitError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const append = useCallback((cellId: string, out: CellOutput) => {
    setOutputs((prev) => ({ ...prev, [cellId]: [...(prev[cellId] ?? []), out] }));
  }, []);

  const run = useCallback(
    async (cellId: string, source: string) => {
      const py = await getPyodide();
      setOutputs((prev) => ({ ...prev, [cellId]: [] }));
      setRunning((r) => ({ ...r, [cellId]: true }));

      _stdoutSink = (s) => append(cellId, { kind: "stdout", text: s });
      _stderrSink = (s) => append(cellId, { kind: "stderr", text: s });

      try {
        await py.loadPackagesFromImports(source);
        const result = await py.runPythonAsync(source);
        if (result !== undefined && result !== null) {
          append(cellId, { kind: "stdout", text: String(result) + "\n" });
        }
        // Drain any matplotlib figures captured during the run.
        const drained = (await py.runPythonAsync(
          "import json as _json; _out=_json.dumps(_NBC_IMAGES); _NBC_IMAGES.clear(); _out",
        )) as string;
        const images = JSON.parse(drained) as string[];
        for (const png of images) {
          append(cellId, { kind: "image", pngBase64: png });
        }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        append(cellId, { kind: "error", message });
      } finally {
        _stdoutSink = null;
        _stderrSink = null;
        setRunning((r) => ({ ...r, [cellId]: false }));
      }
    },
    [append],
  );

  const uploadFile = useCallback(async (path: string, file: File) => {
    const py = await getPyodide();
    const bytes = new Uint8Array(await file.arrayBuffer());
    py.FS.writeFile(path, bytes);
  }, []);

  return { ready, initError, run, outputs, running, uploadFile };
}

/// <reference lib="webworker" />

// Loaded from the Pyodide CDN at runtime. We pin a version so behavior is reproducible.
const PYODIDE_VERSION = "0.26.2";
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full`;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

interface PyodideInstance {
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackagesFromImports: (code: string) => Promise<void>;
  loadPackage: (name: string | string[]) => Promise<void>;
  FS: { writeFile: (path: string, data: Uint8Array | string) => void; mkdirTree: (p: string) => void };
  globals: { get: (k: string) => unknown };
}

type InMsg =
  | { type: "init"; packages?: string[] }
  | { type: "exec"; cellId: string; source: string }
  | { type: "writeFile"; path: string; bytes: ArrayBuffer };

type OutMsg =
  | { type: "ready" }
  | { type: "stdout"; cellId: string; text: string }
  | { type: "stderr"; cellId: string; text: string }
  | { type: "result"; cellId: string; repr: string | null }
  | { type: "image"; cellId: string; pngBase64: string }
  | { type: "error"; cellId: string; message: string }
  | { type: "done"; cellId: string };

let pyodide: PyodideInstance | null = null;
let currentCellId: string | null = null;

function post(msg: OutMsg) {
  ctx.postMessage(msg);
}

async function init(packages: string[]): Promise<void> {
  // ES-module workers cannot use importScripts. Pyodide ships an ESM build at
  // pyodide.mjs that we can dynamically import. The /* @vite-ignore */ hint
  // keeps the bundler from trying to resolve the CDN URL at build time.
  const mod = (await import(/* webpackIgnore: true */ `${PYODIDE_CDN}/pyodide.mjs`)) as {
    loadPyodide: (opts: {
      indexURL: string;
      stdout?: (s: string) => void;
      stderr?: (s: string) => void;
    }) => Promise<PyodideInstance>;
  };

  pyodide = await mod.loadPyodide({
    indexURL: PYODIDE_CDN,
    stdout: (s) => currentCellId && post({ type: "stdout", cellId: currentCellId, text: s }),
    stderr: (s) => currentCellId && post({ type: "stderr", cellId: currentCellId, text: s }),
  });

  pyodide.FS.mkdirTree("/uploads");

  const defaults = ["numpy", "pandas", "matplotlib", ...packages];
  await pyodide.loadPackage(defaults);

  // Patch plt.show() to capture each figure as base64 PNG and post it.
  await pyodide.runPythonAsync(`
import io, base64, json
import matplotlib
matplotlib.use("AGG")
import matplotlib.pyplot as _plt

def _capture_show(*args, **kwargs):
    fig = _plt.gcf()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    buf.seek(0)
    encoded = base64.b64encode(buf.read()).decode("ascii")
    print("__NBC_IMAGE__" + encoded)
    _plt.close(fig)

_plt.show = _capture_show
  `);

  post({ type: "ready" });
}

async function exec(cellId: string, source: string): Promise<void> {
  if (!pyodide) throw new Error("not initialized");
  currentCellId = cellId;
  try {
    await pyodide.loadPackagesFromImports(source);

    const wrapped = `
import sys, io, traceback
__nbc_buf = io.StringIO()
_old = (sys.stdout, sys.stderr)
sys.stdout = sys.stderr = __nbc_buf
try:
${source
  .split("\n")
  .map((l) => "    " + l)
  .join("\n")}
finally:
    sys.stdout, sys.stderr = _old

__nbc_out = __nbc_buf.getvalue()
__nbc_out
`;

    const result = await pyodide.runPythonAsync(wrapped);
    const captured = typeof result === "string" ? result : "";

    for (const line of captured.split("\n")) {
      const imgMarker = "__NBC_IMAGE__";
      const idx = line.indexOf(imgMarker);
      if (idx !== -1) {
        const pngBase64 = line.slice(idx + imgMarker.length).trim();
        post({ type: "image", cellId, pngBase64 });
      } else if (line) {
        post({ type: "stdout", cellId, text: line + "\n" });
      }
    }

    post({ type: "done", cellId });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    post({ type: "error", cellId, message });
    post({ type: "done", cellId });
  } finally {
    currentCellId = null;
  }
}

ctx.onmessage = async (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  try {
    if (msg.type === "init") {
      await init(msg.packages ?? []);
    } else if (msg.type === "exec") {
      await exec(msg.cellId, msg.source);
    } else if (msg.type === "writeFile") {
      if (!pyodide) throw new Error("not initialized");
      pyodide.FS.writeFile(msg.path, new Uint8Array(msg.bytes));
    }
  } catch (e: unknown) {
    const cellId = (msg as { cellId?: string }).cellId ?? "init";
    const message = e instanceof Error ? e.message : String(e);
    post({ type: "error", cellId, message });
  }
};

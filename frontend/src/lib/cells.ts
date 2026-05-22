export type ParsedCell = { index: number; language: string; source: string };

const FENCE = /```(?:python|py)\s*\n([\s\S]*?)```/g;

export function parseCells(markdown: string): ParsedCell[] {
  const cells: ParsedCell[] = [];
  let match: RegExpExecArray | null;
  let idx = 0;
  FENCE.lastIndex = 0;
  while ((match = FENCE.exec(markdown)) !== null) {
    const source = match[1].replace(/\s+$/g, "");
    if (source) cells.push({ index: idx++, language: "python", source });
  }
  return cells;
}

export function splitProseAndCode(markdown: string): Array<
  | { kind: "prose"; text: string }
  | { kind: "code"; source: string }
> {
  const out: Array<{ kind: "prose"; text: string } | { kind: "code"; source: string }> = [];
  const re = /```(?:python|py)\s*\n([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    if (match.index > cursor) {
      const text = markdown.slice(cursor, match.index);
      if (text.trim()) out.push({ kind: "prose", text });
    }
    out.push({ kind: "code", source: match[1].replace(/\s+$/g, "") });
    cursor = re.lastIndex;
  }
  if (cursor < markdown.length) {
    const tail = markdown.slice(cursor);
    if (tail.trim()) out.push({ kind: "prose", text: tail });
  }
  return out;
}

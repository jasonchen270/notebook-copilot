"""Parse fenced ```python blocks out of LLM responses for notebook cells."""

import re

_FENCE = re.compile(r"```(?:python|py)\s*\n(.*?)```", re.DOTALL)


def extract_cells(markdown: str) -> list[dict[str, str]]:
    cells: list[dict[str, str]] = []
    for idx, match in enumerate(_FENCE.finditer(markdown)):
        code = match.group(1).rstrip()
        if code:
            cells.append({"index": str(idx), "language": "python", "source": code})
    return cells

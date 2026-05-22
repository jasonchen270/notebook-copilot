"""LLM client backed by the local `claude` CLI.

We don't use the `anthropic` Python SDK here because that requires an API key.
The CLI is already authenticated against the user's Claude account, so we get
streaming completions for free with no key juggling.

The CLI is invoked with `--print --output-format stream-json
--include-partial-messages`, which emits one JSON event per line. We watch for
`content_block_delta` events to forward as text deltas.
"""

from __future__ import annotations

import asyncio
import json
import os
from collections.abc import AsyncIterator
from dataclasses import dataclass

from app.services.prompts import SYSTEM_PROMPT

_CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "/Users/jasonchen/.local/bin/claude")


@dataclass
class ChatTurn:
    role: str
    content: str


def _render_transcript(history: list[ChatTurn], latest: str) -> str:
    """Render prior turns as a textual transcript prefixed to the latest user message.

    The CLI's `--print` mode is single-shot, so multi-turn context is encoded
    inline. The model handles "User: ...\nAssistant: ..." transcripts well.
    """
    if not history:
        return latest
    parts: list[str] = []
    for turn in history:
        speaker = "User" if turn.role == "user" else "Assistant"
        parts.append(f"{speaker}: {turn.content}")
    parts.append(f"User: {latest}")
    parts.append("Assistant:")
    return "\n\n".join(parts)


class LLMClient:
    async def stream_chat(self, history: list[ChatTurn]) -> AsyncIterator[str]:
        if not history or history[-1].role != "user":
            raise ValueError("history must end with a user turn")
        latest = history[-1].content
        prior = history[:-1]
        prompt = _render_transcript(prior, latest)

        # NOTE: do NOT pass --bare. That flag forces API-key auth, which the user
        # doesn't have set; without it the CLI uses its OAuth session and just works.
        # We still run with cwd=/tmp to avoid pulling in any project-local CLAUDE.md.
        cmd = [
            _CLAUDE_BIN,
            "--print",
            "--output-format",
            "stream-json",
            "--include-partial-messages",
            "--verbose",
            "--append-system-prompt",
            SYSTEM_PROMPT,
            prompt,
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd="/tmp",  # detach from any local CLAUDE.md
        )
        assert proc.stdout is not None

        try:
            while True:
                line = await proc.stdout.readline()
                if not line:
                    break
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if obj.get("type") != "stream_event":
                    continue
                event = obj.get("event", {})
                if event.get("type") != "content_block_delta":
                    continue
                delta = event.get("delta", {})
                if delta.get("type") == "text_delta":
                    text = delta.get("text", "")
                    if text:
                        yield text
        finally:
            if proc.returncode is None:
                proc.terminate()
            await proc.wait()


_singleton: LLMClient | None = None


def get_llm() -> LLMClient:
    global _singleton
    if _singleton is None:
        _singleton = LLMClient()
    return _singleton

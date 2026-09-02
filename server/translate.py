"""Machine translation without an API key.

Uses Google Translate's public web endpoint (the one translate.google.com
itself calls), so there is no key and no quota to register. It is
unofficial: any failure returns None and the caller serves the memory in
its original language.

Chunks are translated concurrently under a fixed wall-clock budget so a
long memory cannot stall a serverless invocation past its time limit.
"""
import json
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

_URL = "https://translate.googleapis.com/translate_a/single"
_CHUNK = 1500    # characters per request; keeps the GET URL short
_TIMEOUT = 4     # seconds per request
_BUDGET = 6      # seconds for the whole translation


def _translate_chunk(text: str, target: str) -> str:
    query = urllib.parse.urlencode({
        "client": "gtx",
        "sl": "auto",  # memories already written in the target language pass through
        "tl": target,
        "dt": "t",
        "q": text,
    })
    req = urllib.request.Request(
        f"{_URL}?{query}",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return "".join(part[0] for part in payload[0] if part and part[0])


def _split(text: str) -> list[str]:
    """Split long text into chunks below _CHUNK at sentence boundaries."""
    if len(text) <= _CHUNK:
        return [text]
    chunks, current = [], ""
    for sentence in re.split(r"(?<=[.!?…])\s+", text):
        while len(sentence) > _CHUNK:  # a single monstrous sentence
            chunks.append(sentence[:_CHUNK])
            sentence = sentence[_CHUNK:]
        candidate = f"{current} {sentence}" if current else sentence
        if len(candidate) > _CHUNK:
            chunks.append(current)
            current = sentence
        else:
            current = candidate
    if current:
        chunks.append(current)
    return chunks


def translate(texts: list[str], target_lang: str) -> list[str] | None:
    """Translate every string in `texts`; None if any part fails or the
    budget runs out."""
    target = target_lang.split("-")[0].lower()  # "EN-GB" -> "en"
    jobs = [(i, chunk) for i, text in enumerate(texts) for chunk in _split(text)]
    if not jobs:
        return list(texts)
    parts: list[list[str]] = [[] for _ in texts]
    pool = ThreadPoolExecutor(max_workers=min(8, len(jobs)))
    try:
        futures = [pool.submit(_translate_chunk, chunk, target) for _, chunk in jobs]
        deadline = time.monotonic() + _BUDGET
        for (i, _), future in zip(jobs, futures):
            parts[i].append(future.result(timeout=max(0.0, deadline - time.monotonic())))
        return [" ".join(p) for p in parts]
    except Exception:
        return None
    finally:
        pool.shutdown(wait=False, cancel_futures=True)

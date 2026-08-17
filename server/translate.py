"""Machine translation without an API key.

Uses Google Translate's public web endpoint — the same one the website
itself calls, so no key and no quota registration. It is unofficial, so
every failure simply returns None and the caller falls back to serving
the memory in its original language.
"""
import json
import re
import urllib.parse
import urllib.request

_URL = "https://translate.googleapis.com/translate_a/single"
_CHUNK = 1500  # keeps the GET URL well below common length limits


def _translate_chunk(text: str, target: str) -> str:
    query = urllib.parse.urlencode({
        "client": "gtx",
        "sl": "auto",  # auto-detect: memories already written in English pass through
        "tl": target,
        "dt": "t",
        "q": text,
    })
    req = urllib.request.Request(
        f"{_URL}?{query}",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req, timeout=8) as resp:
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
    target = target_lang.split("-")[0].lower()  # "EN-GB" -> "en"
    try:
        return [
            " ".join(_translate_chunk(chunk, target) for chunk in _split(text))
            for text in texts
        ]
    except Exception:
        return None

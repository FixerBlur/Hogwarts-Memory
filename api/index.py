"""Vercel serverless entry point: exposes the Flask app as WSGI.

All /api/* and /adminer requests are rewritten here (see vercel.json);
everything else is served statically from public/ by the CDN.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from server import create_app

app = create_app()

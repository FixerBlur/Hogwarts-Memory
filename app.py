"""Entry point: python app.py -> http://localhost:8000"""
import sys
from pathlib import Path

# If the host shell exports PYTHON* vars that break venv resolution,
# fall back to adding the venv site-packages manually.
try:
    import flask  # noqa: F401
except ModuleNotFoundError:
    _venv = Path(__file__).resolve().parent / "venv"
    # POSIX and Windows venv layouts
    for _pattern in ("lib/python3.*/site-packages", "Lib/site-packages"):
        for _path in sorted(_venv.glob(_pattern)):
            if str(_path) not in sys.path:
                sys.path.insert(0, str(_path))

from server import create_app

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)

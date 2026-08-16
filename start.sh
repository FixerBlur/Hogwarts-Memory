#!/bin/sh
# Run the app with a clean Python environment.
cd "$(dirname "$0")" || exit 1

unset PYTHONHOME PYTHONPATH PYTHONPLATLIBDIR PYTHONUSERBASE PYTHONSTARTUP

if [ ! -x venv/bin/python ]; then
    python3 -m venv venv || exit 1
    ./venv/bin/pip install -r requirements.txt || exit 1
fi

if ! ./venv/bin/python -c "import flask" 2>/dev/null; then
    ./venv/bin/python -m ensurepip 2>/dev/null
    ./venv/bin/python -m pip install -r requirements.txt
fi

exec ./venv/bin/python app.py

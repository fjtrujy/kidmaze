#!/bin/sh
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VENV=${KIDMAZE_MELOTTS_VENV:-"$PROJECT_ROOT/.voice-tools/melotts"}
PYTHON="$VENV/bin/python"
MELOTTS_COMMIT=209145371cff8fc3bd60d7be902ea69cbdb7965a

if [ ! -x "$PYTHON" ]; then
  echo "Creating MeloTTS development environment at $VENV..."
  python3 -m venv "$VENV"
fi

if ! "$PYTHON" -c "import importlib.util; raise SystemExit(0 if importlib.util.find_spec('melo') and importlib.util.find_spec('unidic_lite') else 1)"; then
  echo "Installing pinned MeloTTS development dependencies..."
  "$PYTHON" -m pip install --upgrade pip 'setuptools<81' wheel
  "$PYTHON" -m pip install "git+https://github.com/myshell-ai/MeloTTS.git@$MELOTTS_COMMIT"
fi

exec "$PYTHON" "$PROJECT_ROOT/tools/generate-spanish-voice-assets.py" "$@"

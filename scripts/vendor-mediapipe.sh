#!/usr/bin/env bash
# Descarga MediaPipe Tasks Vision y el modelo Face Landmarker para servirlos
# desde tu propio dominio (sin depender de jsDelivr ni de Google Storage).
# La app detecta automáticamente /vendor/mediapipe si existe.
set -euo pipefail
VERSION="0.10.14"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/vendor/mediapipe"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$DEST/wasm"
( cd "$TMP" && npm pack "@mediapipe/tasks-vision@$VERSION" >/dev/null && tar -xzf ./*.tgz )
cp "$TMP/package/vision_bundle.mjs" "$DEST/"
cp "$TMP"/package/wasm/* "$DEST/wasm/"
curl -fsSL -o "$DEST/face_landmarker.task" \
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

echo "MediaPipe $VERSION copiado en $DEST"
du -sh "$DEST"

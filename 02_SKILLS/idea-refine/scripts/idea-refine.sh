#!/bin/bash
set -e

# Optional helper: create a directory for idea documents.
# Usage: ./scripts/idea-refine.sh [target-directory]

TARGET_DIR="${1:-ideas}"

if [ ! -d "$TARGET_DIR" ]; then
  mkdir -p "$TARGET_DIR"
  echo "Created directory: $TARGET_DIR" >&2
else
  echo "Directory already exists: $TARGET_DIR" >&2
fi

echo "{\"status\": \"ready\", \"directory\": \"$TARGET_DIR\"}"

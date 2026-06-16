#!/bin/bash

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: scripts/connect-github.sh https://github.com/USER/REPO.git"
  exit 1
fi

REMOTE_URL="$1"
REPO_DIR="/Users/didi/Documents/Obsidian Vault/AI +1"
PLIST_SOURCE="$REPO_DIR/automation/com.ai-plus.sync.plist"
PLIST_TARGET="$HOME/Library/LaunchAgents/com.ai-plus.sync.plist"

cd "$REPO_DIR"

git remote remove origin >/dev/null 2>&1 || true
git remote add origin "$REMOTE_URL"
git push -u origin main

mkdir -p "$HOME/Library/LaunchAgents"
cp "$PLIST_SOURCE" "$PLIST_TARGET"
launchctl bootout "gui/$(id -u)" "$PLIST_TARGET" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_TARGET"
launchctl kickstart -k "gui/$(id -u)/com.ai-plus.sync"

echo "Connected to $REMOTE_URL"
echo "Two-hour sync is installed."

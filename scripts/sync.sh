#!/bin/bash

set -u

REPO_DIR="/Users/didi/Documents/Obsidian Vault/AI +1"
LOG_DIR="$REPO_DIR/logs"
LOG_FILE="$LOG_DIR/sync.log"

mkdir -p "$LOG_DIR"
cd "$REPO_DIR" || exit 1

{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Checking for updates"

  if ! git remote get-url origin >/dev/null 2>&1; then
    echo "No GitHub remote is configured yet"
    exit 0
  fi

  git pull --rebase --autostash origin main || {
    echo "Pull failed; no local files were pushed"
    exit 1
  }

  git add content static scripts package.json .github .gitignore README.md automation

  if git diff --cached --quiet; then
    echo "No changes"
    exit 0
  fi

  git commit -m "content: sync Obsidian updates"
  git push origin main
  echo "Sync complete"
} >>"$LOG_FILE" 2>&1

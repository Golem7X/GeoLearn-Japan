#!/bin/bash
# Auto-deploy hook for GeoLearn-Japan
# Runs at Stop event: builds, syncs dist/, commits and pushes if index.html changed.

cd /home/user/GeoLearn-Japan || exit 0

# Exit silently if no uncommitted changes to tracked files
if git diff --quiet HEAD -- index.html dist/index.html _headers.built 2>/dev/null \
   && git diff --cached --quiet -- index.html dist/index.html _headers.built 2>/dev/null; then
  exit 0
fi

# 1. Run secure build (recomputes CSP hashes, updates timestamp)
node secure-build.js > /tmp/auto-deploy.log 2>&1
if [ $? -ne 0 ]; then
  echo '{"systemMessage":"⚠ Auto-deploy: secure-build.js failed. Check /tmp/auto-deploy.log"}'
  exit 0
fi

# 2. Sync dist/
cp index.html dist/index.html

# 3. Stage files
git add index.html dist/index.html _headers.built 2>/dev/null

# 4. Commit only if there are staged changes
if git diff --cached --quiet 2>/dev/null; then
  exit 0
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
git commit -m "Auto-build: sync dist and update CSP hashes" >> /tmp/auto-deploy.log 2>&1

# 5. Push
git push -u origin "$BRANCH" >> /tmp/auto-deploy.log 2>&1
if [ $? -eq 0 ]; then
  echo "{\"systemMessage\":\"✅ Auto-deployed to GitHub branch: $BRANCH\"}"
else
  echo "{\"systemMessage\":\"⚠ Auto-deploy: push failed on branch $BRANCH. Check /tmp/auto-deploy.log\"}"
fi

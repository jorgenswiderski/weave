#!/bin/bash

# Stash unstaged changes not added to the index
git stash --keep-index --include-untracked
# Remove any untracked files that may have been restored by the stash command (if a tracked file was deleted)
git clean

# Run your data dump script
npm run do-dump-data

# Check for unstaged changes in data-dump directory
if ! git diff --exit-code data-dump; then
  echo "There are unstaged changes in the data-dump directory. Please stage or discard them before committing."
  # Apply stashed changes back
  git stash pop
  exit 1
fi

# Test revision-lock.json
npm run load-revisions-dry-run

# Apply stashed changes back
git stash pop

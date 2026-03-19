#!/bin/bash
# Create a note in Readied from the command line
#
# Usage:
#   ./scripts/create-note.sh "# My Title\n\nContent here"
#   echo "# My Note" | ./scripts/create-note.sh -
#   ./scripts/create-note.sh --file path/to/note.md
#   ./scripts/create-note.sh --notebook "Work" "# Meeting notes"

DB="$HOME/Library/Application Support/@readied/desktop/readied.db"
NOTEBOOK_ID="inbox"

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --file)
      CONTENT=$(cat "$2")
      shift 2
      ;;
    --notebook)
      NOTEBOOK_ID="$2"
      shift 2
      ;;
    -)
      CONTENT=$(cat)
      shift
      ;;
    *)
      CONTENT="$1"
      shift
      ;;
  esac
done

if [ -z "$CONTENT" ]; then
  echo "Usage: create-note.sh [--notebook NAME] [--file path.md | - | \"content\"]"
  exit 1
fi

# Generate UUID
ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

# Extract title from first heading or first line
TITLE=$(echo "$CONTENT" | head -1 | sed 's/^#* *//')
if [ -z "$TITLE" ]; then
  TITLE="Untitled"
fi

# Count words
WORD_COUNT=$(echo "$CONTENT" | wc -w | tr -d ' ')

# If notebook is not "inbox", look up the ID
if [ "$NOTEBOOK_ID" != "inbox" ]; then
  FOUND_ID=$(sqlite3 "$DB" "SELECT id FROM notebooks WHERE name = '$NOTEBOOK_ID' LIMIT 1;" 2>/dev/null)
  if [ -n "$FOUND_ID" ]; then
    NOTEBOOK_ID="$FOUND_ID"
  else
    echo "Warning: notebook '$NOTEBOOK_ID' not found, using inbox"
    NOTEBOOK_ID="inbox"
  fi
fi

# Insert into DB
sqlite3 "$DB" "INSERT INTO notes (id, content, title, created_at, updated_at, word_count, notebook_id, status, needs_sync, local_version, sync_version)
VALUES ('$ID', '$(echo "$CONTENT" | sed "s/'/''/g")', '$(echo "$TITLE" | sed "s/'/''/g")', '$NOW', '$NOW', $WORD_COUNT, '$NOTEBOOK_ID', 'active', 1, 1, 0);"

if [ $? -eq 0 ]; then
  echo "Note created: $TITLE (id: $ID)"
else
  echo "Error creating note" >&2
  exit 1
fi

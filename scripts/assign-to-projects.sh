#!/bin/bash

# Assign issues to GitHub Projects
# Run this in your terminal with the new token that has project scope

ROADMAP_PROJECT="PVT_kwHOBbEP1M4BLqFS"
EXECUTION_PROJECT="PVT_kwHOBbEP1M4BLqIv"

echo "🚀 Assigning issues to Projects..."

# Function to add issue to project
add_to_project() {
  local issue_number=$1
  local project_id=$2
  local project_name=$3

  # Get issue node ID
  issue_id=$(gh api graphql -f query="
    query {
      repository(owner: \"tomymaritano\", name: \"readide\") {
        issue(number: $issue_number) {
          id
        }
      }
    }
  " --jq '.data.repository.issue.id')

  # Add to project
  gh api graphql -f query="
    mutation {
      addProjectV2ItemById(input: {
        projectId: \"$project_id\"
        contentId: \"$issue_id\"
      }) {
        item {
          id
        }
      }
    }
  " > /dev/null 2>&1

  if [ $? -eq 0 ]; then
    echo "  ✅ #$issue_number → $project_name"
  else
    echo "  ❌ #$issue_number failed"
  fi
}

echo ""
echo "📋 Adding to Roadmap project..."
add_to_project 28 "$ROADMAP_PROJECT" "Roadmap"  # Auth & Backend
add_to_project 29 "$ROADMAP_PROJECT" "Roadmap"  # Cloud Sync
add_to_project 30 "$ROADMAP_PROJECT" "Roadmap"  # Code Signing
add_to_project 31 "$ROADMAP_PROJECT" "Roadmap"  # Marketing Launch

echo ""
echo "⚡ Adding to Execution project..."
add_to_project 32 "$EXECUTION_PROJECT" "Execution"  # Apple Developer
add_to_project 33 "$EXECUTION_PROJECT" "Execution"  # Windows signing
add_to_project 34 "$EXECUTION_PROJECT" "Execution"  # Sentry
add_to_project 35 "$EXECUTION_PROJECT" "Execution"  # ADR docs
add_to_project 36 "$EXECUTION_PROJECT" "Execution"  # License UI
add_to_project 37 "$EXECUTION_PROJECT" "Execution"  # Vercel deploy
add_to_project 38 "$EXECUTION_PROJECT" "Execution"  # Stripe

echo ""
echo "✨ Done! Check your projects:"
echo "   Roadmap: https://github.com/users/tomymaritano/projects/..."
echo "   Execution: https://github.com/users/tomymaritano/projects/..."

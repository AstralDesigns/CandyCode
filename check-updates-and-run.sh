#!/bin/bash

# This script checks for npm package updates, applies them if found, and then starts the app in development mode.

echo "Checking for npm package updates..."

# Run npm outdated to see which packages have updates available
# We use || true because npm outdated returns a non-zero exit code if updates are found
OUTDATED=$(npm outdated)

if [ -n "$OUTDATED" ]; then
    echo "Updates found:"
    echo "$OUTDATED"
    echo ""
    echo "Applying updates..."
    npm update
    echo "Updates applied successfully."
else
    echo "All packages are up to date."
fi

echo ""
echo "Starting AlphaStudio in development mode..."
echo "Running: npm run dev"

# Start the application
npm run dev

#!/bin/bash

# 🧹 VS Code Empty File Cleanup Script
# This script removes empty files that VS Code might restore

echo "🔍 Searching for empty files..."
EMPTY_COUNT=$(find /mnt/storage/project/MyExpress -type f -empty | wc -l)

if [ "$EMPTY_COUNT" -gt 0 ]; then
    echo "🚨 Found $EMPTY_COUNT empty files!"
    echo "📋 List of empty files:"
    find /mnt/storage/project/MyExpress -type f -empty

    echo ""
    read -p "❓ Delete all empty files? (y/N): " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️ Deleting empty files..."
        find /mnt/storage/project/MyExpress/ -type f -empty -delete

        echo "📁 Removing empty directories..."
        find /mnt/storage/project/MyExpress/ -type d -empty -delete

        echo "✅ Cleanup complete!"

        # Also clear VS Code history to prevent restoration
        if [ -d ~/.config/Code/User/History/ ]; then
            echo "🧹 Clearing VS Code history..."
            rm -rf ~/.config/Code/User/History/*
        fi

    else
        echo "❌ Cleanup cancelled"
    fi
else
    echo "✅ No empty files found!"
fi

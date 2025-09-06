#!/bin/bash

echo "Fixing syntax errors in test files..."

# Fix comma placement issues caused by previous script
for file in tests/unit/*.test.js tests/integration/*.test.js; do
  if [ -f "$file" ]; then
    # Fix pattern where comma is on its own line after a closing brace
    sed -i ':a;N;$!ba;s/}\n      ,\n      save:/,\n      save:}/g' "$file"
    
    # Fix pattern where there's a comma before save with wrong indentation
    sed -i 's/      ,$/,/g' "$file"
    sed -i 's/^\s*,\n\s*save:/, save:/g' "$file"
    
    # Fix doubled save methods
    sed -i 's/save: jest\.fn()\.mockResolvedValue(true)}, save:/}, save:/g' "$file"
    
    # Fix objects with misplaced commas before save
    perl -i -pe 's/\n\s+,\n\s+save:/, save:/g' "$file"
    
    # Fix specific pattern in test files
    perl -i -0pe 's/(\w+['"'"']\s*),\s*\n\s+save:/\1,\n      save:/g' "$file"
  fi
done

echo "Syntax errors fixed!"
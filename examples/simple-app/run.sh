#!/bin/bash
# Generate context for the simple-app example

echo "Generating context for simple-app..."
node ../../dist/cli/index.js . --out context.json

echo ""
echo "Context generated! Check context.json"
echo ""
echo "To validate:"
echo "node ../../dist/cli/validate-index.js context.json"

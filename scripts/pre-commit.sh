#!/bin/bash

echo "🚀 Running pre-commit checks..."

echo "✨ Running Prettier..."
npx prettier --write "**/*.js" "**/*.json"
if [ $? -ne 0 ]; then
  echo "❌ Prettier failed"
  exit 1
fi
echo "✅ Prettier passed"

echo "🔍 Running ESLint..."
npx eslint src/ --ext .js
if [ $? -ne 0 ]; then
  echo "❌ ESLint failed"
  exit 1
fi
echo "✅ ESLint passed"

echo "🎉 All checks passed! Ready to commit."

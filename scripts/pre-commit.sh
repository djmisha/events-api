#!/bin/bash

echo "🚀 Running pre-commit checks..."

echo "✨ Running Prettier..."
npx prettier --write "**/*.{js,ts,json}"
if [ $? -ne 0 ]; then
  echo "❌ Prettier failed"
  exit 1
fi
echo "✅ Prettier passed"

echo "🔍 Running ESLint on JavaScript files..."
npx eslint src/ --ext .js
if [ $? -ne 0 ]; then
  echo "❌ ESLint failed"
  exit 1
fi
echo "✅ ESLint passed"

echo "🔧 Running TypeScript compiler..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
  echo "❌ TypeScript compilation failed"
  exit 1
fi
echo "✅ TypeScript compilation passed"

echo "🎉 All checks passed! Ready to commit."

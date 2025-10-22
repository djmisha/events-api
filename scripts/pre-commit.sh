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
if find src -name "*.js" -type f | grep -q .; then
  npx eslint src/ --ext .js
  if [ $? -ne 0 ]; then
    echo "❌ ESLint (JS) failed"
    exit 1
  fi
  echo "✅ ESLint (JS) passed"
else
  echo "✅ ESLint (JS) skipped - no JS files found"
fi

echo "🔍 Running ESLint on TypeScript files..."
npx eslint src/ --ext .ts
if [ $? -ne 0 ]; then
  echo "❌ ESLint (TS) failed"
  exit 1
fi
echo "✅ ESLint (TS) passed"

echo "🔧 Running TypeScript compiler..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
  echo "❌ TypeScript compilation failed"
  exit 1
fi
echo "✅ TypeScript compilation passed"

echo "🎉 All checks passed! Ready to commit."

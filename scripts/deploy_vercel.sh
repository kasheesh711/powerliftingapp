#!/usr/bin/env bash

set -euo pipefail

TARGET="${1:-preview}"
if [[ "$TARGET" != "preview" && "$TARGET" != "production" ]]; then
  echo "Usage: $0 [preview|production]"
  exit 1
fi

for var in VERCEL_TOKEN VERCEL_ORG_ID VERCEL_PROJECT_ID; do
  if [[ -z "${!var:-}" ]]; then
    echo "Missing required env var: $var"
    exit 1
  fi
done

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI not found. Install with: npm install --global vercel@latest"
  exit 1
fi

if [[ "$TARGET" == "production" ]]; then
  ENVIRONMENT="production"
  PROD_FLAG="--prod"
else
  ENVIRONMENT="preview"
  PROD_FLAG=""
fi

echo "Running quality gates before deploy..."
npm run lint
npm run typecheck
npm run test
npm run build

echo "Pulling Vercel environment config for $ENVIRONMENT..."
vercel pull --yes --environment="$ENVIRONMENT" --token="$VERCEL_TOKEN"

echo "Building Vercel prebuilt artifacts..."
vercel build --token="$VERCEL_TOKEN"

echo "Deploying to Vercel ($TARGET)..."
vercel deploy $PROD_FLAG --prebuilt --token="$VERCEL_TOKEN"


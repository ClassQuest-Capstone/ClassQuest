#!/bin/bash

# Verification script for API stack split
# Run this after deployment to verify all routes are working

# In git bash run the following commands from the root folder:
# export VITE_API_URL="https://57fwtua1k9.execute-api.ca-central-1.amazonaws.com"
# echo $VITE_API_URL
# bash infra/verify-split.sh

API_URL="${VITE_API_URL:-}"

if [ -z "$API_URL" ]; then
    echo "ERROR: API_URL not set. Please export VITE_API_URL or pass as argument."
    echo "Usage: ./verify-split.sh <API_URL>"
    exit 1
fi

echo "=== Verifying API Stack Split ==="
echo "API URL: $API_URL"
echo ""

# Test health endpoint (QuestApiStack)
echo "Testing QuestApiStack routes..."
echo -n "  GET /health: "
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo "✓ OK"
else
    echo "✗ FAILED (HTTP $HEALTH_RESPONSE)"
fi

# Test schools endpoint (TeacherApiStack)
echo "Testing TeacherApiStack routes..."
echo -n "  GET /schools: "
SCHOOLS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/schools")
if [ "$SCHOOLS_RESPONSE" = "200" ] || [ "$SCHOOLS_RESPONSE" = "401" ]; then
    echo "✓ OK (HTTP $SCHOOLS_RESPONSE - route exists)"
else
    echo "✗ FAILED (HTTP $SCHOOLS_RESPONSE)"
fi

# Test quest templates endpoint (QuestApiStack)
echo "Testing QuestApiStack quest routes..."
echo -n "  GET /quest-templates/public: "
QUESTS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/quest-templates/public")
if [ "$QUESTS_RESPONSE" = "200" ] || [ "$QUESTS_RESPONSE" = "401" ]; then
    echo "✓ OK (HTTP $QUESTS_RESPONSE - route exists)"
else
    echo "✗ FAILED (HTTP $QUESTS_RESPONSE)"
fi

echo ""
echo "=== Verification Complete ==="
echo ""
echo "Note: 401 responses indicate the route exists but requires authentication."
echo "404 responses indicate the route does not exist (deployment issue)."

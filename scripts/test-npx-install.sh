#!/bin/bash
#
# Test npx installation of claude-transcript-viewer
#
# This script simulates what a new user would experience:
# 1. Create a temp directory
# 2. Copy test fixtures (or use provided transcripts)
# 3. Run the viewer via npx
# 4. Test that it works
# 5. Clean up
#
# Usage:
#   ./scripts/test-npx-install.sh              # Test local package
#   ./scripts/test-npx-install.sh --published  # Test published npm package
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_PORT=3098
TIMEOUT=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

cleanup() {
    log_info "Cleaning up..."
    if [ -n "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null || true
    fi
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}
trap cleanup EXIT

# Parse arguments
USE_PUBLISHED=false
if [ "$1" = "--published" ]; then
    USE_PUBLISHED=true
fi

# Create temp directory
TEMP_DIR=$(mktemp -d)
log_info "Created temp directory: $TEMP_DIR"

# Copy test fixtures
FIXTURES_SOURCE="$PROJECT_ROOT/tests/e2e/fixtures/source"
FIXTURES_DEST="$TEMP_DIR/transcripts"

if [ -d "$FIXTURES_SOURCE" ]; then
    cp -r "$FIXTURES_SOURCE" "$FIXTURES_DEST"
    log_info "Copied test fixtures to $FIXTURES_DEST"
else
    log_error "Test fixtures not found at $FIXTURES_SOURCE"
    log_info "Run the E2E tests first to generate fixtures"
    exit 1
fi

# Count files
FILE_COUNT=$(find "$FIXTURES_DEST" -name "*.jsonl" | wc -l | tr -d ' ')
log_info "Found $FILE_COUNT JSONL transcript files"

# Create archive directory (for HTML output)
ARCHIVE_DIR="$TEMP_DIR/archive"
mkdir -p "$ARCHIVE_DIR"

# Create database directory
DB_PATH="$TEMP_DIR/search.db"

cd "$TEMP_DIR"

# Install and run
if [ "$USE_PUBLISHED" = true ]; then
    log_info "Testing published npm package..."
    npx claude-transcript-viewer "$ARCHIVE_DIR" &
else
    log_info "Testing local package..."
    # Pack the local package
    cd "$PROJECT_ROOT"
    TARBALL=$(npm pack --pack-destination "$TEMP_DIR" 2>/dev/null | tail -1)
    cd "$TEMP_DIR"

    log_info "Installing from tarball: $TARBALL"
    npm init -y > /dev/null 2>&1
    npm install "$TARBALL" > /dev/null 2>&1

    # Run the viewer
    PORT=$TEST_PORT DATABASE_PATH="$DB_PATH" SOURCE_DIR="$FIXTURES_DEST" \
        npx claude-transcript-viewer "$ARCHIVE_DIR" "$FIXTURES_DEST" &
fi

SERVER_PID=$!
log_info "Started server with PID $SERVER_PID"

# Wait for server to be ready
log_info "Waiting for server to start..."
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    if curl -s "http://localhost:$TEST_PORT/api/index/status" > /dev/null 2>&1; then
        log_info "Server is ready!"
        break
    fi
    sleep 1
    ELAPSED=$((ELAPSED + 1))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    log_error "Server failed to start within $TIMEOUT seconds"
    exit 1
fi

# Wait for indexing to complete (if SOURCE_DIR was provided)
log_info "Waiting for indexing to complete..."
ELAPSED=0
while [ $ELAPSED -lt 60 ]; do
    STATUS=$(curl -s "http://localhost:$TEST_PORT/api/index/status")
    if echo "$STATUS" | grep -q '"status":"ready"'; then
        CHUNKS=$(echo "$STATUS" | grep -o '"chunks":[0-9]*' | grep -o '[0-9]*')
        CONVS=$(echo "$STATUS" | grep -o '"conversations":[0-9]*' | grep -o '[0-9]*')
        log_info "Indexing complete: $CONVS conversations, $CHUNKS chunks"
        break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

# Run tests
log_info "Running API tests..."
TESTS_PASSED=0
TESTS_FAILED=0

test_endpoint() {
    local name="$1"
    local url="$2"
    local expected="$3"

    RESPONSE=$(curl -s "$url")
    if echo "$RESPONSE" | grep -q "$expected"; then
        log_info "  ✓ $name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_error "  ✗ $name"
        log_error "    Expected: $expected"
        log_error "    Got: ${RESPONSE:0:200}..."
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Test landing page
test_endpoint "Landing page" "http://localhost:$TEST_PORT/" "Claude Transcript Viewer"

# Test search API
test_endpoint "Search API" "http://localhost:$TEST_PORT/api/search?q=function&limit=5" '"results"'

# Test projects API
test_endpoint "Projects API" "http://localhost:$TEST_PORT/api/projects" '"projects"'

# Test index status
test_endpoint "Index status" "http://localhost:$TEST_PORT/api/index/status" '"status":"ready"'

# Test search page
test_endpoint "Search page" "http://localhost:$TEST_PORT/search?q=test" "Search"

# Test filter by project
test_endpoint "Project filter" "http://localhost:$TEST_PORT/api/search?q=function&project=tools" '"results"'

# Test filter by role
test_endpoint "Role filter" "http://localhost:$TEST_PORT/api/search?q=help&role=user" '"results"'

# Summary
echo ""
log_info "Test Summary: $TESTS_PASSED passed, $TESTS_FAILED failed"

if [ $TESTS_FAILED -gt 0 ]; then
    log_error "Some tests failed!"
    exit 1
else
    log_info "All tests passed!"
    exit 0
fi

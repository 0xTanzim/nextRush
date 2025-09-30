#!/bin/bash

##############################################################################
# Autocannon Benchmark Runner Script
# Runs autocannon tests for all frameworks
##############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVERS_DIR="$PROJECT_ROOT/servers"
TESTS_DIR="$PROJECT_ROOT/tests/autocannon"
RESULTS_DIR="$PROJECT_ROOT/results"

FRAMEWORKS=("nextrush" "express" "koa" "fastify")
TESTS=("hello" "params" "query" "post" "mixed")
PORT=3000

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Autocannon Benchmark Suite          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Function to stop server gracefully
stop_server() {
    local pid=$1
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        echo -e "${YELLOW}⏹️  Stopping server (PID: $pid)...${NC}"
        kill "$pid" 2>/dev/null || true
        sleep 2

        # Force kill if still running
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null || true
        fi
        echo -e "${GREEN}✅ Server stopped${NC}"
    fi
}

# Function to wait for server
wait_for_server() {
    local max_wait=30
    local count=0

    echo -n "⏳ Waiting for server to be ready"

    while ! curl -s "http://localhost:$PORT" > /dev/null 2>&1; do
        if [ $count -ge $max_wait ]; then
            echo -e "\n${RED}❌ Server failed to start within ${max_wait}s${NC}"
            return 1
        fi
        echo -n "."
        sleep 1
        ((count++))
    done

    echo -e " ${GREEN}✅${NC}"
}

# Trap to cleanup on exit
trap 'stop_server $SERVER_PID' EXIT INT TERM

# Run benchmarks
for framework in "${FRAMEWORKS[@]}"; do
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}📦 Testing: $framework${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Start server
    echo -e "${GREEN}🚀 Starting $framework server...${NC}"
    NODE_ENV=production node "$SERVERS_DIR/$framework.js" > /dev/null 2>&1 &
    SERVER_PID=$!

    echo "Server PID: $SERVER_PID"

    # Wait for server to be ready
    if ! wait_for_server; then
        stop_server $SERVER_PID
        continue
    fi

    # Warmup
    echo -e "${YELLOW}🔥 Warming up (10s)...${NC}"
    curl -s "http://localhost:$PORT" > /dev/null 2>&1 || true
    sleep 10
    echo ""

    # Run each test
    for test in "${TESTS[@]}"; do
        echo -e "${BLUE}▶️  Running: $test${NC}"

        # Run test with proper error handling
        if node "$TESTS_DIR/${test}.js" "$framework" "$PORT"; then
            echo -e "${GREEN}✅ Completed: $test${NC}"
        else
            echo -e "${RED}❌ Failed: $test${NC}"
        fi

        echo ""

        # Short cooldown between tests
        sleep 2
    done

    # Stop server
    stop_server $SERVER_PID
    SERVER_PID=""

    # Cooldown between frameworks
    echo -e "${YELLOW}💤 Cooldown (3s)...${NC}"
    sleep 3
done

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Autocannon Benchmarks Complete! ✨   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "📊 Results saved to: ${BLUE}$RESULTS_DIR${NC}"
echo ""
echo -e "Run ${BLUE}pnpm analyze${NC} to generate report"
echo ""

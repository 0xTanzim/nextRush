#!/bin/bash

##############################################################################
# K6 Benchmark Runner Script
# Runs K6 load tests for all frameworks
##############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVERS_DIR="$PROJECT_ROOT/servers"
TESTS_DIR="$PROJECT_ROOT/tests/k6"
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
echo -e "${BLUE}║   K6 Performance Benchmark Suite      ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}❌ k6 is not installed!${NC}"
    echo "Install it from: https://k6.io/docs/get-started/installation/"
    exit 1
fi

echo -e "${GREEN}✅ k6 found: $(k6 version)${NC}\n"

# Function to stop server gracefully
stop_server() {
    local pid=$1
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        echo -e "${YELLOW}⏹  Stopping server (PID: $pid)...${NC}"
        kill "$pid" 2>/dev/null || true
        sleep 2

        # Force kill if still running
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null || true
        fi
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
    sleep 2 # Extra warmup time
}

# Trap to cleanup on exit
trap 'stop_server $SERVER_PID' EXIT INT TERM

# Run benchmarks
for framework in "${FRAMEWORKS[@]}"; do
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}📦 Testing: $framework${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Start server
    echo -e "${GREEN}🚀 Starting $framework server...${NC}"
    NODE_ENV=production node "$SERVERS_DIR/$framework.js" > /dev/null 2>&1 &
    SERVER_PID=$!

    # Wait for server to be ready
    if ! wait_for_server; then
        stop_server $SERVER_PID
        continue
    fi

    echo -e "${GREEN}✅ Server ready (PID: $SERVER_PID)${NC}\n"

    # Run warmup
    echo -e "${YELLOW}🔥 Warming up (10s)...${NC}"
    k6 run --vus 50 --duration 10s --quiet "$TESTS_DIR/hello.js" > /dev/null 2>&1 || true
    echo ""

    # Run each test
    for test in "${TESTS[@]}"; do
        echo -e "${BLUE}▶ Running: $test${NC}"

        # Run k6 test and capture output
        k6 run \
            --out json="$RESULTS_DIR/${framework}-${test}-k6.json" \
            "$TESTS_DIR/${test}.js" 2>&1 | grep -E "(scenarios:|default)" || true

        echo -e "${GREEN}✅ Completed: $test${NC}\n"

        # Cooldown between tests
        sleep 2
    done

    # Stop server
    stop_server $SERVER_PID
    SERVER_PID=""

    # Cooldown between frameworks
    echo -e "${YELLOW}💤 Cooldown (5s)...${NC}\n"
    sleep 5
done

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   K6 Benchmarks Complete! ✨           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "📊 Results saved to: ${BLUE}$RESULTS_DIR${NC}"
echo ""

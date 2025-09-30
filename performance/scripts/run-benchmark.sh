#!/bin/bash

# Performance Benchmark Runner
# Runs comprehensive benchmarks for NextRush v2, Express, Koa, and Fastify

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FRAMEWORKS=("nextrush" "express" "koa" "fastify")
TESTS=("hello" "params" "query" "post")
PORT=3000
WARMUP_TIME=10
COOLDOWN_TIME=5

echo -e "${BLUE}🚀 NextRush v2 Performance Benchmark Suite${NC}"
echo -e "${BLUE}===========================================${NC}\n"

# Create results directory
mkdir -p results

# Detect system info
echo -e "${YELLOW}📊 System Information:${NC}"
echo "CPU: $(lscpu | grep 'Model name' | cut -d ':' -f2 | xargs)"
echo "Cores: $(nproc)"
echo "RAM: $(free -h | awk '/^Mem:/ {print $2}')"
echo "Node.js: $(node --version)"
echo "OS: $(uname -s) $(uname -r)"
echo ""

# Function to start server
start_server() {
    local framework=$1
    echo -e "${GREEN}▶️  Starting ${framework} server...${NC}"
    NODE_ENV=production node "servers/${framework}.js" > "/dev/null" 2>&1 &
    SERVER_PID=$!
    echo "Server PID: $SERVER_PID"

    # Wait for server to be ready
    sleep ${WARMUP_TIME}

    # Check if server is running
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        echo -e "${RED}❌ Failed to start ${framework} server${NC}"
        return 1
    fi

    echo -e "${GREEN}✅ ${framework} server ready${NC}\n"
    return 0
}

# Function to stop server
stop_server() {
    if [ ! -z "$SERVER_PID" ]; then
        echo -e "${YELLOW}⏹️  Stopping server (PID: $SERVER_PID)...${NC}"
        kill -SIGTERM $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
        echo -e "${GREEN}✅ Server stopped${NC}\n"

        # Cooldown
        sleep ${COOLDOWN_TIME}
    fi
}

# Cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
    stop_server
}

trap cleanup EXIT INT TERM

# Run benchmarks for each framework
for framework in "${FRAMEWORKS[@]}"; do
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}Testing Framework: ${framework}${NC}"
    echo -e "${BLUE}================================================${NC}\n"

    # Start server
    if ! start_server "$framework"; then
        echo -e "${RED}Skipping ${framework} due to startup failure${NC}\n"
        continue
    fi

    # Run each test
    for test in "${TESTS[@]}"; do
        echo -e "${YELLOW}📝 Running ${test} test...${NC}"

        # Run autocannon test
        node "tests/autocannon/${test}.js" "$framework" "$PORT" > "results/${framework}-${test}-autocannon.json"

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ ${test} test completed${NC}\n"
        else
            echo -e "${RED}❌ ${test} test failed${NC}\n"
        fi
    done

    # Stop server
    stop_server
done

echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}✅ All benchmarks completed!${NC}"
echo -e "${BLUE}================================================${NC}\n"

# Generate report
echo -e "${YELLOW}📊 Generating analysis report...${NC}"
node scripts/analyze.js

echo -e "\n${GREEN}✨ Benchmark suite completed successfully!${NC}"
echo -e "${YELLOW}📁 Results saved in: ${PWD}/results/${NC}"
echo -e "${YELLOW}📊 Report: ${PWD}/results/BENCHMARK_RESULTS.md${NC}\n"

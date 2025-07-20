#!/bin/bash

# 🔥 Autocannon Professional Benchmarking Script
# Advanced HTTP load testing with multiple scenarios

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔥 Autocannon Professional Benchmark Suite${NC}"
echo "=============================================="

# Configuration
FRAMEWORK=${1:-"nextrush"}
PORT=${2:-3000}
BASE_URL="http://localhost:${PORT}"
OUTPUT_DIR="../results/autocannon"
DURATION=${DURATION:-30}
CONNECTIONS=${CONNECTIONS:-100}
RATE=${RATE:-1000}

echo -e "${YELLOW}Framework: ${FRAMEWORK}${NC}"
echo -e "${YELLOW}URL: ${BASE_URL}${NC}"
echo -e "${YELLOW}Duration: ${DURATION}s${NC}"
echo -e "${YELLOW}Connections: ${CONNECTIONS}${NC}"
echo -e "${YELLOW}Rate: ${RATE} req/s${NC}"
echo ""

# Ensure output directory exists
mkdir -p ${OUTPUT_DIR}

# Function to run autocannon test
run_test() {
    local name=$1
    local path=$2
    local extra_args=$3

    echo -e "${BLUE}📊 Running ${name} test...${NC}"

    autocannon \
        -c ${CONNECTIONS} \
        -d ${DURATION} \
        -R ${RATE} \
        --json \
        ${extra_args} \
        ${BASE_URL}${path} > ${OUTPUT_DIR}/${FRAMEWORK}-${name,,}.json

    # Extract key metrics
    local rps=$(cat ${OUTPUT_DIR}/${FRAMEWORK}-${name,,}.json | jq '.requests.average')
    local latency=$(cat ${OUTPUT_DIR}/${FRAMEWORK}-${name,,}.json | jq '.latency.average')
    local p99=$(cat ${OUTPUT_DIR}/${FRAMEWORK}-${name,,}.json | jq '.latency.p99')

    echo -e "${GREEN}  ✅ ${name}: ${rps} RPS, ${latency}ms avg, ${p99}ms p99${NC}"
}

# Function to run custom scenario
run_custom_scenario() {
    local name=$1
    local script=$2

    echo -e "${BLUE}📊 Running ${name} scenario...${NC}"

    autocannon \
        -c ${CONNECTIONS} \
        -d ${DURATION} \
        --json \
        ${script} > ${OUTPUT_DIR}/${FRAMEWORK}-${name,,}.json

    local rps=$(cat ${OUTPUT_DIR}/${FRAMEWORK}-${name,,}.json | jq '.requests.average')
    echo -e "${GREEN}  ✅ ${name}: ${rps} RPS${NC}"
}

# Wait for server to be ready
echo -e "${YELLOW}🔄 Waiting for server to be ready...${NC}"
for i in {1..30}; do
    if curl -s ${BASE_URL} > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Server is ready${NC}"
        break
    fi
    sleep 1
done

# Warmup
echo -e "${YELLOW}🔥 Warming up server...${NC}"
autocannon -c 10 -d 5 ${BASE_URL} > /dev/null 2>&1

echo ""
echo -e "${BLUE}🚀 Starting benchmark tests...${NC}"
echo ""

# Basic tests
run_test "Basic" "/" ""
run_test "JSON" "/json" ""
run_test "Plaintext" "/plaintext" ""
run_test "Parameters" "/users/123/posts/456" ""
run_test "Query" "/search?q=test&page=1&limit=10" ""
run_test "Health" "/health" ""

# Stress tests with different connection counts
echo ""
echo -e "${BLUE}🔥 Running stress tests...${NC}"

# Low concurrency, high rate
echo -e "${YELLOW}📊 Low concurrency test (10 connections, high rate)...${NC}"
autocannon \
    -c 10 \
    -d ${DURATION} \
    -R 2000 \
    --json \
    ${BASE_URL} > ${OUTPUT_DIR}/${FRAMEWORK}-low-concurrency.json

# High concurrency, moderate rate
echo -e "${YELLOW}📊 High concurrency test (500 connections)...${NC}"
autocannon \
    -c 500 \
    -d ${DURATION} \
    -R 1000 \
    --json \
    ${BASE_URL} > ${OUTPUT_DIR}/${FRAMEWORK}-high-concurrency.json

# Pipeline test
echo -e "${YELLOW}📊 Pipeline test (10 pipelined requests)...${NC}"
autocannon \
    -c ${CONNECTIONS} \
    -d ${DURATION} \
    -p 10 \
    --json \
    ${BASE_URL} > ${OUTPUT_DIR}/${FRAMEWORK}-pipeline.json

# POST request test (if framework supports it)
echo -e "${YELLOW}📊 POST request test...${NC}"
autocannon \
    -c ${CONNECTIONS} \
    -d ${DURATION} \
    -m POST \
    -H "content-type=application/json" \
    -b '{"test": "data", "timestamp": '$(date +%s)'}' \
    --json \
    ${BASE_URL}/data > ${OUTPUT_DIR}/${FRAMEWORK}-post.json 2>/dev/null || echo "POST test skipped"

echo ""
echo -e "${GREEN}🎉 Autocannon benchmark complete!${NC}"
echo -e "${BLUE}📁 Results saved to: ${OUTPUT_DIR}/${NC}"

# Generate summary
echo ""
echo -e "${BLUE}📊 Quick Summary:${NC}"
echo "=================="

for file in ${OUTPUT_DIR}/${FRAMEWORK}-*.json; do
    if [ -f "$file" ]; then
        local test_name=$(basename "$file" .json | sed "s/${FRAMEWORK}-//")
        local rps=$(cat "$file" | jq -r '.requests.average // "N/A"')
        local latency=$(cat "$file" | jq -r '.latency.average // "N/A"')
        printf "%-15s: %8s RPS, %6s ms\n" "$test_name" "$rps" "$latency"
    fi
done

echo ""
echo -e "${YELLOW}💡 Use 'node ../src/analyzer.js' to generate detailed analysis${NC}"

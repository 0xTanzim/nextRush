#!/bin/bash

##############################################################################
# Complete Benchmark Suite Runner
# Runs BOTH autocannon AND k6 tests, then generates comprehensive report
##############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

echo -e "${MAGENTA}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║     🚀 NextRush v2 Complete Benchmark Suite 🚀          ║"
echo "║                                                          ║"
echo "║     Autocannon + K6 + Analysis + Comparison Report      ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

# Step 1: Autocannon Benchmarks
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}   STEP 1: Autocannon HTTP Benchmarks                   ${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}📊 Running autocannon tests for all frameworks...${NC}"
echo -e "${YELLOW}   (100 connections, 40s duration, pipelining 10)${NC}\n"

cd "$PROJECT_ROOT"

if bash tests/autocannon/run-all.sh; then
    echo -e "\n${GREEN}✅ Autocannon benchmarks completed successfully!${NC}\n"
else
    echo -e "\n${RED}❌ Autocannon benchmarks failed!${NC}\n"
    exit 1
fi

# Step 2: K6 Load Tests
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}   STEP 2: K6 Load Tests                                ${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}📊 Running K6 load tests for all frameworks...${NC}"
echo -e "${YELLOW}   (100 VUs, 60s duration)${NC}\n"

if command -v k6 &> /dev/null; then
    if bash tests/k6/run-all.sh; then
        echo -e "\n${GREEN}✅ K6 load tests completed successfully!${NC}\n"
    else
        echo -e "\n${YELLOW}⚠️  K6 load tests had some issues${NC}\n"
    fi
else
    echo -e "${YELLOW}⚠️  K6 not installed, skipping K6 tests${NC}"
    echo -e "${YELLOW}   Install from: https://k6.io/docs/get-started/installation/${NC}\n"
fi

# Step 3: Analysis
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}   STEP 3: Results Analysis                             ${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}📊 Analyzing autocannon results...${NC}\n"

if node scripts/analyze.js; then
    echo -e "\n${GREEN}✅ Analysis completed!${NC}\n"
else
    echo -e "\n${YELLOW}⚠️  Analysis had some issues${NC}\n"
fi

# Step 4: Comprehensive Report
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}   STEP 4: Generate Comprehensive Report                ${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}📝 Generating comprehensive benchmark report...${NC}\n"

if node scripts/generate-report.js; then
    echo -e "\n${GREEN}✅ Report generated!${NC}\n"
else
    echo -e "\n${YELLOW}⚠️  Report generation had some issues${NC}\n"
fi

# Summary
echo -e "${MAGENTA}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║              ✨ BENCHMARK SUITE COMPLETE! ✨            ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

echo -e "${GREEN}📊 Results Files:${NC}"
echo -e "   ${BLUE}results/BENCHMARK_RESULTS.md${NC}     - Autocannon analysis"
echo -e "   ${BLUE}results/BENCHMARK_REPORT.md${NC}      - Comprehensive report"
echo ""
echo -e "${GREEN}📁 Raw Data:${NC}"
echo -e "   ${BLUE}results/*-autocannon.json${NC}        - Autocannon results"
echo -e "   ${BLUE}results/*-k6.json${NC}                - K6 results"
echo ""
echo -e "${CYAN}🎉 View your results:${NC}"
echo -e "   ${YELLOW}cat results/BENCHMARK_RESULTS.md${NC}"
echo -e "   ${YELLOW}cat results/BENCHMARK_REPORT.md${NC}"
echo ""

#!/bin/bash

# 🚀 Extreme Performance Benchmark Runner
# This script runs aggressive benchmarks to better differentiate framework performance

set -e

echo "🔥 Starting Extreme Performance Benchmark Suite"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Change to benchmark directory
cd "$(dirname "$0")"

# Clean previous results
echo -e "${YELLOW}🧹 Cleaning previous results...${NC}"
rm -rf results/*
mkdir -p results/{autocannon,artillery,k6,clinic,comparison}

# Check if required tools are installed
echo -e "${BLUE}🔧 Checking required tools...${NC}"

# Install tools if not present
if ! command -v autocannon &> /dev/null; then
    echo -e "${YELLOW}📦 Installing autocannon...${NC}"
    npm install autocannon
fi

if ! command -v artillery &> /dev/null; then
    echo -e "${YELLOW}📦 Installing artillery...${NC}"
    npm install artillery
fi

# Check if k6 is available globally
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}⚠️  K6 not found globally. Installing via package manager...${NC}"
    # Try to install k6 based on the system
    if command -v apt-get &> /dev/null; then
        echo "Installing k6 on Debian/Ubuntu..."
        sudo gpg -k
        sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install k6
    elif command -v yum &> /dev/null; then
        echo "Installing k6 on CentOS/RHEL..."
        sudo dnf install https://dl.k6.io/rpm/repo.rpm
        sudo dnf install k6
    elif command -v brew &> /dev/null; then
        echo "Installing k6 on macOS..."
        brew install k6
    else
        echo -e "${RED}❌ Cannot install k6 automatically. Please install it manually from https://k6.io/docs/getting-started/installation/${NC}"
        echo "Continuing without k6..."
    fi
fi

echo -e "${GREEN}✅ Tool check complete${NC}"

# Build the project first
echo -e "${BLUE}🔨 Building NextRush project...${NC}"
cd ../
npm run build || {
    echo -e "${RED}❌ Build failed. Please fix build errors first.${NC}"
    exit 1
}
cd professional-benchmarks/

# Install benchmark dependencies
echo -e "${BLUE}📦 Installing benchmark dependencies...${NC}"
npm install || {
    echo -e "${RED}❌ Failed to install dependencies.${NC}"
    exit 1
}

# Run the extreme benchmark with aggressive settings
echo -e "${GREEN}🚀 Starting extreme benchmark with aggressive settings...${NC}"
echo "Configuration:"
echo "  - Duration: 60 seconds per tool"
echo "  - Connections: 500"
echo "  - Target Rate: 5000 RPS"
echo "  - Frameworks: NextRush, Express, Fastify"
echo "  - Tools: Autocannon, Artillery, K6, Clinic.js"
echo ""

# Run the orchestrator with extreme settings
node src/orchestrator.js \
    --duration 60 \
    --connections 500 \
    --framework nextrush,express,fastify \
    --tools autocannon,artillery,k6,clinic || {
    echo -e "${RED}❌ Benchmark failed. Check the logs above.${NC}"
    exit 1
}

echo ""
echo -e "${GREEN}🎉 Extreme benchmark complete!${NC}"
echo -e "${BLUE}📊 Results saved to: results/${NC}"
echo ""

# Show quick summary if available
if [ -f "results/benchmark-report.md" ]; then
    echo -e "${YELLOW}📈 Quick Results Summary:${NC}"
    echo "================================"
    grep -A 10 "Performance Comparison" results/benchmark-report.md || true
    echo ""
    echo -e "${BLUE}🔗 Full report: results/benchmark-report.html${NC}"
    echo -e "${BLUE}🔗 Markdown report: results/benchmark-report.md${NC}"
fi

echo ""
echo -e "${GREEN}✨ Benchmark suite completed successfully!${NC}"

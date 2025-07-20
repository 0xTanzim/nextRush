#!/bin/bash

# 🚀 NextRush Complete Benchmark Suite
# Runs comprehensive benchmarks and generates reports

set -e

echo "🚀 NextRush Complete Benchmark Suite"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to log with colors
log_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_header() {
    echo -e "${PURPLE}🔥 $1${NC}"
}

# Check if benchmark is built
if [ ! -f "dist/index.js" ]; then
    log_warning "Benchmark not built. Building now..."
    pnpm run build
fi

# Create results directory
mkdir -p results

# Get current timestamp
timestamp=$(date +"%Y-%m-%d_%H-%M-%S")

log_header "Running Individual Framework Benchmarks"

# Test individual frameworks
frameworks=("nextrush" "express" "fastify" "koa" "hapi")

for framework in "${frameworks[@]}"; do
    log_info "Testing $framework individually..."
    timeout 60 ./run-benchmark.sh "$framework" || log_warning "$framework test completed with warnings"
    log_success "$framework individual test completed"
done

log_header "Running Comparison Benchmarks"

# NextRush vs Popular Frameworks
log_info "NextRush vs Express (most popular)"
timeout 90 ./run-benchmark.sh nextrush express || log_warning "NextRush vs Express completed with warnings"

log_info "NextRush vs Fastify (performance leader)"
timeout 90 ./run-benchmark.sh nextrush fastify || log_warning "NextRush vs Fastify completed with warnings"

log_info "NextRush vs All Frameworks"
timeout 180 ./run-benchmark.sh nextrush express fastify koa hapi || log_warning "Complete comparison completed with warnings"

log_header "Performance Analysis"

# Check if reports exist and show summary
if [ -f "results/benchmark-$(date +%Y-%m-%d).json" ]; then
    log_success "Latest benchmark reports generated:"
    ls -la results/benchmark-$(date +%Y-%m-%d).* 2>/dev/null || log_info "Reports from today not found, showing latest:"
    ls -la results/benchmark-*.* | tail -3
else
    log_info "Showing latest benchmark reports:"
    ls -la results/ | tail -5
fi

log_header "Benchmark Suite Completed!"
echo ""
echo "📊 View results:"
echo "   • Markdown: results/benchmark-$(date +%Y-%m-%d).md"
echo "   • CSV: results/benchmark-$(date +%Y-%m-%d).csv"
echo "   • JSON: results/benchmark-$(date +%Y-%m-%d).json"
echo ""
echo "🔍 Next steps:"
echo "   • Analyze NextRush performance bottlenecks"
echo "   • Optimize routing and middleware stack"
echo "   • Compare memory usage patterns"
echo "   • Profile CPU-intensive operations"

exit 0

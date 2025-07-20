#!/bin/bash

# 🚀 NextRush Benchmark Runner
#
# Easy script to run modular benchmarks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

print_header() {
    echo -e "${BLUE}🚀 $1${NC}"
}

# Change to benchmark directory
cd "$(dirname "$0")"

print_header "NextRush Modular Benchmark Runner"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Are you in the benchmark directory?"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    print_warning "Dependencies not found. Installing..."
    pnpm install
fi

# Build if needed
if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
    print_info "Building TypeScript..."
    pnpm run build
fi

# Ensure results directory exists
mkdir -p results

# Check if any arguments provided
if [ $# -eq 0 ]; then
    print_info "No frameworks specified, running all available frameworks..."
    node dist/index.js
else
    case "$1" in
        --help|-h)
            print_info "NextRush Benchmark Runner Usage:"
            echo ""
            echo "  ./run-benchmark.sh                    # Run all available frameworks"
            echo "  ./run-benchmark.sh nextrush express   # Run specific frameworks"
            echo "  ./run-benchmark.sh --list             # List available frameworks"
            echo "  ./run-benchmark.sh --install-all      # Install all framework dependencies"
            echo "  ./run-benchmark.sh --clean            # Clean and rebuild"
            echo ""
            echo "Supported frameworks: nextrush, express, fastify, koa, hapi"
            echo ""
            echo "Environment variables:"
            echo "  BENCHMARK_WARMUP=100      # Warmup requests"
            echo "  BENCHMARK_TIMEOUT=30000   # Request timeout (ms)"
            echo "  BENCHMARK_CONCURRENCY=50  # Max concurrency"
            ;;
        --list|-l)
            print_info "Listing available frameworks..."
            node dist/index.js --list
            ;;
        --install-all)
            print_info "Installing all framework dependencies..."
            pnpm add express fastify koa @koa/router koa-bodyparser @hapi/hapi
            print_success "All frameworks installed!"
            ;;
        --clean)
            print_info "Cleaning build artifacts..."
            rm -rf dist node_modules
            print_info "Reinstalling dependencies..."
            pnpm install
            print_info "Rebuilding..."
            pnpm run build
            print_success "Clean rebuild complete!"
            ;;
        *)
            print_info "Running benchmark for: $*"
            node dist/index.js "$@"
            ;;
    esac
fi

# Check if results were generated
if [ -d "results" ] && [ "$(ls -A results 2>/dev/null)" ]; then
    print_success "Benchmark completed successfully!"
    print_info "Results saved to ./results/ directory"

    # Show latest results
    latest_md=$(ls -t results/*.md 2>/dev/null | head -1)
    if [ -n "$latest_md" ]; then
        print_info "Latest report: $latest_md"

        # Ask if user wants to view the report
        if command -v less >/dev/null 2>&1; then
            read -p "View report now? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                less "$latest_md"
            fi
        fi
    fi
else
    print_warning "No results generated. Check the output above for errors."
fi

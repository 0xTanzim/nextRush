#!/bin/bash

##############################################################################
# Quick Benchmark Script - Fast Development Testing
# Runs reduced-duration tests for rapid feedback
##############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

echo -e "${MAGENTA}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║          ⚡ NextRush Quick Benchmark (5 min) ⚡          ║"
echo "║                                                          ║"
echo "║   Reduced duration for fast development feedback        ║"
echo "║                                                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

echo -e "${YELLOW}📊 Configuration:${NC}"
echo "   • Duration: 10s per test (vs 40s normal)"
echo "   • Frameworks: NextRush + Express (vs 4 frameworks)"
echo "   • Tests: All 5 scenarios"
echo "   • Estimated time: ~5 minutes"
echo ""

# Temporary modification: reduce frameworks and duration
export QUICK_MODE=1

cd "$PROJECT_ROOT"

# Create a temporary modified script
cat > /tmp/quick-autocannon.sh << 'EOF'
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVERS_DIR="$PROJECT_ROOT/servers"
TESTS_DIR="$PROJECT_ROOT/tests/autocannon"
RESULTS_DIR="$PROJECT_ROOT/results"

# QUICK MODE: Only 2 frameworks
FRAMEWORKS=("nextrush" "express")
TESTS=("hello" "params" "query" "post" "mixed")
PORT=3000

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}⚡ Quick Benchmark Mode${NC}\n"

stop_server() {
    local pid=$1
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        sleep 1
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null || true
        fi
    fi
}

wait_for_server() {
    local max_wait=15
    local count=0
    echo -n "⏳ Waiting"
    while ! curl -s "http://localhost:$PORT" > /dev/null 2>&1; do
        if [ $count -ge $max_wait ]; then
            echo -e "\n${RED}❌ Timeout${NC}"
            return 1
        fi
        echo -n "."
        sleep 1
        ((count++))
    done
    echo -e " ${GREEN}✅${NC}"
}

trap 'stop_server $SERVER_PID' EXIT INT TERM

for framework in "${FRAMEWORKS[@]}"; do
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}📦 Testing: $framework${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    echo -e "${GREEN}🚀 Starting server...${NC}"
    NODE_ENV=production node "$SERVERS_DIR/$framework.js" > /dev/null 2>&1 &
    SERVER_PID=$!

    if ! wait_for_server; then
        stop_server $SERVER_PID
        continue
    fi

    echo -e "${YELLOW}🔥 Warmup (5s)...${NC}"
    sleep 5

    for test in "${TESTS[@]}"; do
        echo -e "${BLUE}▶️  $test${NC}"
        # Modified test runner with 10s duration
        npx autocannon -c 100 -d 10 -p 10 \
            "http://localhost:$PORT$(case $test in
                params) echo "/users/123" ;;
                query) echo "/search?q=test&limit=10" ;;
                post) echo " -m POST -H 'content-type: application/json' -b '{\"name\":\"test\"}'" ;;
                mixed) echo "/" ;;
                *) echo "/" ;;
            esac)" > "$RESULTS_DIR/${framework}-${test}-quick.txt" 2>&1
        echo -e "${GREEN}✅${NC}"
        sleep 1
    done

    stop_server $SERVER_PID
    SERVER_PID=""
    sleep 2
done

echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Quick Benchmark Complete! ⚡         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
EOF

chmod +x /tmp/quick-autocannon.sh
bash /tmp/quick-autocannon.sh

# Generate quick summary
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}   Quick Results Summary                  ${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

for framework in "nextrush" "express"; do
    echo -e "${YELLOW}$framework:${NC}"
    if [ -f "$PROJECT_ROOT/results/${framework}-hello-quick.txt" ]; then
        grep -A 1 "Req/Sec" "$PROJECT_ROOT/results/${framework}-hello-quick.txt" | tail -1 || echo "  No data"
    fi
    echo ""
done

echo -e "${GREEN}📁 Results saved to: ${BLUE}results/*-quick.txt${NC}"
echo ""
echo -e "${YELLOW}💡 For full benchmarks, run:${NC} pnpm bench"
echo ""

#!/bin/bash

# 🚀 QUICK MAX RPS FINDER - Find Absolute Limits Fast!
#
# This script quickly finds the maximum RPS each framework can handle
# by running unlimited RPS tests with escalating connection counts.

set -e

echo "🚀 QUICK MAX RPS FINDER - UNLIMITED PERFORMANCE TEST"
echo "===================================================="
echo ""

# Kill existing processes
killall node 2>/dev/null || true
sleep 1

# Quick test function
test_max_rps() {
    local framework=$1
    local port=$2

    echo "🔥 Testing $framework maximum RPS..."

    # Start server
    node "adapters/${framework}.js" "$port" &
    local server_pid=$!
    sleep 2

    # Quick escalating tests to find breaking point
    local connections_list=(50 100 200 400 800 1200 1600 2000)
    local max_rps=0
    local best_connections=0

    for connections in "${connections_list[@]}"; do
        echo "   Testing $connections connections..."

        # Run 15-second unlimited RPS test
        if result=$(timeout 20 npx autocannon -c "$connections" -d 15 --json "http://localhost:$port/" 2>/dev/null); then
            rps=$(echo "$result" | jq -r '.requests.average // 0' 2>/dev/null || echo "0")
            latency=$(echo "$result" | jq -r '.latency.average // 0' 2>/dev/null || echo "0")
            errors=$(echo "$result" | jq -r '.errors // 0' 2>/dev/null || echo "0")

            echo "      → $rps RPS, ${latency}ms latency, $errors errors"

            # Check if this is the best result
            if (( $(echo "$rps > $max_rps" | bc -l 2>/dev/null || echo "0") )); then
                max_rps=$rps
                best_connections=$connections
            fi

            # Stop if too many errors or very high latency
            if (( $(echo "$errors > 50" | bc -l 2>/dev/null || echo "0") )) || (( $(echo "$latency > 500" | bc -l 2>/dev/null || echo "0") )); then
                echo "      ⚠️ Breaking point reached (errors: $errors, latency: ${latency}ms)"
                break
            fi
        else
            echo "      ❌ Test failed - server overloaded"
            break
        fi
    done

    # Cleanup
    kill "$server_pid" 2>/dev/null || true
    sleep 1

    echo "   🏆 $framework MAX: $max_rps RPS (at $best_connections connections)"
    echo ""

    # Return results
    echo "$framework:$max_rps:$best_connections"
}

echo "Starting quick maximum RPS tests (15s each)..."
echo ""

# Test all frameworks
results=()

# NextRush
result=$(test_max_rps "nextrush" 3000)
results+=("$result")

# Express
result=$(test_max_rps "express" 3001)
results+=("$result")

# Fastify
result=$(test_max_rps "fastify" 3002)
results+=("$result")

# Final cleanup
killall node 2>/dev/null || true

# Generate comparison
echo "🏆 QUICK MAX RPS COMPARISON RESULTS"
echo "=================================="
echo ""

declare -A framework_rps
winner_framework=""
winner_rps=0

for result in "${results[@]}"; do
    IFS=':' read -r framework rps connections <<< "$result"
    framework_rps["$framework"]="$rps"

    echo "📊 $framework: $rps RPS (optimal: $connections connections)"

    # Find winner
    if (( $(echo "$rps > $winner_rps" | bc -l 2>/dev/null || echo "0") )); then
        winner_rps=$rps
        winner_framework=$framework
    fi
done

echo ""
echo "🥇 WINNER: $winner_framework with $winner_rps RPS!"
echo ""

# Calculate performance differences
echo "📈 Performance Differences:"
for framework in "${!framework_rps[@]}"; do
    rps="${framework_rps[$framework]}"
    if [ "$framework" != "$winner_framework" ]; then
        diff=$(echo "$winner_rps - $rps" | bc -l 2>/dev/null || echo "0")
        percent=$(echo "scale=1; ($diff / $winner_rps) * 100" | bc -l 2>/dev/null || echo "0")
        echo "   $winner_framework vs $framework: +$diff RPS (+${percent}% faster)"
    fi
done

echo ""
echo "✅ Quick max RPS test complete!"
echo "💡 For detailed analysis, run: ./run-ultimate-stress-test.sh"

#!/bin/bash

# 🦊 SIMPLE FOX TEST - Find Maximum RPS with Apache Bench
# No complex monitoring, just pure RPS testing!

set -e

echo "🦊🦊🦊 SIMPLE FOX TEST - MAXIMUM RPS FINDER! 🦊🦊🦊"
echo "==================================================="
echo ""

# System Info
echo "💻 SYSTEM SPECS:"
echo "🖥️  CPU: $(grep 'model name' /proc/cpuinfo | head -1 | cut -d':' -f2 | xargs)"
echo "🧠 RAM: $(free -h | grep '^Mem:' | awk '{print $2}') total"
echo "⚡ Node.js: $(node --version)"
echo ""

# Clean up
echo "🧹 Cleaning up processes..."
killall node 2>/dev/null || true
killall ab 2>/dev/null || true
sleep 2

# Test configurations
FRAMEWORKS=("nextrush" "express" "fastify")
PORTS=(3000 3001 3002)
CONNECTIONS=(50 100 200 500 1000 1500 2000 3000 5000)
REQUESTS=10000
TIMEOUT=60
RESULTS_DIR="./results/simple-fox-test"

mkdir -p "$RESULTS_DIR"

# Function to test one configuration
test_framework() {
    local framework=$1
    local port=$2
    local connections=$3

    echo "🔥 Testing $framework with $connections connections..."

    # Start server
    echo "   🚀 Starting $framework server..."
    node "adapters/${framework}.js" "$port" &
    local server_pid=$!

    # Wait for server
    sleep 3

    # Check if server is running
    if ! kill -0 $server_pid 2>/dev/null; then
        echo "   ❌ Server failed to start"
        return 1
    fi

    # Test with Apache Bench
    echo "   📊 Running Apache Bench test..."
    local ab_result
    local test_success=true

    ab_result=$(timeout $TIMEOUT ab -n $REQUESTS -c $connections -q \
        "http://localhost:$port/" 2>/dev/null) || test_success=false

    if [ "$test_success" = true ] && [ -n "$ab_result" ]; then
        # Extract RPS
        local rps=$(echo "$ab_result" | grep "Requests per second" | awk '{print $4}' | head -1)
        local latency=$(echo "$ab_result" | grep "Time per request" | head -1 | awk '{print $4}')
        local failed=$(echo "$ab_result" | grep "Failed requests" | awk '{print $3}')

        # Default values if parsing fails
        rps=${rps:-0}
        latency=${latency:-0}
        failed=${failed:-0}

        echo "   ✅ Results: ${rps} RPS, ${latency}ms latency, ${failed} failed"

        # Save result
        echo "${framework},${connections},${rps},${latency},${failed}" >> "$RESULTS_DIR/results.csv"

        # Check for issues
        if (( $(echo "$failed > 50" | bc -l 2>/dev/null || echo "0") )); then
            echo "   ⚠️  High failure rate detected!"
        fi

    else
        echo "   ❌ Test failed - timeout or server crash"
        echo "${framework},${connections},0,0,FAILED" >> "$RESULTS_DIR/results.csv"
    fi

    # Cleanup
    kill $server_pid 2>/dev/null || true
    sleep 2
    killall node 2>/dev/null || true
    sleep 1
}

# Create CSV header
echo "framework,connections,rps,latency,failed" > "$RESULTS_DIR/results.csv"

# Run tests for all frameworks
for framework_idx in "${!FRAMEWORKS[@]}"; do
    framework="${FRAMEWORKS[$framework_idx]}"
    port="${PORTS[$framework_idx]}"

    echo ""
    echo "🦊 TESTING FRAMEWORK: ${framework^^}"
    echo "=================================="

    max_rps=0
    optimal_connections=0
    breaking_point=0

    for connections in "${CONNECTIONS[@]}"; do
        if test_framework "$framework" "$port" "$connections"; then
            # Get the RPS from the last line of results
            current_rps=$(tail -1 "$RESULTS_DIR/results.csv" | cut -d',' -f3)

            # Track maximum RPS
            if (( $(echo "$current_rps > $max_rps" | bc -l 2>/dev/null || echo "0") )); then
                max_rps=$current_rps
                optimal_connections=$connections
            fi

            # Check if performance is declining significantly
            if [ "$max_rps" != "0" ] && (( $(echo "$current_rps < ($max_rps * 0.8)" | bc -l 2>/dev/null || echo "0") )); then
                echo "   📉 Performance declining, breaking point reached"
                breaking_point=$connections
                break
            fi
        else
            echo "   💥 Breaking point reached at $connections connections"
            breaking_point=$connections
            break
        fi
    done

    echo ""
    echo "📋 $framework SUMMARY:"
    echo "   🏆 Maximum RPS: $max_rps"
    echo "   🎯 Optimal Connections: $optimal_connections"
    echo "   🛑 Breaking Point: $breaking_point"
    echo ""
done

# Generate simple report
echo ""
echo "📊 GENERATING FINAL REPORT..."
echo "=============================="

# Find winner
winner_framework=""
winner_rps=0

echo ""
echo "🏆 ULTIMATE FOX TEST RESULTS:"
echo "=============================="

while IFS=',' read -r framework connections rps latency failed; do
    if [ "$framework" != "framework" ] && [ "$rps" != "0" ] && [ "$rps" != "FAILED" ]; then
        if (( $(echo "$rps > $winner_rps" | bc -l 2>/dev/null || echo "0") )); then
            winner_rps=$rps
            winner_framework=$framework
        fi
    fi
done < "$RESULTS_DIR/results.csv"

# Show results for each framework
for framework in "${FRAMEWORKS[@]}"; do
    echo ""
    echo "📊 ${framework^^} RESULTS:"
    max_rps=0
    optimal_conn=0

    while IFS=',' read -r fw conn rps lat fail; do
        if [ "$fw" = "$framework" ] && [ "$rps" != "0" ] && [ "$rps" != "FAILED" ]; then
            echo "   $conn connections: ${rps} RPS (${lat}ms latency)"
            if (( $(echo "$rps > $max_rps" | bc -l 2>/dev/null || echo "0") )); then
                max_rps=$rps
                optimal_conn=$conn
            fi
        fi
    done < "$RESULTS_DIR/results.csv"

    if [ "$max_rps" != "0" ]; then
        echo "   🏆 PEAK: ${max_rps} RPS at ${optimal_conn} connections"

        if [ "$framework" = "$winner_framework" ]; then
            echo "   👑 OVERALL WINNER!"
        fi
    fi
done

echo ""
echo "🎉 SIMPLE FOX TEST COMPLETE!"
echo "============================"
echo "🏆 ABSOLUTE WINNER: ${winner_framework^^}"
echo "🚀 MAXIMUM RPS: $winner_rps"
echo ""
echo "📁 Detailed results: $RESULTS_DIR/results.csv"
echo ""
echo "🦊 Fox says: Test completed successfully! 🦊"

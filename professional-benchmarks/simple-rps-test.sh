#!/bin/bash

# 🚀 SIMPLE MAX RPS FINDER - No Dependencies, Pure Performance Test
#
# This script finds maximum RPS using basic curl and manual testing
# to avoid dependency issues that cause hanging.

set -e

echo "🚀 SIMPLE MAX RPS FINDER - PURE PERFORMANCE TEST"
echo "================================================"
echo ""

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
killall node 2>/dev/null || true
sleep 2

# Function to test if server is responding
test_server() {
    local port=$1
    local url="http://localhost:$port"

    # Simple curl test with timeout
    if timeout 3 curl -s "$url" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to run a simple RPS test using curl
simple_rps_test() {
    local framework=$1
    local port=$2
    local connections=$3

    echo "   🔥 Testing $framework with $connections concurrent connections..."

    # Start server
    timeout 30 node "adapters/${framework}.js" "$port" &
    local server_pid=$!

    # Wait for server to start
    local attempts=0
    while [ $attempts -lt 10 ]; do
        if test_server "$port"; then
            break
        fi
        sleep 1
        attempts=$((attempts + 1))
    done

    if [ $attempts -eq 10 ]; then
        echo "      ❌ Server failed to start"
        kill "$server_pid" 2>/dev/null || true
        return 1
    fi

    echo "      ✅ Server started successfully"

    # Use a simple approach: run curl in parallel and measure
    local start_time=$(date +%s.%N)
    local requests=100  # Fixed number of requests
    local url="http://localhost:$port/"

    echo "      📊 Running $requests requests with $connections parallel connections..."

    # Create temporary directory for results
    local temp_dir="/tmp/rps_test_$$"
    mkdir -p "$temp_dir"

    # Run parallel curl requests
    local success_count=0
    for ((i=1; i<=requests; i++)); do
        {
            if timeout 5 curl -s "$url" >/dev/null 2>&1; then
                echo "success" > "$temp_dir/result_$i"
            else
                echo "failure" > "$temp_dir/result_$i"
            fi
        } &

        # Limit concurrent connections
        if (( i % connections == 0 )); then
            wait  # Wait for this batch to complete
        fi
    done

    # Wait for all remaining requests
    wait

    local end_time=$(date +%s.%N)
    local duration=$(echo "$end_time - $start_time" | bc -l)

    # Count successes
    success_count=$(find "$temp_dir" -name "result_*" -exec grep -l "success" {} \; 2>/dev/null | wc -l)

    # Calculate RPS
    local rps=0
    if (( $(echo "$duration > 0" | bc -l) )); then
        rps=$(echo "scale=0; $success_count / $duration" | bc -l)
    fi

    echo "      📈 Results: $success_count/$requests successful, ${duration}s duration, ${rps} RPS"

    # Cleanup
    rm -rf "$temp_dir"
    kill "$server_pid" 2>/dev/null || true
    sleep 1

    echo "$rps"
}

# Function to test a framework with escalating connections
test_framework_max() {
    local framework=$1
    local port=$2

    echo ""
    echo "🔥 Testing $framework maximum RPS..."
    echo "-----------------------------------"

    local max_rps=0
    local best_connections=0
    local connection_levels=(10 20 50 100 200)

    for connections in "${connection_levels[@]}"; do
        rps=$(simple_rps_test "$framework" "$port" "$connections")

        if (( rps > max_rps )); then
            max_rps=$rps
            best_connections=$connections
        fi

        # If RPS is decreasing significantly, we've likely hit the limit
        if (( rps < max_rps / 2 )); then
            echo "      ⚠️ Performance degrading, stopping escalation"
            break
        fi
    done

    echo "   🏆 $framework MAX: $max_rps RPS (optimal: $best_connections connections)"
    echo "$framework:$max_rps:$best_connections"
}

# Alternative: Use Apache Bench (ab) if available
use_apache_bench() {
    local framework=$1
    local port=$2

    echo "🔥 Testing $framework with Apache Bench..."

    # Start server
    node "adapters/${framework}.js" "$port" &
    local server_pid=$!
    sleep 3

    # Test if server is responding
    if ! test_server "$port"; then
        echo "   ❌ Server not responding"
        kill "$server_pid" 2>/dev/null || true
        return
    fi

    # Run ab test if available
    if command -v ab >/dev/null 2>&1; then
        echo "   📊 Running Apache Bench test (1000 requests, 100 concurrent)..."

        local ab_output
        if ab_output=$(timeout 30 ab -n 1000 -c 100 "http://localhost:$port/" 2>/dev/null); then
            local rps=$(echo "$ab_output" | grep "Requests per second" | awk '{print $4}' | cut -d'.' -f1)
            local latency=$(echo "$ab_output" | grep "Time per request.*mean" | head -1 | awk '{print $4}')

            echo "   ✅ Results: $rps RPS, ${latency}ms average latency"
        else
            echo "   ❌ Apache Bench test failed"
        fi
    else
        echo "   ⚠️ Apache Bench not available, using curl method"
        test_framework_max "$framework" "$port"
    fi

    # Cleanup
    kill "$server_pid" 2>/dev/null || true
    sleep 1
}

echo "Starting simple performance tests..."
echo ""

# Check if Apache Bench is available for better testing
if command -v ab >/dev/null 2>&1; then
    echo "✅ Apache Bench detected - using for accurate RPS measurement"
    echo ""

    # Test with Apache Bench
    use_apache_bench "nextrush" 3000
    use_apache_bench "express" 3001
    use_apache_bench "fastify" 3002

else
    echo "⚠️ Apache Bench not available - using curl method (less accurate)"
    echo "💡 Install Apache Bench with: sudo apt-get install apache2-utils"
    echo ""

    # Test with curl method
    results=()
    results+=("$(test_framework_max "nextrush" 3000)")
    results+=("$(test_framework_max "express" 3001)")
    results+=("$(test_framework_max "fastify" 3002)")

    # Show comparison
    echo ""
    echo "🏆 SIMPLE RPS COMPARISON"
    echo "======================="

    for result in "${results[@]}"; do
        IFS=':' read -r framework rps connections <<< "$result"
        echo "📊 $framework: $rps RPS (optimal: $connections connections)"
    done
fi

# Final cleanup
echo ""
echo "🧹 Final cleanup..."
killall node 2>/dev/null || true

echo ""
echo "✅ Simple RPS test complete!"
echo "💡 For more accurate results, install Apache Bench: sudo apt-get install apache2-utils"

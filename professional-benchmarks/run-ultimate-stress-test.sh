#!/bin/bash

# 🦊 ULTIMATE FOX TEST - FIND ABSOLUTE MAXIMUM LIMITS!
#
# This test pushes frameworks to their ABSOLUTE BREAKING POINT:
# - UNLIMITED RPS (no rate limiting)
# - MASSIVE connection counts (100 → 5000+ connections)
# - REAL-TIME system monitoring (CPU, RAM, I/O, Network)
# - Memory leak detection with detailed analysis
# - Breaking point discovery with system specs
# - Hardware-specific performance profiling
# - Generate detailed HTML reports with graphs

set -e

echo "🦊🦊🦊 ULTIMATE FOX TEST - ABSOLUTE MAXIMUM LIMITS! 🦊🦊🦊"
echo "=========================================================="
echo ""

# System Information
echo "💻 SYSTEM SPECIFICATIONS:"
echo "========================="
echo "🖥️  CPU: $(grep 'model name' /proc/cpuinfo | head -1 | cut -d':' -f2 | xargs)"
echo "🧠 RAM: $(free -h | grep '^Mem:' | awk '{print $2}') total, $(free -h | grep '^Mem:' | awk '{print $7}') available"
echo "💾 Disk: $(df -h / | tail -1 | awk '{print $2}') total, $(df -h / | tail -1 | awk '{print $4}') free"
echo "🐧 OS: $(lsb_release -d | cut -f2)"
echo "⚡ Node.js: $(node --version)"
echo ""

# Kill any existing processes
echo "🧹 Killing existing processes and cleaning up..."
killall node 2>/dev/null || true
killall ab 2>/dev/null || true
sleep 3

# Test configurations - EXTREME SETTINGS
FRAMEWORKS=("nextrush" "express" "fastify")
PORTS=(3000 3001 3002)
# EXTREME CONNECTION ESCALATION - Find absolute breaking point!
CONNECTIONS=(50 100 200 500 1000 1500 2000 2500 3000 4000 5000)
REQUESTS_PER_TEST=5000  # High request count for accurate measurement
TIMEOUT=60  # 60 seconds timeout per test
RESULTS_DIR="./results/ultimate-fox-test"
SYSTEM_SPECS_FILE="$RESULTS_DIR/system-specs.json"

# Create results directory
mkdir -p "$RESULTS_DIR"
mkdir -p "$RESULTS_DIR/memory-analysis"
mkdir -p "$RESULTS_DIR/cpu-analysis"
mkdir -p "$RESULTS_DIR/system-monitoring"
mkdir -p "$RESULTS_DIR/breaking-points"
mkdir -p "$RESULTS_DIR/performance-graphs"

# Save system specifications
cat > "$SYSTEM_SPECS_FILE" << EOF
{
  "cpu_model": "$(grep 'model name' /proc/cpuinfo | head -1 | cut -d':' -f2 | xargs)",
  "cpu_cores": $(nproc),
  "cpu_threads": $(grep -c ^processor /proc/cpuinfo),
  "ram_total_gb": $(free -g | grep '^Mem:' | awk '{print $2}'),
  "ram_available_gb": $(free -g | grep '^Mem:' | awk '{print $7}'),
  "disk_total_gb": "$(df -BG / | tail -1 | awk '{print $2}' | sed 's/G//')",
  "disk_free_gb": "$(df -BG / | tail -1 | awk '{print $4}' | sed 's/G//')",
  "os_version": "$(lsb_release -d | cut -f2)",
  "node_version": "$(node --version)",
  "test_timestamp": "$(date -Iseconds)",
  "max_file_descriptors": $(ulimit -n),
  "max_processes": $(ulimit -u)
}
EOF

echo "📊 Test Configuration:"
echo "   - Frameworks: ${FRAMEWORKS[*]}"
echo "   - Connection escalation: ${CONNECTIONS[*]}"
echo "   - Requests per test: ${REQUESTS_PER_TEST}"
echo "   - Timeout per test: ${TIMEOUT}s"
echo "   - Target: FIND ABSOLUTE MAXIMUM RPS!"
echo ""

# Enhanced system monitoring function
start_system_monitoring() {
    local framework=$1
    local connections=$2
    local monitor_file="$RESULTS_DIR/system-monitoring/${framework}-${connections}conn-monitor.csv"

    echo "timestamp,cpu_percent,ram_used_mb,ram_available_mb,ram_percent,swap_used_mb,load_avg_1m,load_avg_5m,network_rx_mb,network_tx_mb,disk_io_read_mb,disk_io_write_mb,open_files,processes" > "$monitor_file"

    {
        while true; do
            timestamp=$(date '+%Y-%m-%d %H:%M:%S')

            # CPU usage (safer extraction)
            cpu_percent=$(top -bn1 | grep "Cpu(s)" | head -1 | sed 's/.*: *\([0-9.]*\)%us.*/\1/' 2>/dev/null || echo "0")

            # Memory usage
            ram_info=$(free -m | grep '^Mem:')
            ram_used=$(echo "$ram_info" | awk '{print $3}')
            ram_available=$(echo "$ram_info" | awk '{print $7}')
            ram_total=$(echo "$ram_info" | awk '{print $2}')
            ram_percent=$(echo "scale=2; ($ram_used * 100) / $ram_total" | bc -l)

            # Swap usage
            swap_used=$(free -m | grep '^Swap:' | awk '{print $3}')

            # Load average (safer parsing)
            load_avg=$(uptime | sed 's/.*load average: //' | awk '{print $1 "," $2}' | sed 's/,$//' 2>/dev/null || echo "0,0")
            load_1m=$(echo "$load_avg" | cut -d',' -f1 | tr -d ' ' 2>/dev/null || echo "0")
            load_5m=$(echo "$load_avg" | cut -d',' -f2 | tr -d ' ' 2>/dev/null || echo "0")

            # Network I/O (safer approach)
            network_stats=$(cat /proc/net/dev | grep -E "(eth0|ens|wlan)" | head -1 | awk '{print $2 "," $10}' 2>/dev/null || echo "0,0")
            network_rx_mb=$(echo "$network_stats" | cut -d',' -f1 | awk '{print $1/1024/1024}' 2>/dev/null || echo "0")
            network_tx_mb=$(echo "$network_stats" | cut -d',' -f2 | awk '{print $1/1024/1024}' 2>/dev/null || echo "0")

            # Disk I/O (safer approach)
            disk_read_mb="0"
            disk_write_mb="0"
            if command -v iostat >/dev/null 2>&1; then
                disk_stats=$(iostat -d 1 1 2>/dev/null | tail -1 | awk '{print $3 "," $4}' 2>/dev/null || echo "0,0")
                disk_read_mb=$(echo "$disk_stats" | cut -d',' -f1 | awk '{if($1) print $1/1024; else print "0"}' 2>/dev/null || echo "0")
                disk_write_mb=$(echo "$disk_stats" | cut -d',' -f2 | awk '{if($1) print $1/1024; else print "0"}' 2>/dev/null || echo "0")
            fi

            # Process counts
            open_files=$(lsof 2>/dev/null | wc -l || echo "0")
            processes=$(ps aux | wc -l)

            echo "$timestamp,$cpu_percent,$ram_used,$ram_available,$ram_percent,$swap_used,$load_1m,$load_5m,$network_rx_mb,$network_tx_mb,$disk_read_mb,$disk_write_mb,$open_files,$processes" >> "$monitor_file"

            sleep 1
        done
    } &

    echo $! # Return monitoring PID
}

# Enhanced RPS testing function
ultimate_rps_test() {
    local framework=$1
    local port=$2
    local connections=$3

    echo "🔥 ULTIMATE TEST: $framework with $connections connections..."

    # Start server
    echo "   🚀 Starting $framework server..."
    timeout $TIMEOUT node "adapters/${framework}.js" "$port" &
    local server_pid=$!

    # Wait for server startup
    local attempts=0
    while [ $attempts -lt 20 ]; do
        if timeout 3 curl -s "http://localhost:$port/" >/dev/null 2>&1; then
            break
        fi
        sleep 0.5
        attempts=$((attempts + 1))
    done

    if [ $attempts -eq 20 ]; then
        echo "   ❌ Server failed to start within 10 seconds"
        kill "$server_pid" 2>/dev/null || true
        return 1
    fi

    echo "   ✅ Server started successfully"

    # Get initial system state
    local initial_memory=$(ps -p "$server_pid" -o rss= 2>/dev/null | awk '{print $1/1024}' || echo "0")
    local initial_cpu_load=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')

    # Start system monitoring
    local monitor_pid=$(start_system_monitoring "$framework" "$connections")

    echo "   📊 Initial memory: ${initial_memory}MB, Load: ${initial_cpu_load}"
    echo "   🔥 Running ULTIMATE RPS test (${REQUESTS_PER_TEST} requests, ${connections} concurrent)..."

    # Run the ULTIMATE test with Apache Bench
    local start_time=$(date +%s.%N)
    local ab_output=""
    local test_success=true

    if ab_output=$(timeout $TIMEOUT ab -n "$REQUESTS_PER_TEST" -c "$connections" -g "$RESULTS_DIR/performance-graphs/${framework}-${connections}conn.tsv" "http://localhost:$port/" 2>/dev/null); then
        local end_time=$(date +%s.%N)
        local test_duration=$(echo "$end_time - $start_time" | bc -l)

        # Parse Apache Bench results
        local rps=$(echo "$ab_output" | grep "Requests per second" | awk '{print $4}' | cut -d'.' -f1)
        local latency_avg=$(echo "$ab_output" | grep "Time per request.*mean" | head -1 | awk '{print $4}')
        local latency_50=$(echo "$ab_output" | grep "50%" | awk '{print $2}')
        local latency_95=$(echo "$ab_output" | grep "95%" | awk '{print $2}')
        local latency_99=$(echo "$ab_output" | grep "99%" | awk '{print $2}')
        local failed_requests=$(echo "$ab_output" | grep "Failed requests" | awk '{print $3}')
        local transfer_rate=$(echo "$ab_output" | grep "Transfer rate" | awk '{print $3}')

        # Get final system state
        local final_memory=$(ps -p "$server_pid" -o rss= 2>/dev/null | awk '{print $1/1024}' || echo "0")
        local final_cpu_load=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
        local memory_increase=$(echo "$final_memory - $initial_memory" | bc -l)

        # Get peak system usage from monitoring
        sleep 2  # Let monitoring collect final data
        kill "$monitor_pid" 2>/dev/null || true

        local monitor_file="$RESULTS_DIR/system-monitoring/${framework}-${connections}conn-monitor.csv"
        local peak_cpu=$(tail -n +2 "$monitor_file" | cut -d',' -f2 | sort -nr | head -1 2>/dev/null || echo "0")
        local peak_ram=$(tail -n +2 "$monitor_file" | cut -d',' -f5 | sort -nr | head -1 2>/dev/null || echo "0")
        local avg_load=$(tail -n +2 "$monitor_file" | cut -d',' -f7 | awk '{sum+=$1; count++} END {if(count>0) print sum/count; else print 0}' 2>/dev/null || echo "0")

        # Save detailed results
        local result_file="$RESULTS_DIR/${framework}-${connections}conn-ultimate-results.json"
        cat > "$result_file" << EOF
{
  "framework": "$framework",
  "connections": $connections,
  "requests_total": $REQUESTS_PER_TEST,
  "test_duration_seconds": $test_duration,
  "rps": $rps,
  "latency_avg_ms": $latency_avg,
  "latency_50_ms": $latency_50,
  "latency_95_ms": $latency_95,
  "latency_99_ms": $latency_99,
  "failed_requests": $failed_requests,
  "transfer_rate_kbps": $transfer_rate,
  "initial_memory_mb": $initial_memory,
  "final_memory_mb": $final_memory,
  "memory_increase_mb": $memory_increase,
  "initial_cpu_load": $initial_cpu_load,
  "final_cpu_load": $final_cpu_load,
  "peak_cpu_percent": $peak_cpu,
  "peak_ram_percent": $peak_ram,
  "average_load": $avg_load,
  "test_success": true,
  "timestamp": "$(date -Iseconds)"
}
EOF

        echo "   ✅ RESULTS: $rps RPS, ${latency_avg}ms avg latency, ${failed_requests} failed"
        echo "   📈 Memory: ${initial_memory}MB → ${final_memory}MB (+${memory_increase}MB)"
        echo "   🖥️  Peak CPU: ${peak_cpu}%, Peak RAM: ${peak_ram}%, Avg Load: ${avg_load}"

        # Check for issues
        local has_issues=false
        if (( $(echo "$failed_requests > 10" | bc -l 2>/dev/null || echo "0") )); then
            echo "   ⚠️  HIGH FAILURE RATE: $failed_requests failed requests"
            has_issues=true
        fi

        if (( $(echo "$latency_99 > 1000" | bc -l 2>/dev/null || echo "0") )); then
            echo "   ⚠️  HIGH P99 LATENCY: ${latency_99}ms"
            has_issues=true
        fi

        if (( $(echo "$memory_increase > 100" | bc -l 2>/dev/null || echo "0") )); then
            echo "   🚨 POTENTIAL MEMORY LEAK: +${memory_increase}MB"
            has_issues=true
        fi

        if (( $(echo "$peak_cpu > 95" | bc -l 2>/dev/null || echo "0") )); then
            echo "   🔥 CPU MAXED OUT: ${peak_cpu}% peak usage"
            has_issues=true
        fi

        if [ "$has_issues" = true ]; then
            echo "   🛑 PERFORMANCE ISSUES DETECTED - Breaking point may be near"
            echo "$framework:$connections:$rps:ISSUES"
        else
            echo "   ✅ Clean performance - can handle more load"
            echo "$framework:$connections:$rps:CLEAN"
        fi

    else
        echo "   ❌ Test FAILED - Server crashed or Apache Bench failed"
        kill "$monitor_pid" 2>/dev/null || true

        # Save failure result
        local result_file="$RESULTS_DIR/${framework}-${connections}conn-ultimate-results.json"
        cat > "$result_file" << EOF
{
  "framework": "$framework",
  "connections": $connections,
  "test_success": false,
  "failure_reason": "Server crashed or test timeout",
  "timestamp": "$(date -Iseconds)"
}
EOF

        echo "$framework:$connections:0:FAILED"
        test_success=false
    fi

    # Cleanup
    kill "$server_pid" 2>/dev/null || true
    kill "$monitor_pid" 2>/dev/null || true
    sleep 2

    # Force cleanup
    killall node 2>/dev/null || true
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    sleep 1

    [ "$test_success" = true ]
}

# Function to test framework until breaking point
find_absolute_maximum() {
    local framework=$1
    local port=$2

    echo ""
    echo "🦊 FINDING ABSOLUTE MAXIMUM FOR: $framework"
    echo "============================================="

    local max_rps=0
    local max_connections=0
    local breaking_point=0
    local optimal_connections=0
    local all_results=()

    for connections in "${CONNECTIONS[@]}"; do
        echo ""
        echo "🔥 Testing $framework with $connections connections..."

        local test_result
        if test_result=$(ultimate_rps_test "$framework" "$port" "$connections"); then
            IFS=':' read -r fw conn rps status <<< "$test_result"
            all_results+=("$test_result")

            # Track maximum RPS achieved
            if (( $(echo "$rps > $max_rps" | bc -l 2>/dev/null || echo "0") )); then
                max_rps=$rps
                optimal_connections=$connections
            fi

            # Check if we hit breaking point
            if [[ "$status" == "ISSUES" ]]; then
                echo "   ⚠️  Performance degradation detected at $connections connections"
                breaking_point=$connections
                # Continue testing to find absolute limit
            elif [[ "$status" == "FAILED" ]]; then
                echo "   💥 ABSOLUTE BREAKING POINT: $connections connections"
                breaking_point=$connections
                break
            fi

        else
            echo "   💥 CATASTROPHIC FAILURE at $connections connections"
            breaking_point=$connections
            break
        fi
    done

    # Generate framework summary
    local summary_file="$RESULTS_DIR/breaking-points/${framework}-ultimate-summary.json"
    cat > "$summary_file" << EOF
{
  "framework": "$framework",
  "absolute_max_rps": $max_rps,
  "optimal_connections": $optimal_connections,
  "absolute_breaking_point": $breaking_point,
  "test_results": [
$(IFS=$'\n'; for result in "${all_results[@]}"; do
    IFS=':' read -r fw conn rps status <<< "$result"
    echo "    {\"connections\": $conn, \"rps\": $rps, \"status\": \"$status\"},"
done | sed '$ s/,$//')
  ],
  "system_specs": $(cat "$SYSTEM_SPECS_FILE"),
  "test_completed": "$(date -Iseconds)"
}
EOF

    echo ""
    echo "📋 $framework ULTIMATE SUMMARY:"
    echo "   🏆 ABSOLUTE MAXIMUM RPS: $max_rps"
    echo "   🎯 OPTIMAL CONNECTIONS: $optimal_connections"
    echo "   🛑 BREAKING POINT: $breaking_point connections"
    echo ""
}

# Run ultimate tests for all frameworks
echo "🦊 STARTING ULTIMATE FOX TESTS..."
echo "================================"

for i in "${!FRAMEWORKS[@]}"; do
    find_absolute_maximum "${FRAMEWORKS[$i]}" "${PORTS[$i]}"
done

# Generate ultimate comparison report
echo ""
echo "📊 GENERATING ULTIMATE FOX REPORT..."
echo "====================================="

# Find absolute winner
winner_framework=""
winner_rps=0
winner_connections=0

for framework in "${FRAMEWORKS[@]}"; do
    summary_file="$RESULTS_DIR/breaking-points/${framework}-ultimate-summary.json"
    if [ -f "$summary_file" ]; then
        max_rps=$(jq -r '.absolute_max_rps' "$summary_file")
        optimal_conn=$(jq -r '.optimal_connections' "$summary_file")

        if (( $(echo "$max_rps > $winner_rps" | bc -l 2>/dev/null || echo "0") )); then
            winner_rps=$max_rps
            winner_framework=$framework
            winner_connections=$optimal_conn
        fi
    fi
done

# Generate HTML report with system specs
cat > "$RESULTS_DIR/ultimate-fox-report.html" << 'EOL'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🦊 Ultimate Fox Test Results</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: #1a1a1a; color: #fff; }
        .header { text-align: center; padding: 20px; background: linear-gradient(45deg, #ff6b35, #f7931e); border-radius: 10px; margin-bottom: 30px; }
        .system-specs { background: #2d2d2d; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .results { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .framework-card { background: #2d2d2d; padding: 20px; border-radius: 10px; border-left: 5px solid #ff6b35; }
        .winner { border-left-color: #4CAF50; background: #1e3d1e; }
        .metric { display: flex; justify-content: space-between; margin: 10px 0; }
        .metric-value { font-weight: bold; color: #ff6b35; }
        .winner .metric-value { color: #4CAF50; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #444; }
        th { background: #333; }
        .performance-bar { background: #444; height: 20px; border-radius: 10px; overflow: hidden; }
        .performance-fill { height: 100%; background: linear-gradient(90deg, #ff6b35, #4CAF50); }
    </style>
</head>
<body>
    <div class="header">
        <h1>🦊 ULTIMATE FOX TEST RESULTS</h1>
        <p>Absolute Maximum Performance Limits Discovery</p>
    </div>
EOL

# Add system specs to HTML
echo "    <div class=\"system-specs\">" >> "$RESULTS_DIR/ultimate-fox-report.html"
echo "        <h2>💻 System Specifications</h2>" >> "$RESULTS_DIR/ultimate-fox-report.html"

cpu_model=$(jq -r '.cpu_model' "$SYSTEM_SPECS_FILE")
ram_total=$(jq -r '.ram_total_gb' "$SYSTEM_SPECS_FILE")
cpu_cores=$(jq -r '.cpu_cores' "$SYSTEM_SPECS_FILE")

cat >> "$RESULTS_DIR/ultimate-fox-report.html" << EOF
        <div class="metric"><span>🖥️ CPU:</span><span class="metric-value">$cpu_model ($cpu_cores cores)</span></div>
        <div class="metric"><span>🧠 RAM:</span><span class="metric-value">${ram_total}GB</span></div>
        <div class="metric"><span>🐧 OS:</span><span class="metric-value">$(jq -r '.os_version' "$SYSTEM_SPECS_FILE")</span></div>
        <div class="metric"><span>⚡ Node.js:</span><span class="metric-value">$(jq -r '.node_version' "$SYSTEM_SPECS_FILE")</span></div>
    </div>
EOF

# Add results cards
echo "    <div class=\"results\">" >> "$RESULTS_DIR/ultimate-fox-report.html"

for framework in "${FRAMEWORKS[@]}"; do
    summary_file="$RESULTS_DIR/breaking-points/${framework}-ultimate-summary.json"
    if [ -f "$summary_file" ]; then
        max_rps=$(jq -r '.absolute_max_rps' "$summary_file")
        optimal_conn=$(jq -r '.optimal_connections' "$summary_file")
        breaking_point=$(jq -r '.absolute_breaking_point' "$summary_file")

        card_class="framework-card"
        if [ "$framework" = "$winner_framework" ]; then
            card_class="framework-card winner"
        fi

        cat >> "$RESULTS_DIR/ultimate-fox-report.html" << EOF
        <div class="$card_class">
            <h3>$(echo "$framework" | tr '[:lower:]' '[:upper:]')</h3>
            <div class="metric"><span>🏆 Max RPS:</span><span class="metric-value">$max_rps</span></div>
            <div class="metric"><span>🎯 Optimal Connections:</span><span class="metric-value">$optimal_conn</span></div>
            <div class="metric"><span>🛑 Breaking Point:</span><span class="metric-value">$breaking_point</span></div>
            <div class="performance-bar">
                <div class="performance-fill" style="width: $(echo "scale=2; ($max_rps * 100) / $winner_rps" | bc -l)%"></div>
            </div>
        </div>
EOF
    fi
done

cat >> "$RESULTS_DIR/ultimate-fox-report.html" << 'EOF'
    </div>

    <div style="margin-top: 40px; text-align: center; color: #999;">
        <p>🦊 Ultimate Fox Test - Generated on $(date)</p>
        <p>📁 Detailed results available in: results/ultimate-fox-test/</p>
    </div>
</body>
</html>
EOF

# Generate markdown summary
cat > "$RESULTS_DIR/ultimate-fox-summary.md" << EOL
# 🦊 ULTIMATE FOX TEST RESULTS

## 🏆 ABSOLUTE WINNER: ${winner_framework^^}
- **Maximum RPS**: $winner_rps
- **Optimal Connections**: $winner_connections
- **System**: $cpu_model, ${ram_total}GB RAM

## 📊 Complete Results

| Framework | Max RPS | Optimal Connections | Breaking Point | Performance vs Winner |
|-----------|---------|-------------------|---------------|---------------------|
EOL

for framework in "${FRAMEWORKS[@]}"; do
    summary_file="$RESULTS_DIR/breaking-points/${framework}-ultimate-summary.json"
    if [ -f "$summary_file" ]; then
        max_rps=$(jq -r '.absolute_max_rps' "$summary_file")
        optimal_conn=$(jq -r '.optimal_connections' "$summary_file")
        breaking_point=$(jq -r '.absolute_breaking_point' "$summary_file")

        performance_diff="0%"
        if [ "$max_rps" != "$winner_rps" ]; then
            diff=$(echo "$winner_rps - $max_rps" | bc -l)
            percent=$(echo "scale=1; ($diff * 100) / $winner_rps" | bc -l)
            performance_diff="-${percent}%"
        else
            performance_diff="👑 WINNER"
        fi

        echo "| $(echo "$framework" | tr '[:lower:]' '[:upper:]') | $max_rps | $optimal_conn | $breaking_point | $performance_diff |" >> "$RESULTS_DIR/ultimate-fox-summary.md"
    fi
done

cat >> "$RESULTS_DIR/ultimate-fox-summary.md" << EOL

## 💻 System Specifications
- **CPU**: $cpu_model ($cpu_cores cores)
- **RAM**: ${ram_total}GB
- **OS**: $(jq -r '.os_version' "$SYSTEM_SPECS_FILE")
- **Node.js**: $(jq -r '.node_version' "$SYSTEM_SPECS_FILE")

## 📈 Analysis
This test found the absolute maximum RPS each framework can handle on your specific hardware configuration. The winner achieved the highest sustained RPS before hitting performance degradation or system limits.

*Generated: $(date)*
EOL

echo ""
echo "🦊🦊🦊 ULTIMATE FOX TEST COMPLETE! 🦊🦊🦊"
echo "========================================"
echo "🏆 ABSOLUTE WINNER: $winner_framework"
echo "🚀 MAXIMUM RPS: $winner_rps"
echo "🎯 OPTIMAL LOAD: $winner_connections connections"
echo ""
echo "📁 Results Location: $RESULTS_DIR/"
echo "🌐 HTML Report: $RESULTS_DIR/ultimate-fox-report.html"
echo "📄 Summary: $RESULTS_DIR/ultimate-fox-summary.md"
echo ""
echo "🔍 Detailed Analysis Files:"
echo "   - System monitoring: $RESULTS_DIR/system-monitoring/"
echo "   - Performance graphs: $RESULTS_DIR/performance-graphs/"
echo "   - Breaking point analysis: $RESULTS_DIR/breaking-points/"
echo ""
echo "💡 Open the HTML report in your browser for interactive results!"

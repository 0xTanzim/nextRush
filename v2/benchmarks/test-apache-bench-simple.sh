#!/bin/bash

# 🚀 Simple Apache Bench Test Script
# Tests if Apache Bench is working correctly and producing fair results

set -e

echo "🧪 Testing Apache Bench Setup..."
echo "=================================="

# Check if Apache Bench is installed
if ! command -v ab &> /dev/null; then
    echo "❌ Apache Bench not found. Installing..."
    sudo apt-get update
    sudo apt-get install -y apache2-utils
fi

echo "✅ Apache Bench found: $(ab -V | head -n1)"

# Test basic Apache Bench functionality
echo ""
echo "🔍 Testing basic Apache Bench functionality..."

# Create a simple test server
cat > test-server.js << 'EOF'
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Hello World', timestamp: Date.now() }));
});

server.listen(0, () => {
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);
  
  // Run Apache Bench test
  const { spawn } = require('child_process');
  const ab = spawn('ab', [
    '-n', '100',
    '-c', '10',
    '-k',
    `http://localhost:${port}/`
  ]);
  
  let output = '';
  ab.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  ab.stderr.on('data', (data) => {
    console.error(`Apache Bench stderr: ${data}`);
  });
  
  ab.on('close', (code) => {
    console.log('Apache Bench output:');
    console.log(output);
    console.log(`Apache Bench exited with code ${code}`);
    server.close();
    process.exit(code);
  });
});
EOF

echo "🚀 Starting test server..."
node test-server.js

echo ""
echo "✅ Apache Bench test completed!"
echo ""
echo "📊 Expected results:"
echo "   - RPS: Should be > 1000"
echo "   - Latency: Should be < 50ms"
echo "   - Success rate: Should be 100%"
echo ""
echo "🔧 If results look wrong, check:"
echo "   1. Apache Bench installation"
echo "   2. System resources"
echo "   3. Network configuration"

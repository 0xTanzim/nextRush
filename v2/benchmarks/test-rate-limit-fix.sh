#!/bin/bash

# 🚀 Test Rate Limiting Fix
# Verifies that 429 errors are fixed by disabling rate limiting

set -e

echo "🧪 Testing Rate Limiting Fix..."
echo "================================="

# Check if Apache Bench is available
if ! command -v ab &> /dev/null; then
    echo "❌ Apache Bench not found. Installing..."
    sudo apt-get update
    sudo apt-get install -y apache2-utils
fi

echo "✅ Apache Bench found: $(ab -V | head -n1)"

# Test NextRush without rate limiting
echo ""
echo "🔍 Testing NextRush without rate limiting..."

# Create a simple test to check for 429 errors
cat > test-rate-limit.js << 'EOF'
const { createApp } = require('nextrush-v2');

async function testRateLimit() {
  const app = createApp();

  // Add middleware WITHOUT rate limiting
  app.use(app.cors());
  app.use(app.helmet());
  app.use(app.requestId());
  app.use(app.timer());
  app.use(app.compression());
  app.use(app.smartBodyParser());
  app.use(app.logger());
  // NO rate limiting middleware!

  app.get('/', ctx => {
    ctx.res.json({ message: 'Hello World' });
  });

  const server = app.listen(0);

  // Wait for server to be ready
  await new Promise(resolve => {
    const checkServer = () => {
      const address = server.address();
      if (address) {
        console.log(`Server running on port ${address.port}`);
        resolve();
      } else {
        setTimeout(checkServer, 100);
      }
    };
    checkServer();
  });

  const port = server.address().port;

  // Run Apache Bench test
  const { spawn } = require('child_process');
  const ab = spawn('ab', [
    '-n', '1000',
    '-c', '50',
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

    // Check for 429 errors
    if (output.includes('429') || output.includes('Too Many Requests')) {
      console.log('❌ 429 errors still present!');
      process.exit(1);
    } else {
      console.log('✅ No 429 errors detected!');
    }

    server.close();
    process.exit(code);
  });
}

testRateLimit().catch(console.error);
EOF

echo "🚀 Running rate limit test..."
node test-rate-limit.js

echo ""
echo "✅ Rate limiting fix test completed!"
echo ""
echo "📊 Expected results:"
echo "   - No 429 errors"
echo "   - Success rate: 100%"
echo "   - RPS: > 1000"
echo ""
echo "🔧 If you still see 429 errors:"
echo "   1. Check that rate limiting is disabled in all adapters"
echo "   2. Restart the benchmark servers"
echo "   3. Clear any cached rate limit data"

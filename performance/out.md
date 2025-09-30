✅ Completed: post

▶️  Running: mixed
/mnt/Storage/project/MyExpress/performance/tests/autocannon/mixed.js:11
const fs = require('fs');
      ^

SyntaxError: Identifier 'fs' has already been declared
    at wrapSafe (node:internal/modules/cjs/loader:1669:18)
    at Module._compile (node:internal/modules/cjs/loader:1712:20)
    at Object..js (node:internal/modules/cjs/loader:1871:10)
    at Module.load (node:internal/modules/cjs/loader:1470:32)
    at Module._load (node:internal/modules/cjs/loader:1290:12)
    at TracingChannel.traceSync (node:diagnostics_channel:322:14)
    at wrapModuleLoad (node:internal/modules/cjs/loader:238:24)
    at Module.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:154:5)
    at node:internal/main/run_main_module:33:47

Node.js v24.7.0
❌ Failed: mixed

⏹️  Stopping server (PID: 101242)...
✅ Server stopped
💤 Cooldown (3s)...

==============================================================


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   STEP 2: K6 Load Tests
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Running K6 load tests for all frameworks...
   (100 VUs, 60s duration)

╔════════════════════════════════════════╗
║   K6 Performance Benchmark Suite      ║
╔════════════════════════════════════════╗

✅ k6 found: k6 v1.3.0 (commit/5870e99ae8, go1.25.1, linux/amd64)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Testing: nextrush
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Starting nextrush server...
⏳ Waiting for server to be ready..............................
❌ Server failed to start within 30s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Testing: express
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Starting express server...
⏳ Waiting for server to be ready..............................
❌ Server failed to start within 30s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Testing: koa
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Starting koa server...
⏳ Waiting for server to be ready..............................
❌ Server failed to start within 30s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Testing: fastify
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Starting fastify server...
⏳ Waiting for server to be ready..............................
❌ Server failed to start within 30s

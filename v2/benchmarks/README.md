# 🚀 NextRush v2 Comprehensive Benchmarking Suite

> **Professional-grade performance testing with multiple tools including Apache Bench (ab)**

## 🎯 **Available Benchmarking Tools**

### 📊 **Autocannon** - Node.js Optimized

- **Purpose**: High-performance HTTP benchmarking optimized for Node.js
- **Best for**: Node.js framework comparison and detailed metrics
- **Features**: Real-time statistics, connection pooling, pipelining

### 🔥 **Apache Bench (ab)** - Industry Standard

- **Purpose**: Industry-standard HTTP server benchmarking tool
- **Best for**: Cross-platform comparison and production-like testing
- **Features**: Detailed percentile analysis, transfer rate metrics, industry recognition

### 🎯 **Artillery** - Scenario-Based Testing

- **Purpose**: Complex scenario and user behavior simulation
- **Best for**: Real-world application testing with multiple endpoints
- **Features**: User flows, think time, custom scenarios

### 📈 **K6** - Advanced Load Testing

- **Purpose**: Modern load testing with JavaScript scripting
- **Best for**: Complex test scenarios and CI/CD integration
- **Features**: JavaScript scripting, custom metrics, cloud integration

## 🚀 **Quick Start**

### 1. **Install Benchmarking Tools**

```bash
cd v2/benchmarks
pnpm install-tools
```

This installs:

- ✅ Apache Bench (ab)
- ✅ Artillery
- ✅ K6
- ✅ wrk (alternative)

### 2. **Run Apache Bench Tests**

```bash
# Quick Apache Bench test
pnpm apache-bench

# Custom frameworks and scenarios
pnpm apache-bench --frameworks nextrush,express --scenarios basic-load,high-concurrency

# Custom output directory
pnpm apache-bench --output ./my-results
```

### 3. **Run Comprehensive Benchmarks**

```bash
# All tools including Apache Bench
pnpm comprehensive-with-ab

# Specific tools only
pnpm comprehensive-with-ab --tools apache-bench,autocannon

# Custom frameworks
pnpm comprehensive-with-ab --frameworks nextrush,express,fastify
```

## 📋 **Available Commands**

### 🔥 **Apache Bench Commands**

```bash
# Basic Apache Bench test
pnpm apache-bench

# Custom scenarios
pnpm apache-bench --scenarios basic-load,json-endpoint,post-requests

# Specific frameworks
pnpm apache-bench --frameworks nextrush,express
```

### 🏆 **Comprehensive Testing**

```bash
# All tools with Apache Bench integration
pnpm comprehensive-with-ab

# Minimal comparison
pnpm minimal

# Fair comparison
pnpm fair

# Quick NextRush test
pnpm quick
```

### 🔧 **Utility Commands**

```bash
# Install all tools
pnpm install-tools

# Show available commands
pnpm benchmark info

# Clean results
pnpm benchmark clean
```

## 📊 **Apache Bench Scenarios**

### **Basic Load Test**

- **Requests**: 1,000
- **Concurrency**: 10
- **Purpose**: Baseline performance measurement

### **High Concurrency Test**

- **Requests**: 5,000
- **Concurrency**: 100
- **Purpose**: Stress testing and concurrency limits

### **JSON Endpoint Test**

- **Requests**: 2,000
- **Concurrency**: 50
- **Purpose**: JSON parsing performance

### **POST Requests Test**

- **Requests**: 1,000
- **Concurrency**: 25
- **Purpose**: Request body processing

### **Parameter Parsing Test**

- **Requests**: 1,500
- **Concurrency**: 30
- **Purpose**: URL parameter extraction

### **Query Parameters Test**

- **Requests**: 2,000
- **Concurrency**: 40
- **Purpose**: Query string processing

### **Health Check Test**

- **Requests**: 3,000
- **Concurrency**: 60
- **Purpose**: Minimal overhead testing

## 📈 **Understanding Results**

### **Apache Bench Metrics**

```
Requests per second:    1,234.56 [#/sec] (mean)
Time per request:       0.81 [ms] (mean)
Time per request:       0.81 [ms] (mean, across all concurrent requests)
Transfer rate:          1,234.56 [Kbytes/sec] received
```

### **Key Performance Indicators**

- **RPS (Requests Per Second)**: Throughput measurement
- **Latency**: Response time (mean, p95, p99)
- **Transfer Rate**: Data throughput
- **Success Rate**: Percentage of successful requests
- **Failed Requests**: Number of failed requests

### **Performance Categories**

- **🟢 Excellent**: >10,000 RPS, <10ms latency
- **🟡 Good**: 5,000-10,000 RPS, 10-50ms latency
- **🟠 Average**: 1,000-5,000 RPS, 50-100ms latency
- **🔴 Poor**: <1,000 RPS, >100ms latency

## 🏗️ **Project Structure**

```
v2/benchmarks/
├── 📂 src/
│   ├── 📂 apache-bench/
│   │   └── apache-bench.ts          # Apache Bench runner
│   ├── 📂 adapters/
│   │   ├── nextrush.ts              # NextRush server adapter
│   │   ├── express.ts               # Express server adapter
│   │   ├── fastify.ts               # Fastify server adapter
│   │   └── koa.ts                   # Koa server adapter
│   ├── orchestrator.ts              # Main CLI orchestrator
│   ├── comprehensive-benchmark-with-ab.ts  # Comprehensive suite
│   ├── minimal-benchmark.ts         # Minimal comparison
│   ├── fair-benchmark.ts            # Fair comparison
│   └── types.ts                     # TypeScript definitions
├── 📂 scripts/
│   └── install-apache-bench.sh      # Tool installation script
├── 📂 reports/                      # Generated reports
└── package.json                     # Dependencies and scripts
```

## 🔧 **Tool Installation**

### **Automatic Installation**

```bash
# Install all tools automatically
pnpm install-tools
```

### **Manual Installation**

#### **Apache Bench (ab)**

```bash
# Ubuntu/Debian
sudo apt-get install apache2-utils

# CentOS/RHEL
sudo yum install httpd-tools

# macOS
brew install httpd

# Arch Linux
sudo pacman -S apache
```

#### **Artillery**

```bash
npm install -g artillery
```

#### **K6**

```bash
# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# macOS
brew install k6
```

## 📊 **Example Results**

### **Apache Bench Output**

```
Server Software:        NextRush/2.0.0
Server Hostname:        localhost
Server Port:            3000

Document Path:          /
Document Length:        45 bytes

Concurrency Level:      10
Time taken for tests:   0.812 seconds
Complete requests:      1000
Failed requests:        0
Total transferred:      123456 bytes
HTML transferred:       45000 bytes
Requests per second:    1230.54 [#/sec] (mean)
Time per request:       8.12 [ms] (mean)
Time per request:       0.81 [ms] (mean, across all concurrent requests)
Transfer rate:          148.45 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.1      0       1
Processing:     1    8   2.1      7      15
Waiting:        1    8   2.1      7      15
Total:          1    8   2.1      7      15

Percentage of the requests served within a certain time (ms)
  50%      7
  66%      8
  75%      9
  80%     10
  90%     12
  95%     13
  98%     14
  99%     15
 100%     15 (longest request)
```

## 🎯 **Best Practices**

### **1. Consistent Testing Environment**

- Use the same hardware for all tests
- Close unnecessary applications
- Monitor system resources during tests

### **2. Multiple Test Runs**

- Run each test 3-5 times
- Calculate average and standard deviation
- Discard outliers

### **3. Realistic Scenarios**

- Test with realistic payload sizes
- Include error scenarios
- Test with different concurrency levels

### **4. System Monitoring**

- Monitor CPU, memory, and network usage
- Check for bottlenecks
- Monitor error rates

## 🔍 **Troubleshooting**

### **Apache Bench Not Found**

```bash
# Install Apache Bench
pnpm install-tools

# Or install manually
sudo apt-get install apache2-utils  # Ubuntu/Debian
```

### **Permission Denied**

```bash
# Make scripts executable
chmod +x scripts/install-apache-bench.sh
```

### **Port Already in Use**

```bash
# Kill existing processes
pkill -f node
pkill -f ab
```

### **High Error Rates**

- Check server logs for errors
- Verify server is running correctly
- Reduce concurrency level
- Increase timeout values

## 📚 **Documentation Links**

- **Apache Bench**: https://httpd.apache.org/docs/2.4/programs/ab.html
- **Autocannon**: https://github.com/mcollina/autocannon
- **Artillery**: https://www.artillery.io/docs
- **K6**: https://k6.io/docs
- **wrk**: https://github.com/wg/wrk

## 🎉 **Getting Started**

1. **Install tools**: `pnpm install-tools`
2. **Run Apache Bench**: `pnpm apache-bench`
3. **Run comprehensive test**: `pnpm comprehensive-with-ab`
4. **View results**: Check `./reports/` directory

---

**🚀 Ready to benchmark your NextRush v2 application with industry-standard tools!**

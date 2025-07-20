/**
 * 📊 K6 Basic Load Testing Script
 *
 * Professional load testing script using K6 with:
 * - Multiple test scenarios
 * - Realistic user behavior simulation
 * - Performance thresholds
 * - Detailed metrics collection
 */

import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTimeThreshold = new Trend('response_time_threshold');
const requestCounter = new Counter('requests_total');

// Test configuration
export const options = {
  stages: [
    // Warm up
    { duration: '30s', target: 10 },
    // Ramp up
    { duration: '1m', target: 50 },
    // Stay at peak
    { duration: '3m', target: 50 },
    // Ramp down
    { duration: '30s', target: 0 },
  ],

  // Performance thresholds
  thresholds: {
    // Response time thresholds
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{name:json}': ['p(95)<300'],
    'http_req_duration{name:plaintext}': ['p(95)<100'],

    // Error rate thresholds
    errors: ['rate<0.01'], // Less than 1% errors
    http_req_failed: ['rate<0.02'], // Less than 2% failed requests

    // Request rate thresholds
    http_reqs: ['count>1000'], // At least 1000 requests total
    'http_reqs{name:basic}': ['rate>10'], // At least 10 requests/sec for basic endpoint
  },

  // Browser-like behavior
  userAgent: 'K6 Professional Benchmark/1.0',
};

// Base URL (can be overridden via environment variable)
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

/**
 * Main test function - executed by each virtual user
 */
export default function () {
  // Test basic endpoint
  group('Basic Endpoints', function () {
    testBasicEndpoint();
    testJsonEndpoint();
    testPlaintextEndpoint();
  });

  // Test API functionality
  group('API Tests', function () {
    testParameterParsing();
    testQueryParameters();
    testHealthCheck();
  });

  // Test error handling
  group('Error Handling', function () {
    testErrorEndpoint();
  });

  // Test POST requests
  group('POST Requests', function () {
    testPostData();
  });

  // Realistic user behavior - small pause between actions
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

/**
 * Test basic root endpoint
 */
function testBasicEndpoint() {
  const response = http.get(`${BASE_URL}/`, {
    tags: { name: 'basic' },
  });

  const success = check(response, {
    'basic: status is 200': (r) => r.status === 200,
    'basic: has message': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.message && body.message.includes('Hello');
      } catch {
        return false;
      }
    },
    'basic: response time OK': (r) => r.timings.duration < 1000,
  });

  errorRate.add(!success);
  requestCounter.add(1);
  responseTimeThreshold.add(response.timings.duration);
}

/**
 * Test JSON endpoint
 */
function testJsonEndpoint() {
  const response = http.get(`${BASE_URL}/json`, {
    tags: { name: 'json' },
  });

  const success = check(response, {
    'json: status is 200': (r) => r.status === 200,
    'json: is valid JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
    'json: has framework info': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.framework && body.version;
      } catch {
        return false;
      }
    },
    'json: response time OK': (r) => r.timings.duration < 500,
  });

  errorRate.add(!success);
  requestCounter.add(1);
}

/**
 * Test plaintext endpoint (fastest response)
 */
function testPlaintextEndpoint() {
  const response = http.get(`${BASE_URL}/plaintext`, {
    tags: { name: 'plaintext' },
  });

  const success = check(response, {
    'plaintext: status is 200': (r) => r.status === 200,
    'plaintext: body is text': (r) => r.body === 'Hello World',
    'plaintext: response time very fast': (r) => r.timings.duration < 200,
  });

  errorRate.add(!success);
  requestCounter.add(1);
}

/**
 * Test parameter parsing
 */
function testParameterParsing() {
  const userId = Math.floor(Math.random() * 1000) + 1;
  const postId = Math.floor(Math.random() * 100) + 1;

  const response = http.get(`${BASE_URL}/users/${userId}/posts/${postId}`, {
    tags: { name: 'parameters' },
  });

  const success = check(response, {
    'params: status is 200': (r) => r.status === 200,
    'params: correct user ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.userId === userId.toString();
      } catch {
        return false;
      }
    },
    'params: correct post ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.postId === postId.toString();
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  requestCounter.add(1);
}

/**
 * Test query parameters
 */
function testQueryParameters() {
  const query = `test_${Math.random().toString(36).substring(7)}`;
  const page = Math.floor(Math.random() * 10) + 1;
  const limit = Math.floor(Math.random() * 20) + 5;

  const response = http.get(
    `${BASE_URL}/search?q=${query}&page=${page}&limit=${limit}`,
    {
      tags: { name: 'query' },
    }
  );

  const success = check(response, {
    'query: status is 200': (r) => r.status === 200,
    'query: correct query param': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.query === query;
      } catch {
        return false;
      }
    },
    'query: correct page param': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.page === page;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  requestCounter.add(1);
}

/**
 * Test health check endpoint
 */
function testHealthCheck() {
  const response = http.get(`${BASE_URL}/health`, {
    tags: { name: 'health' },
  });

  const success = check(response, {
    'health: status is 200': (r) => r.status === 200,
    'health: has status field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'healthy';
      } catch {
        return false;
      }
    },
    'health: has uptime': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.uptime === 'number' && body.uptime >= 0;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  requestCounter.add(1);
}

/**
 * Test error endpoint
 */
function testErrorEndpoint() {
  const response = http.get(`${BASE_URL}/error`, {
    tags: { name: 'error' },
  });

  const success = check(response, {
    'error: status is 500': (r) => r.status === 500,
    'error: has error message': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.error && body.code === 500;
      } catch {
        return false;
      }
    },
  });

  // Don't count expected errors as failures
  requestCounter.add(1);
}

/**
 * Test POST data submission
 */
function testPostData() {
  const testData = {
    user_id: Math.floor(Math.random() * 1000) + 1,
    action: 'k6_test',
    timestamp: Date.now(),
    data: `test_data_${Math.random().toString(36).substring(7)}`,
  };

  const response = http.post(`${BASE_URL}/data`, JSON.stringify(testData), {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: 'post' },
  });

  const success = check(response, {
    'post: status is 200': (r) => r.status === 200,
    'post: confirms receipt': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.received === true;
      } catch {
        return false;
      }
    },
    'post: has timestamp': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.timestamp === 'number';
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  requestCounter.add(1);
}

/**
 * Setup function - runs once before all tests
 */
export function setup() {
  // Verify server is reachable
  const response = http.get(`${BASE_URL}/health`);
  if (response.status !== 200) {
    throw new Error(`Server not ready: ${response.status}`);
  }

  console.log(`K6 benchmark starting against ${BASE_URL}`);

  return { serverInfo: JSON.parse(response.body) };
}

/**
 * Teardown function - runs once after all tests
 */
export function teardown(data) {
  console.log('K6 benchmark completed');
  if (data.serverInfo) {
    console.log(`Final server uptime: ${data.serverInfo.uptime}s`);
  }
}

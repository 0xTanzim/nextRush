#!/usr/bin/env node

/**
 * Advanced Test Suite for Professional Benchmarks
 * Complex scenarios to thoroughly test framework capabilities
 */

import chalk from 'chalk';
import fs from 'node:fs/promises';
import path from 'node:path';

export class AdvancedTestSuite {
  constructor(framework, port) {
    this.framework = framework;
    this.port = port;
  }

  // Complex Artillery configuration for stress testing
  createAdvancedArtilleryConfig() {
    return {
      config: {
        target: `http://localhost:${this.port}`,
        phases: [
          { duration: 20, arrivalRate: 10, name: 'Warm-up' },
          { duration: 30, arrivalRate: 50, name: 'Moderate Load' },
          { duration: 40, arrivalRate: 100, name: 'High Load' },
          { duration: 30, arrivalRate: 200, name: 'Stress Test' },
          { duration: 20, arrivalRate: 50, name: 'Cool Down' },
        ],
        payload: [
          { path: './test-data/users.csv', fields: ['name', 'email'] },
          { path: './test-data/products.csv', fields: ['title', 'price'] },
        ],
        variables: {
          userId: { min: 1, max: 1000 },
          productId: { min: 1, max: 500 },
          largeText: 'A'.repeat(1000), // Large text for payload testing
        },
        timeout: 30,
        http: {
          timeout: 30,
          extendedMetrics: true,
        },
        engines: {
          http: {
            maxSockets: 50,
          },
        },
      },
      scenarios: [
        {
          name: 'Basic API Testing',
          weight: 25,
          flow: [
            { get: { url: '/' } },
            { get: { url: '/health' } },
            { get: { url: '/json' } },
            { get: { url: '/plaintext' } },
          ],
        },
        {
          name: 'CRUD Operations',
          weight: 30,
          flow: [
            { get: { url: '/api/users' } },
            {
              post: {
                url: '/api/users',
                json: {
                  name: '{{ name }}',
                  email: '{{ email }}',
                  timestamp: '{{ $timestamp }}',
                },
              },
            },
            { get: { url: '/api/users/{{ userId }}' } },
            {
              put: {
                url: '/api/users/{{ userId }}',
                json: {
                  name: 'Updated {{ name }}',
                  updatedAt: '{{ $timestamp }}',
                },
              },
            },
            { delete: { url: '/api/users/{{ userId }}' } },
          ],
        },
        {
          name: 'Static File Serving',
          weight: 15,
          flow: [
            { get: { url: '/test.txt' } },
            { get: { url: '/public/style.css' } },
          ],
        },
        {
          name: 'Complex Query Parameters',
          weight: 15,
          flow: [
            {
              get: {
                url: '/search?q=test&page=1&limit=10&sort=name&order=asc',
              },
            },
            { get: { url: '/users/{{ userId }}/posts/{{ productId }}' } },
          ],
        },
        {
          name: 'Large Payload Testing',
          weight: 10,
          flow: [
            {
              post: {
                url: '/api/users',
                json: {
                  name: 'Large Data User',
                  email: 'large@example.com',
                  description: '{{ largeText }}',
                  metadata: {
                    tags: ['tag1', 'tag2', 'tag3'],
                    settings: {
                      theme: 'dark',
                      language: 'en',
                      notifications: true,
                    },
                  },
                },
              },
            },
          ],
        },
        {
          name: 'Error Handling Testing',
          weight: 5,
          flow: [
            { get: { url: '/error' } },
            { get: { url: '/nonexistent' } },
            { post: { url: '/api/users', json: { invalid: 'data' } } },
          ],
        },
      ],
    };
  }

  // Advanced K6 script for comprehensive testing
  createAdvancedK6Script() {
    return `
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const errors = new Counter('errors');
const successRate = new Rate('success_rate');
const apiLatency = new Trend('api_latency');

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Warm-up
    { duration: '60s', target: 50 },   // Normal load
    { duration: '120s', target: 100 }, // High load
    { duration: '180s', target: 200 }, // Stress test
    { duration: '120s', target: 300 }, // Peak load
    { duration: '60s', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    success_rate: ['rate>0.99'],
    api_latency: ['p(95)<200'],
  },
};

const BASE_URL = 'http://localhost:${this.port}';

// Test data
const users = [
  { name: 'Alice Johnson', email: 'alice@example.com' },
  { name: 'Bob Smith', email: 'bob@example.com' },
  { name: 'Charlie Brown', email: 'charlie@example.com' },
];

export default function () {
  // Basic endpoint tests
  group('Basic Endpoints', () => {
    const homeRes = http.get(BASE_URL + '/');
    check(homeRes, { 'home status is 200': (r) => r.status === 200 });
    successRate.add(homeRes.status === 200);

    const healthRes = http.get(BASE_URL + '/health');
    check(healthRes, { 'health status is 200': (r) => r.status === 200 });
    successRate.add(healthRes.status === 200);
  });

  // API CRUD operations
  group('API Operations', () => {
    // Get all users
    const getUsersRes = http.get(BASE_URL + '/api/users');
    const getUsersSuccess = check(getUsersRes, {
      'get users status is 200': (r) => r.status === 200,
      'get users response time < 100ms': (r) => r.timings.duration < 100,
    });
    successRate.add(getUsersSuccess);
    apiLatency.add(getUsersRes.timings.duration);

    // Create a user
    const user = users[Math.floor(Math.random() * users.length)];
    const createUserRes = http.post(BASE_URL + '/api/users',
      JSON.stringify({
        ...user,
        timestamp: new Date().toISOString(),
        randomId: Math.random().toString(36).substr(2, 9)
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    const createSuccess = check(createUserRes, {
      'create user status is 200': (r) => r.status === 200,
      'create user has id': (r) => JSON.parse(r.body).id !== undefined,
    });
    successRate.add(createSuccess);

    if (createSuccess) {
      const userId = JSON.parse(createUserRes.body).id;

      // Get specific user
      const getUserRes = http.get(BASE_URL + '/api/users/' + userId);
      check(getUserRes, { 'get user status is 200': (r) => r.status === 200 });
      successRate.add(getUserRes.status === 200);

      // Update user
      const updateUserRes = http.put(BASE_URL + '/api/users/' + userId,
        JSON.stringify({ name: 'Updated ' + user.name, email: user.email }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      check(updateUserRes, { 'update user status is 200': (r) => r.status === 200 });
      successRate.add(updateUserRes.status === 200);

      // Delete user
      const deleteUserRes = http.del(BASE_URL + '/api/users/' + userId);
      check(deleteUserRes, { 'delete user status is 200': (r) => r.status === 200 });
      successRate.add(deleteUserRes.status === 200);
    }
  });

  // Stress test with concurrent requests
  group('Concurrent Load Test', () => {
    const responses = http.batch([
      { method: 'GET', url: BASE_URL + '/' },
      { method: 'GET', url: BASE_URL + '/api/users' },
      { method: 'GET', url: BASE_URL + '/health' },
      { method: 'POST', url: BASE_URL + '/api/users',
        body: JSON.stringify(users[0]),
        params: { headers: { 'Content-Type': 'application/json' } }
      },
    ]);

    responses.forEach(response => {
      successRate.add(response.status === 200);
      if (response.status !== 200) {
        errors.add(1);
      }
    });
  });

  // Error handling tests
  group('Error Handling', () => {
    const notFoundRes = http.get(BASE_URL + '/nonexistent');
    check(notFoundRes, { 'not found returns 404': (r) => r.status === 404 });

    const invalidJsonRes = http.post(BASE_URL + '/api/users', 'invalid json',
      { headers: { 'Content-Type': 'application/json' } }
    );
    check(invalidJsonRes, { 'invalid json handled': (r) => r.status >= 400 && r.status < 500 });
  });

  // Random sleep between 1-3 seconds to simulate real user behavior
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
  };
}
`;
  }

  // Generate test data files
  async generateTestData(outputDir) {
    await fs.mkdir(path.join(outputDir, 'test-data'), { recursive: true });

    // Generate users CSV
    const usersCSV = `name,email
Alice Johnson,alice@example.com
Bob Smith,bob@example.com
Charlie Brown,charlie@example.com
Diana Prince,diana@example.com
Edward Norton,edward@example.com
Fiona Apple,fiona@example.com
George Harrison,george@example.com
Helen Mirren,helen@example.com
Ian McKellen,ian@example.com
Julia Roberts,julia@example.com`;

    await fs.writeFile(
      path.join(outputDir, 'test-data', 'users.csv'),
      usersCSV
    );

    // Generate products CSV
    const productsCSV = `title,price
Laptop Pro,1299.99
Wireless Mouse,29.99
Mechanical Keyboard,149.99
4K Monitor,599.99
USB-C Hub,79.99
Webcam HD,89.99
Bluetooth Headset,199.99
External SSD,249.99
Tablet Stand,39.99
Wireless Charger,49.99`;

    await fs.writeFile(
      path.join(outputDir, 'test-data', 'products.csv'),
      productsCSV
    );

    console.log(chalk.green('✅ Test data files generated'));
  }
}

export default AdvancedTestSuite;

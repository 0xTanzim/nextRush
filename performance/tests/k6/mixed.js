import { check, sleep } from 'k6';
import http from 'k6/http';

/**
 * K6 Load Test: Mixed Workload
 * Simulates realistic traffic with multiple request types
 */

export const options = {
  vus: 100,
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(95)<150', 'p(99)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const SEARCH_TERMS = [
  'nodejs',
  'typescript',
  'express',
  'koa',
  'fastify',
  'nextrush',
];
const NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];

export default function () {
  // Weighted random scenario (60% GET, 30% params/query, 10% POST)
  const rand = Math.random();

  if (rand < 0.3) {
    // 30% - Hello World
    const res = http.get(`${BASE_URL}/`);
    check(res, { 'hello: status 200': r => r.status === 200 });
  } else if (rand < 0.5) {
    // 20% - Route params
    const userId = Math.floor(Math.random() * 1000) + 1;
    const res = http.get(`${BASE_URL}/users/${userId}`);
    check(res, { 'params: status 200': r => r.status === 200 });
  } else if (rand < 0.7) {
    // 20% - Query params
    const q = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];
    const page = Math.floor(Math.random() * 10) + 1;
    const res = http.get(`${BASE_URL}/search?q=${q}&page=${page}`);
    check(res, { 'query: status 200': r => r.status === 200 });
  } else if (rand < 0.9) {
    // 20% - Another Hello (simulate high traffic endpoint)
    const res = http.get(`${BASE_URL}/`);
    check(res, { 'hello2: status 200': r => r.status === 200 });
  } else {
    // 10% - POST request
    const name = NAMES[Math.floor(Math.random() * NAMES.length)];
    const payload = JSON.stringify({
      name,
      email: `${name.toLowerCase()}@example.com`,
    });

    const res = http.post(`${BASE_URL}/users`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    check(res, { 'post: status 201': r => r.status === 201 });
  }

  sleep(0.1);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(data, null, 2),
  };
}

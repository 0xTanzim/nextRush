import { check, sleep } from 'k6';
import http from 'k6/http';

/**
 * K6 Load Test: Query Parameters
 * Tests query string parsing performance
 */

export const options = {
  vus: 100,
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(95)<100', 'p(99)<200'],
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

export default function () {
  const q = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];
  const page = Math.floor(Math.random() * 10) + 1;

  const res = http.get(`${BASE_URL}/search?q=${q}&page=${page}`);

  check(res, {
    'status is 200': r => r.status === 200,
    'response has query': r => r.json('query') !== undefined,
  });

  sleep(0.1);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(data, null, 2),
  };
}

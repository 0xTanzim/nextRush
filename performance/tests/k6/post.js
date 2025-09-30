import { check, sleep } from 'k6';
import http from 'k6/http';

/**
 * K6 Load Test: POST JSON
 * Tests JSON body parsing and response
 */

export const options = {
  vus: 100,
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(95)<150', 'p(99)<300'], // Slightly higher for POST
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];

export default function () {
  const name = NAMES[Math.floor(Math.random() * NAMES.length)];
  const email = `${name.toLowerCase()}@example.com`;

  const payload = JSON.stringify({
    name,
    email,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/users`, payload, params);

  check(res, {
    'status is 201': r => r.status === 201,
    'response has user': r => r.json('user') !== undefined,
  });

  sleep(0.1);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(data, null, 2),
  };
}

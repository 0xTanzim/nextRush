import { check, sleep } from 'k6';
import http from 'k6/http';

/**
 * K6 Load Test: Route Parameters
 * Tests dynamic route parameter parsing
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

export default function () {
  const userId = Math.floor(Math.random() * 1000) + 1;
  const res = http.get(`${BASE_URL}/users/${userId}`);

  check(res, {
    'status is 200': r => r.status === 200,
    'response has userId': r => r.json('userId') !== undefined,
  });

  sleep(0.1);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(data, null, 2),
  };
}

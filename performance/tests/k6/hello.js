import { check, sleep } from 'k6';
import http from 'k6/http';

/**
 * K6 Load Test: Hello World
 * Tests basic GET request performance
 */

export const options = {
  vus: 100, // 100 virtual users
  duration: '60s', // Run for 60 seconds
  thresholds: {
    http_req_duration: ['p(95)<100', 'p(99)<200'], // 95% < 100ms, 99% < 200ms
    http_req_failed: ['rate<0.01'], // Error rate < 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const res = http.get(`${BASE_URL}/`);

  check(res, {
    'status is 200': r => r.status === 200,
    'response has message': r => r.json('message') !== undefined,
  });

  sleep(0.1); // 100ms think time
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(data, null, 2),
  };
}

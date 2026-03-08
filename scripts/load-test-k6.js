/**
 * k6 load test. Install: https://k6.io/docs/get-started/installation/
 * Run: k6 run --vus 20 --duration 30s scripts/load-test-k6.js
 * Or: k6 run -e BASE_URL=http://localhost:4000 scripts/load-test-k6.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:4000';

export const options = {
  vus: 20,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get(`${baseUrl}/banners`);
  check(res, { 'status 200': (r) => r.status === 200 });
  sleep(0.5);
}

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const CONCURRENCY = Math.max(1, parseInt(process.env.CONCURRENCY || '8', 10));
const DURATION_MS = Math.max(1000, parseInt(process.env.DURATION_MS || '20000', 10));
const JWT = (process.env.JWT || '').trim();
const PATH = '/api/projects';
const EXPECT = parseInt(process.env.EXPECT_STATUS || (JWT ? '200' : '403'), 10);

function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return sorted[idx];
}

async function oneRequest() {
  const headers = {};
  if (JWT) headers.authorization = `Bearer ${JWT}`;
  const t0 = performance.now();
  const res = await fetch(`${BASE_URL}${PATH}`, { method: 'GET', headers });
  const ms = performance.now() - t0;
  const ok = res.status === EXPECT;
  return { ms, ok, status: res.status };
}

async function worker(signal, durations, mismatches, until) {
  while (performance.now() < until) {
    if (signal.aborted) break;
    try {
      const r = await oneRequest();
      durations.push(r.ms);
      if (!r.ok) mismatches.push(r.status);
    } catch {
      durations.push(NaN);
      mismatches.push('network');
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}

const controller = new AbortController();
const until = performance.now() + DURATION_MS;
process.once('SIGINT', () => controller.abort());

console.log(JSON.stringify({
  message: 'BuildFlow smoke load',
  BASE_URL,
  PATH,
  CONCURRENCY,
  DURATION_MS,
  mode: JWT ? 'authenticated (/api/projects + DB)' : 'light (403 без БД)',
  EXPECT,
}, null, 2));

const durations = [];
const mismatches = [];
const workers = [];

for (let i = 0; i < CONCURRENCY; i++) {
  workers.push(worker(controller.signal, durations, mismatches, until));
}

await Promise.all(workers);

const valid = durations.filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
const total = durations.length;
const failed = durations.filter((x) => Number.isNaN(x)).length;
const statusMismatch = mismatches.filter((x) => x !== 'network').length;

console.log('');
console.log('--- результат ---');
console.log(`Запросов всего (примерно за ${DURATION_MS} мс при ${CONCURRENCY} клиентах): ${total}`);
console.log(`Сеть/ошибок: ${failed}`);
console.log(`Неверный HTTP-код (ожидался ${EXPECT}): ${statusMismatch}`);
if (valid.length) {
  console.log(`Латентность мс — min: ${valid[0].toFixed(1)}  p50: ${pct(valid, 0.5).toFixed(1)}  p95: ${pct(valid, 0.95).toFixed(1)}  max: ${valid[valid.length - 1].toFixed(1)}`);
}
if (valid.length === 0) console.log('Нет успешных HTTP-ответов (сервер выключен или сеть недоступна?).');
process.exit(valid.length === 0 ? 2 : statusMismatch > 0 ? 1 : 0);



import { performance } from 'node:perf_hooks';

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const PATH = '/api/projects';
const JWT = (process.env.JWT || '').trim();
const EXPECT = parseInt(process.env.EXPECT_STATUS || (JWT ? '200' : '403'), 10);

const LEVELS = (process.env.RPS_LEVELS || '100,500,1000,5000,10000')
  .split(/[,;\s]+/)
  .map((s) => parseInt(s.trim(), 10))
  .filter((n) => Number.isFinite(n) && n > 0);

const SECONDS_PER_LEVEL = Math.max(1, parseInt(process.env.SECONDS_PER_LEVEL || '1', 10));
const BREAK_MS = Math.max(0, parseInt(process.env.BREAK_MS || '500', 10));

function avg(arr) {
  if (!arr.length) return NaN;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function verdict(completions, successes) {
  if (completions === 0 || successes === 0) return 'Ошибки';
  const noise = (completions - successes) / completions;
  if (noise > 0.05) return 'Ошибки';
  if (noise < 0.001) return 'Успешно';
  return 'С ограничениями';
}

async function generateLevel(targetRps) {
  const durationMs = SECONDS_PER_LEVEL * 1000;
  const idealGapMs = 1000 / targetRps;
  const headers = JWT ? { authorization: `Bearer ${JWT}` } : {};

  const genStart = performance.now();
  const genEnd = genStart + durationMs;
  let nextEmitAt = genStart;

  const inFlight = [];
  let plannedStarts = 0;
  let successes = 0;
  let completions = 0;
  let networkErr = 0;
  let statusWrong = 0;
  const okLatencyMs = [];

  while (nextEmitAt < genEnd) {
    let drift = nextEmitAt - performance.now();
    if (drift > 3) await new Promise((r) => setTimeout(r, drift - 2));
    while (performance.now() < nextEmitAt) 
    if (nextEmitAt >= genEnd) break;

    plannedStarts++;
    const t0 = performance.now();
    const p = fetch(`${BASE_URL}${PATH}`, { method: 'GET', headers })
      .then(async (res) => {
        const elapsed = performance.now() - t0;
        completions++;
        if (res.status === EXPECT) {
          successes++;
          okLatencyMs.push(elapsed);
        } else {
          statusWrong++;
        }
      })
      .catch(() => {
        completions++;
        networkErr++;
      });
    inFlight.push(p.then(() => {}, () => {}));
    nextEmitAt += idealGapMs;
  }

  await Promise.all(inFlight);

  const meanMs = Math.round(avg(okLatencyMs));
  const label = verdict(completions, successes);

  return {
    targetRps,
    plannedStarts,
    successes,
    meanMs,
    label,
    completions,
    networkErr,
    statusWrong,
  };
}

console.log(JSON.stringify({
  описание: 'Нагрузка по шкале: равномерные старты запросов в течение SECONDS_PER_LEVEL секунд на каждом уровне.',
  BASE_URL,
  SECONDS_PER_LEVEL,
  BREAK_MS,
  HTTP_ожидается: EXPECT,
  уровни: LEVELS,
}, null, 2));
console.log('');
console.log('Скопируйте блок из markdown (или строки ниже без разметки под Word):');
console.log('');
console.log('| Количество запросов в секунду | Количество успешных ответов | Среднее время ответа, мс | Итог |');
console.log('| --- | --- | --- | --- |');

for (const rps of LEVELS) {
  const row = await generateLevel(rps);
  const meanDisp = Number.isFinite(row.meanMs) ? String(row.meanMs) : '—';
  console.log(`| ${rps} | ${row.successes} | ${meanDisp} | ${row.label} |`);
  if (process.env.DEBUG) {
    console.error(`  DEBUG RPS=${rps} plannedStarts=${row.plannedStarts} completions=${row.completions} net=${row.networkErr} wrongStatus=${row.statusWrong}`);
  }
  if (BREAK_MS) await new Promise((r) => setTimeout(r, BREAK_MS));
}


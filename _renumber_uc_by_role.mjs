/**
 * Одноразовый скрипт: нумерация ВИ по порядку ролей (Гость → Заказчик → Прораб → Админ),
 * внутри — предзаказ extend-дерева (DFS, сортировка детей по y,x).
 */
import fs from 'fs';

const PATH = String.raw`C:\лабы\Смелов\Курсовой ПСКП\krasiviy_BuildFlow.drawio`;

const BADGE_BY_UC = {
  '-bVFyQDbasuCn2xpr5fs-5': 'num_bVFyQDbasuCn2xpr5fs_5',
  'oFKxOYL716g8i54R1PBJ-2': 'num_oFKxOYL716g8i54R1PBJ_2',
  'oFKxOYL716g8i54R1PBJ-3': 'num_oFKxOYL716g8i54R1PBJ_3',
  'oFKxOYL716g8i54R1PBJ-7': 'num_oFKxOYL716g8i54R1PBJ_7',
  bf_return_task_work: 'num_bf_return_task_work',
  bf_cancel_stage_approval: 'num_bf_cancel_stage_approval',
  bf_admin_edit_name_desc: 'num_bf_admin_edit_name_desc',
  bf_admin_edit_dates: 'num_bf_admin_edit_dates',
  bf_admin_edit_status: 'num_bf_admin_edit_status',
  bf_admin_edit_members: 'num_bf_admin_edit_members',
  bf_admin_delete_project: 'num_bf_admin_delete_project',
  'Xd6uOhpPjqJKYdWFGcpG-4': 'Xd6uOhpPjqJKYdWFGcpG-6',
};

function badgeForUc(id) {
  if (/^uc\d+$/.test(id)) return `n${id.slice(2)}`;
  return BADGE_BY_UC[id];
}

function parseGeometry(xml, cellId) {
  const esc = cellId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = xml.match(
    new RegExp(`<mxCell id="${esc}"[^>]*>[\\s\\S]*?<mxGeometry([^>]+)>`, 'm'),
  );
  if (!m) return { x: 0, y: 0 };
  const g = m[1];
  const px = /\bx="([-\d.]+)"/.exec(g);
  const py = /\by="([-\d.]+)"/.exec(g);
  return {
    x: px ? parseFloat(px[1]) : 0,
    y: py ? parseFloat(py[1]) : 0,
  };
}

function cmp(a, b, xml) {
  const ga = parseGeometry(xml, a);
  const gb = parseGeometry(xml, b);
  if (ga.y !== gb.y) return ga.y - gb.y;
  return ga.x - gb.x;
}

let xml = fs.readFileSync(PATH, 'utf8');

const ALL_USE_CASE_IDS = new Set();
const reUc =
  /<mxCell id="([^"]+)" parent="1" style="ellipse[^"]*fontFamily=Times New Roman;fontSize=14;/g;
let rm;
while ((rm = reUc.exec(xml)) !== null) ALL_USE_CASE_IDS.add(rm[1]);

const EXT_SOURCES = new Set();
const childrenByTarget = new Map();

for (let i = 1; i < xml.split('<mxCell id=').length; i++) {
  const chunk = xml.split('<mxCell id=')[i];
  if (!chunk.includes('edge="1"')) continue;
  if (!chunk.includes('extend')) continue;
  const s = /source="([^"]+)"/.exec(chunk);
  const t = /target="([^"]+)"/.exec(chunk);
  if (!s || !t) continue;
  const src = s[1];
  const tgt = t[1];
  if (!ALL_USE_CASE_IDS.has(src) || !ALL_USE_CASE_IDS.has(tgt)) continue;
  EXT_SOURCES.add(src);
  if (!childrenByTarget.has(tgt)) childrenByTarget.set(tgt, []);
  childrenByTarget.get(tgt).push(src);
}

function actorTargets(actorId) {
  const out = [];
  const escaped = actorId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reEdges = new RegExp(
    `<mxCell[^>]*edge="1"[^>]*source="${escaped}"[^>]*target="([^"]+)"`,
    'g',
  );
  let m;
  while ((m = reEdges.exec(xml)) !== null) {
    const t = m[1];
    if (ALL_USE_CASE_IDS.has(t)) out.push(t);
  }
  return out;
}

const tierSeeds = [
  actorTargets('guest'),
  actorTargets('client'),
  actorTargets('builder'),
  actorTargets('admin'),
];

const assigned = new Set();
const globalOrder = [];

function preorder(ucId) {
  if (assigned.has(ucId)) return;
  assigned.add(ucId);
  globalOrder.push(ucId);
  const kids = (childrenByTarget.get(ucId) || []).slice();
  kids.sort((a, b) => cmp(a, b, xml));
  for (const k of kids) preorder(k);
}

for (const seeds of tierSeeds) {
  const sorted = [...new Set(seeds)].sort((a, b) => cmp(a, b, xml));
  for (const seed of sorted) preorder(seed);
}

if (globalOrder.length !== ALL_USE_CASE_IDS.size) {
  const missing = [...ALL_USE_CASE_IDS].filter((id) => !assigned.has(id));
  throw new Error(`Не охвачено ролями или extend: ${missing.join(', ')}`);
}

const assignments = new Map();
globalOrder.forEach((id, i) => assignments.set(id, String(i + 1)));

for (const [ucId, num] of assignments) {
  const badge = badgeForUc(ucId);
  if (!badge) throw new Error(ucId);
  const esc = badge.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  xml = xml.replace(
    new RegExp(`(<mxCell id="${esc}" parent="1" style="[^"]*" value=")[^"]*(" vertex="1">)`, ''),
    `$1${num}$2`,
  );
}

fs.writeFileSync(PATH, xml, 'utf8');
console.log('OK, порядок:', globalOrder.join(' → '));

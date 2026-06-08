/**
 * 合并三个裁判的评分结果
 * 用法: node merge_judges.js
 */
const fs = require('fs');
const path = require('path');

const BASE_DIR = 'C:/Users/xingyun/Desktop/MiniMax-m3-评测项目';
const TASKS_PATH = path.join(BASE_DIR, '03-data/tasks_v3.json');
const OUTPUT_DIR = path.join(BASE_DIR, '03-data');

const JUDGES = [
  { name: 'gpt55', display: 'GPT-5.5' },
  { name: 'deepseek', display: 'deepseek-v4-flash' },
  { name: 'minimax', display: 'MiniMax-M3' },
];

function loadJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; } }
function saveJSON(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf-8'); }

console.log('='.repeat(60));
console.log('合并三个裁判评分，取平均值...');
console.log('='.repeat(60));

const merged = {};
const judgeNames = JUDGES.map(j => j.name);

const judgeResults = {};
for (const j of JUDGES) {
  const p = path.join(OUTPUT_DIR, `judgments_${j.name}.json`);
  judgeResults[j.name] = loadJSON(p) || {};
  const totalCount = Object.values(judgeResults[j.name]).reduce((sum, modelMap) => sum + Object.keys(modelMap).length, 0);
  console.log(`  ${j.display}: ${totalCount} 条评分`);
}

const tasks = loadJSON(TASKS_PATH) || [];
const modelNames = Object.keys(judgeResults[judgeNames[0]]);

for (const model of modelNames) {
  merged[model] = {};
  for (const task of tasks) {
    const tid = task.task_id;
    const scores = [];
    const reasons = [];

    for (const jn of judgeNames) {
      const r = judgeResults[jn][model]?.[tid];
      if (r && typeof r.score === 'number') {
        scores.push(r.score);
        reasons.push(`${jn}=${r.score}`);
      }
    }

    if (scores.length > 0) {
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) / 100;
      const std = scores.length > 1
        ? Math.round(Math.sqrt(scores.reduce((s, x) => s + Math.pow(x - avg, 2), 0) / scores.length) * 100) / 100
        : 0;
      merged[model][tid] = {
        score: avg,
        std,
        individual: reasons.join(', '),
        dim: task.dim,
      };
    }
  }
}

const mergedPath = path.join(OUTPUT_DIR, 'judgments_merged.json');
saveJSON(mergedPath, merged);

const dimGroups = {};
tasks.forEach(t => {
  const d = t.dim;
  if (!dimGroups[d]) dimGroups[d] = [];
  dimGroups[d].push(t.task_id);
});

const report = {};
for (const model of modelNames) {
  report[model] = {};
  for (const [dim, taskIds] of Object.entries(dimGroups)) {
    const scores = taskIds.map(tid => merged[model]?.[tid]?.score).filter(s => typeof s === 'number');
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) / 100 : 0;
    report[model][dim] = { avg, count: scores.length, scores };
  }
  const allScores = Object.values(report[model]).flatMap(d => d.scores);
  report[model]._overall = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length * 100) / 100 : 0;
  report[model]._total = allScores.length;
}

const reportPath = path.join(OUTPUT_DIR, 'eval_report_merged.json');
saveJSON(reportPath, report);

console.log('\n合并完成！');
console.log('  合并评分:', mergedPath);
console.log('  合并报告:', reportPath);

console.log('\n=== 三裁判平均分排名 ===');
const ranked = modelNames.slice().sort((a, b) => report[b]._overall - report[a]._overall);
ranked.forEach((m, i) => {
  console.log(`  ${i + 1}. ${m}: ${report[m]._overall}/10`);
});

console.log('\n=== 分维度均分 ===');
const dims = Object.keys(dimGroups);
console.log('维度'.padEnd(20), ...ranked.map(m => m.padStart(18)));
for (const dim of dims) {
  const row = [dim.padEnd(20)];
  for (const m of ranked) {
    row.push(String(report[m][dim]?.avg ?? 0).padStart(18));
  }
  console.log(...row);
}

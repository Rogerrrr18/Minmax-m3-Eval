/**
 * 评测报告生成器 v3.0
 * 生成 JSON/Markdown 两种格式的评测报告
 *
 * 用法: node report_v3.js
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = 'C:/Users/xingyun/Desktop/MiniMax-m3-评测项目';
const JUDGE_PATH = path.join(BASE_DIR, '03-data/judgments_v3.json');
const TASKS_PATH = path.join(BASE_DIR, '03-data/tasks_v3.json');
const AUTO_VAL_PATH = path.join(BASE_DIR, '03-data/auto_validation_v3.json');
const REPORT_JSON = path.join(BASE_DIR, '03-data/eval_report_v3.json');
const REPORT_MD = path.join(BASE_DIR, '03-data/eval_report_v3.md');

function loadJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}
function saveJSON(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf-8'); }

const judgments = loadJSON(JUDGE_PATH) || {};
const tasks = loadJSON(TASKS_PATH) || [];
const autoVal = loadJSON(AUTO_VAL_PATH) || {};
const taskMap = {};
tasks.forEach(t => taskMap[t.task_id] = t);

const modelNames = Object.keys(judgments);
const dims = [...new Set(tasks.map(t => t.dim))];

// ============ 计算统计 ============

const stats = {};
for (const model of modelNames) {
  stats[model] = {};
  const scores = Object.values(judgments[model] || {});

  // 按维度
  for (const dim of dims) {
    const dimScores = scores.filter(s => {
      const tid = Object.keys(judgments[model]).find(k => judgments[model][k] === s);
      return taskMap[tid]?.dim === dim;
    });
    if (dimScores.length) {
      stats[model][dim] = {
        avg: parseFloat((dimScores.reduce((a, b) => a + b.score, 0) / dimScores.length).toFixed(2)),
        count: dimScores.length,
        scores: dimScores.map(s => s.score),
      };
    }
  }

  // 综合
  stats[model]._overall = parseFloat((scores.reduce((a, b) => a + b.score, 0) / scores.length).toFixed(2));
  stats[model]._total = scores.length;
}

// ============ 错误分类统计 ============

const errorStats = {};
for (const model of modelNames) {
  errorStats[model] = { empty: 0, truncated: 0, lowScore: 0, total: 0 };
  const mAuto = autoVal[model] || {};
  for (const [tid, v] of Object.entries(mAuto)) {
    errorStats[model].total++;
    if (v.score === 0) errorStats[model].empty++;
    if (v.truncated) errorStats[model].truncated++;
    if (v.score <= 1) errorStats[model].lowScore++;
  }
}

// ============ 生成 JSON 报告 ============

saveJSON(REPORT_JSON, {
  meta: {
    version: '3.0',
    date: new Date().toISOString(),
    models: modelNames,
    dimensions: dims,
    totalTasks: tasks.length,
  },
  results: stats,
  errorAnalysis: errorStats,
  radarData: modelNames.map(m => ({
    model: m,
    dimensions: dims.map(d => ({
      dim: d,
      score: stats[m][d]?.avg ?? 0,
    })),
    overall: stats[m]._overall,
  })),
});

// ============ 生成 Markdown 报告 ============

let md = `# MiniMax-m3 科学评测报告 v3.0\n\n`;
md += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
md += `> 评测模型: ${modelNames.join(', ')}\n`;
md += `> 总题数: ${tasks.length}（${dims.length} 个维度）\n\n`;

// 1. 综合排名
md += `## 一、综合排名\n\n`;
md += `| 排名 | 模型 | 综合均分 | 总题数 |\n`;
md += `|------|------|----------|--------|\n`;
const ranked = modelNames.slice().sort((a, b) => stats[b]._overall - stats[a]._overall);
ranked.forEach((m, i) => {
  md += `| ${i + 1} | ${m} | **${stats[m]._overall}** | ${stats[m]._total} |\n`;
});

// 2. 分维度对比
md += `\n## 二、分维度得分对比\n\n`;
md += `| 维度 | ${modelNames.join(' | ')} |\n`;
md += `|------|${modelNames.map(() => '------').join('|')}|\n`;
for (const dim of dims) {
  const cells = modelNames.map(m => {
    const s = stats[m][dim];
    return s ? `${s.avg} (${s.count})` : 'N/A';
  });
  md += `| ${dim} | ${cells.join(' | ')} |\n`;
}

// 3. 雷达图数据（JSON 代码块）
md += `\n## 三、雷达图数据（供可视化使用）\n\n`;
md += '```json\n';
md += JSON.stringify(
  modelNames.map(m => ({
    model: m,
    data: dims.map(d => ({ axis: d, value: stats[m][d]?.avg ?? 0 })),
  })),
  null,
  2
);
md += '\n```\n';

// 4. 错误分析
md += `\n## 四、输出质量分析\n\n`;
md += `| 模型 | 总调用 | 空/错误 | 截断 | 低分(≤1) | 健康率 |\n`;
md += `|------|--------|---------|------|----------|--------|\n`;
for (const model of modelNames) {
  const e = errorStats[model];
  const healthy = e.total > 0 ? (((e.total - e.empty - e.truncated) / e.total) * 100).toFixed(1) : '0';
  md += `| ${model} | ${e.total} | ${e.empty} | ${e.truncated} | ${e.lowScore} | ${healthy}% |\n`;
}

// 5. 评分标准说明
md += `\n## 五、评分标准\n\n`;
md += `- 采用 **0-10 分制**，由 GPT-5.5 独立裁判评分\n`;
md += `- 代码/SQL/算法类先做自动验证（基础分 0-3），再结合 LLM 深度评分\n`;
md += `- 办公/NLP 类直接由 LLM 按维度专门标准评分\n`;
md += `- 每个模型独立评分，消除位置偏见\n`;

// 6. 与 v2.0 对比（如果有旧数据）
const oldReport = loadJSON(path.join(BASE_DIR, '03-data/eval_report.json'));
if (oldReport) {
  md += `\n## 六、与 v2.0 对比（5维度）\n\n`;
  md += `| 模型 | v2.0 综合 | v3.0 综合 | 变化 |\n`;
  md += `|------|-----------|-----------|------|\n`;
  for (const m of modelNames) {
    const old = oldReport[m]?._overall ?? 'N/A';
    const neu = stats[m]?._overall ?? 'N/A';
    const change = typeof old === 'number' && typeof neu === 'number' ? (neu - old * 5).toFixed(2) : 'N/A';
    md += `| ${m} | ${old} | ${neu} | ${change} |\n`;
  }
  md += `\n> 注: v2.0 为 0-2 分制，v3.0 为 0-10 分制。变化列已按比例换算。\n`;
}

md += `\n---\n*报告由 eval_v3.js 自动生成*\n`;

fs.writeFileSync(REPORT_MD, md, 'utf-8');

console.log('='.repeat(60));
console.log('评测报告生成完成');
console.log('='.repeat(60));
console.log(`JSON报告: ${REPORT_JSON}`);
console.log(`Markdown报告: ${REPORT_MD}`);
console.log('\n模型排名:');
ranked.forEach((m, i) => {
  console.log(`  ${i + 1}. ${m}: ${stats[m]._overall}/10`);
});

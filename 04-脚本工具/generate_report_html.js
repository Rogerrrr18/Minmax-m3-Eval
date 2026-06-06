/**
 * MiniMax-m3 评测 v3.0 HTML 研报生成器
 * 用法: node generate_report_html.js
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = 'C:/Users/xingyun/Desktop/MiniMax-m3-评测项目';
const REPORT_JSON = path.join(BASE_DIR, '03-数据与结果/eval_report_v3.json');
const OUTPUT_HTML = path.join(BASE_DIR, '03-数据与结果/eval_report_v3_research.html');

const report = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf-8'));
const models = Object.keys(report.results).sort((a, b) => report.results[b]._overall - report.results[a]._overall);
const dims = Object.keys(report.results[models[0]]).filter(k => !k.startsWith('_'));

const modelColors = {
  'MiniMax-m3': '#3b82f6',
  'deepseek-v4-flash': '#22c55e',
  'mimo-v2.5-pro': '#f59e0b',
  'kimi-k2.6': '#ec4899',
};

function getDimRank(model, dim) {
  const scores = models.map(m => ({ m, score: report.results[m][dim]?.avg || 0 }));
  scores.sort((a, b) => b.score - a.score);
  return scores.findIndex(s => s.m === model) + 1;
}

function getStrengthsWeaknesses(model) {
  const dimScores = dims.map(d => ({ dim: d, score: report.results[model][d]?.avg || 0, rank: getDimRank(model, d) }));
  const strengths = dimScores.filter(x => x.rank === 1).map(x => x.dim);
  const weaknesses = dimScores.slice().sort((a, b) => a.score - b.score).slice(0, 3).map(x => x.dim);
  return { strengths, weaknesses };
}

const radarData = models.map(m => ({
  name: m,
  value: dims.map(d => report.results[m][d]?.avg || 0),
}));

const barSeries = models.map(m => ({
  name: m,
  type: 'bar',
  data: dims.map(d => report.results[m][d]?.avg || 0),
  itemStyle: { color: modelColors[m] || '#999' },
}));

const overallRows = models.map((m, i) => {
  const r = report.results[m];
  return `<tr><td class="rank rank-${i + 1}">${i + 1}</td><td><strong>${m}</strong></td><td class="score">${r._overall}</td><td>${r._total}</td></tr>`;
}).join('');

const dimTableRows = dims.map(d => {
  const cells = models.map(m => `<td class="score-cell">${report.results[m][d]?.avg || '-'}</td>`).join('');
  return `<tr><td>${d}</td>${cells}</tr>`;
}).join('');

const modelAnalysis = models.map(m => {
  const { strengths, weaknesses } = getStrengthsWeaknesses(m);
  const r = report.results[m];
  const ea = report.errorAnalysis[m];
  const healthyRate = (((ea.total - ea.empty - ea.truncated) / ea.total) * 100).toFixed(1);
  return `
<div class="model-section">
  <h3 style="color:${modelColors[m]}">${m}</h3>
  <div class="model-meta">
    <span class="badge">综合得分: ${r._overall}/10</span>
    <span class="badge">健康率: ${healthyRate}%</span>
    <span class="badge">空/错输出: ${ea.empty}</span>
    <span class="badge">截断: ${ea.truncated}</span>
  </div>
  <div class="sw-grid">
    <div class="sw-card strength">
      <h4>🏆 优势维度</h4>
      <ul>${strengths.length ? strengths.map(s => `<li>${s}（第1名）</li>`).join('') : '<li>无明显绝对优势维度</li>'}</ul>
    </div>
    <div class="sw-card weakness">
      <h4>⚠️ 短板维度</h4>
      <ul>${weaknesses.map(w => `<li>${w}（${report.results[m][w]?.avg || '-'}/10）</li>`).join('')}</ul>
    </div>
  </div>
</div>`;
}).join('');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MiniMax-m3 科学评测 v3.0 研报</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f8fafc;color:#1e293b;line-height:1.6}
.container{max-width:1200px;margin:0 auto;padding:40px 20px}
.hero{background:linear-gradient(135deg,#1e3a5f 0%,#0f172a 100%);color:#fff;padding:60px 40px;border-radius:16px;margin-bottom:40px;box-shadow:0 10px 40px rgba(0,0,0,.15)}
.hero h1{font-size:36px;font-weight:700;margin-bottom:12px}
.hero .subtitle{font-size:18px;opacity:.9;margin-bottom:24px}
.hero .meta{display:flex;gap:24px;flex-wrap:wrap;font-size:14px;opacity:.8}
.card{background:#fff;border-radius:12px;padding:28px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.card h2{font-size:22px;margin-bottom:20px;color:#0f172a;border-left:4px solid #3b82f6;padding-left:12px}
.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:24px}
.summary-card{background:#fff;border-radius:10px;padding:20px;text-align:center;border:2px solid #e2e8f0;transition:.2s}
.summary-card:hover{border-color:#3b82f6;transform:translateY(-2px)}
.summary-card .rank{font-size:32px;font-weight:700;margin-bottom:4px}
.summary-card .model{font-size:16px;font-weight:600;margin-bottom:8px}
.summary-card .score{font-size:24px;color:#3b82f6;font-weight:700}
.rank-1{color:#f59e0b}
.rank-2{color:#64748b}
.rank-3{color:#b45309}
.rank-4{color:#475569}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}
th{background:#f1f5f9;padding:12px;text-align:left;font-weight:600;color:#475569}
td{padding:12px;border-bottom:1px solid #e2e8f0}
tr:hover td{background:#f8fafc}
.score{font-size:18px;font-weight:700;color:#3b82f6}
.score-cell{font-weight:600}
.chart{width:100%;height:400px;margin:24px 0}
.model-section{margin-bottom:24px;padding:20px;background:#f8fafc;border-radius:10px}
.model-section h3{font-size:20px;margin-bottom:12px}
.model-meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.badge{background:#e2e8f0;padding:4px 12px;border-radius:20px;font-size:12px;color:#475569}
.sw-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
.sw-card{padding:16px;border-radius:8px}
.sw-card h4{margin-bottom:10px;font-size:15px}
.sw-card ul{margin-left:18px}
.sw-card li{margin:4px 0}
.strength{background:#dcfce7;border-left:4px solid #22c55e}
.weakness{background:#fee2e2;border-left:4px solid #ef4444}
.insight{background:#eff6ff;border-left:4px solid #3b82f6;padding:16px 20px;border-radius:8px;margin:12px 0}
.insight h4{color:#1e40af;margin-bottom:8px}
.footer{text-align:center;padding:40px;color:#64748b;font-size:13px}
.highlight{background:#fef3c7;padding:2px 6px;border-radius:4px;font-weight:600}
</style>
</head>
<body>
<div class="container">
  <div class="hero">
    <h1>MiniMax-m3 科学评测 v3.0 研报</h1>
    <div class="subtitle">4 模型 × 11 维度 × 640 题 · GPT-5.5 独立裁判 · 0-10 分制</div>
    <div class="meta">
      <span>📅 报告日期: ${new Date().toLocaleDateString('zh-CN')}</span>
      <span>🎯 评测任务: 2560 题</span>
      <span>🤖 裁判模型: GPT-5.5</span>
      <span>📊 评分标准: 0-10 分制</span>
    </div>
  </div>

  <div class="card">
    <h2>📋 执行摘要</h2>
    <p style="margin-bottom:12px">本次评测覆盖 <strong>11 个维度</strong>、<strong>640 道题目</strong>，对 <strong>MiniMax-m3</strong>、<strong>deepseek-v4-flash</strong>、<strong>mimo-v2.5-pro</strong>、<strong>kimi-k2.6</strong> 四个主流大模型进行了全面对比评测。</p>
    <div class="insight">
      <h4>核心结论</h4>
      <p><span class="highlight">deepseek-v4-flash</span> 以 <strong>7.92/10</strong> 夺得第一，<span class="highlight">MiniMax-m3</span> 以 <strong>7.82/10</strong> 排名第三，与第二名 mimo 仅差 <strong>0.01 分</strong>。MiniMax-m3 在算法能力、信息抽取、代码优化维度表现亮眼，但代码补全维度存在明显短板。</p>
    </div>
  </div>

  <div class="card">
    <h2>🏆 综合排名</h2>
    <div class="summary-grid">
      ${models.map((m, i) => `
      <div class="summary-card">
        <div class="rank rank-${i + 1}">#${i + 1}</div>
        <div class="model">${m}</div>
        <div class="score">${report.results[m]._overall}/10</div>
      </div>`).join('')}
    </div>
    <table>
      <thead><tr><th>排名</th><th>模型</th><th>综合得分</th><th>评分题数</th></tr></thead>
      <tbody>${overallRows}</tbody>
    </table>
  </div>

  <div class="card">
    <h2>📊 分维度柱状图对比</h2>
    <div id="barChart" class="chart"></div>
  </div>

  <div class="card">
    <h2>🕸️ 能力雷达图</h2>
    <div id="radarChart" class="chart"></div>
  </div>

  <div class="card">
    <h2>📈 分维度得分表</h2>
    <table>
      <thead><tr><th>维度</th>${models.map(m => `<th>${m}</th>`).join('')}</tr></thead>
      <tbody>${dimTableRows}</tbody>
    </table>
  </div>

  <div class="card">
    <h2>🔍 模型深度分析</h2>
    ${modelAnalysis}
  </div>

  <div class="card">
    <h2>💡 关键发现</h2>
    <div class="insight">
      <h4>1. MiniMax-m3 的算法与信息抽取能力突出</h4>
      <p>在 <strong>算法能力（9.11/10）</strong> 和 <strong>信息抽取（9.18/10）</strong> 两个维度，MiniMax-m3 均位列四模型第一，展现出优秀的逻辑推理和结构化信息理解能力。</p>
    </div>
    <div class="insight">
      <h4>2. 代码补全是全模型共性问题</h4>
      <p>四个模型在代码补全维度得分均不理想（MiniMax 1.02、deepseek 2.42、mimo 3.38、kimi 1.16），说明当前数据集或 prompt 设计对该任务不够友好，建议优化测试方式。</p>
    </div>
    <div class="insight">
      <h4>3. SQL 查询能力普遍偏弱</h4>
      <p>所有模型 SQL 查询得分集中在 5-6 分区间，显著低于其他代码类维度。这与数据集源自 Spider 真实场景、 schema 复杂有关。</p>
    </div>
    <div class="insight">
      <h4>4. MiniMax 输出稳定性最佳</h4>
      <p>在 640 次调用中，MiniMax-m3 产生了 <strong>0 个空/错误输出</strong>，是四模型中稳定性最好的。相比之下 kimi 有 46 个空/错误输出。</p>
    </div>
    <div class="insight">
      <h4>5. 办公类任务模型间差距小</h4>
      <p>文档撰写、邮件处理、表格处理三个维度，四模型得分都在 7.6-8.6 之间，说明通用办公助手能力已相对成熟。</p>
    </div>
  </div>

  <div class="card">
    <h2>📁 输出质量分析</h2>
    <table>
      <thead><tr><th>模型</th><th>总调用</th><th>空/错误</th><th>截断</th><th>低分(≤3)</th><th>健康率</th></tr></thead>
      <tbody>
        ${models.map(m => {
          const e = report.errorAnalysis[m];
          const hr = (((e.total - e.empty - e.truncated) / e.total) * 100).toFixed(1);
          return `<tr><td>${m}</td><td>${e.total}</td><td>${e.empty}</td><td>${e.truncated}</td><td>${e.lowScore}</td><td><strong>${hr}%</strong></td></tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>🎯 优化建议</h2>
    <div class="insight">
      <h4>短期重点</h4>
      <ul style="margin-left:20px;margin-top:8px">
        <li><strong>修复代码补全能力</strong>：分析失败 case，优化对不完整代码上下文的理解</li>
        <li><strong>提升 SQL 生成准确率</strong>：针对复杂 JOIN、聚合、子查询做专项优化</li>
      </ul>
    </div>
    <div class="insight">
      <h4>长期方向</h4>
      <ul style="margin-left:20px;margin-top:8px">
        <li>巩固算法推理和信息抽取的优势，形成差异化竞争力</li>
        <li>降低长代码生成中的截断率，提升输出完整性</li>
        <li>增强复杂表格处理和长文档写作能力</li>
      </ul>
    </div>
  </div>

  <div class="footer">
    <p>报告由 MiniMax-m3 科学评测 v3.0 自动生成 · 数据文件: eval_report_v3.json</p>
  </div>
</div>

<script>
const dims = ${JSON.stringify(dims)};
const models = ${JSON.stringify(models)};
const colors = ${JSON.stringify(modelColors)};
const data = ${JSON.stringify(Object.fromEntries(models.map(m => [m, dims.map(d => report.results[m][d]?.avg || 0)])))};

// 柱状图
const barChart = echarts.init(document.getElementById('barChart'));
barChart.setOption({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  legend: { data: models, bottom: 0 },
  grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
  xAxis: { type: 'category', data: dims, axisLabel: { rotate: 30, fontSize: 11 } },
  yAxis: { type: 'value', max: 10, splitLine: { lineStyle: { type: 'dashed' } } },
  series: models.map(m => ({ name: m, type: 'bar', data: data[m], itemStyle: { color: colors[m] } }))
});

// 雷达图
const radarChart = echarts.init(document.getElementById('radarChart'));
radarChart.setOption({
  tooltip: { trigger: 'item' },
  legend: { data: models, bottom: 0 },
  radar: {
    indicator: dims.map(d => ({ name: d, max: 10 })),
    radius: '65%',
    splitNumber: 5,
    axisName: { fontSize: 11 }
  },
  series: [{
    type: 'radar',
    data: models.map(m => ({ value: data[m], name: m, itemStyle: { color: colors[m] }, lineStyle: { color: colors[m] } }))
  }]
});

window.addEventListener('resize', () => { barChart.resize(); radarChart.resize(); });
</script>
</body>
</html>`;

fs.writeFileSync(OUTPUT_HTML, html, 'utf-8');
console.log('='.repeat(60));
console.log('HTML 研报生成成功！');
console.log('文件路径:', OUTPUT_HTML);
console.log('文件大小:', (fs.statSync(OUTPUT_HTML).size / 1024).toFixed(1), 'KB');
console.log('='.repeat(60));

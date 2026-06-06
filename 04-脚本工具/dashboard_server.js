/**
 * MiniMax-m3 评测实时监控 Dashboard Server
 * 用法: node dashboard_server.js [端口，默认 3456]
 * 然后在浏览器打开 http://localhost:3456
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = parseInt(process.argv[2], 10) || 3456;
const BASE_DIR = 'C:/Users/xingyun/Desktop/MiniMax-m3-评测项目';
const CHECKPOINT_DIR = path.join(BASE_DIR, '03-数据与结果/checkpoints');

// 各维度题目数
const DIM_COUNTS = {
  '代码生成': 100, 'SQL查询': 50, '算法能力': 80, '代码补全': 50,
  '错误修复': 60, '代码优化': 50, '多语言办公': 50, '信息抽取': 50,
  '文档撰写': 50, '邮件处理': 50, '表格处理': 50,
};
const TOTAL_PER_MODEL = 640;

function getProgress() {
  const result = {};
  try {
    const files = fs.readdirSync(CHECKPOINT_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      // 文件名格式: MiniMax-m3_代码生成.json 或 deepseek-v4-flash_代码生成.json
      const base = file.replace('.json', '');
      const lastUnderscore = base.lastIndexOf('_');
      if (lastUnderscore < 0) continue;
      const dim = base.slice(lastUnderscore + 1).replace(/_/g, '');
      const model = base.slice(0, lastUnderscore);

      const cpPath = path.join(CHECKPOINT_DIR, file);
      const cp = JSON.parse(fs.readFileSync(cpPath, 'utf-8'));
      const keys = Object.keys(cp);
      const success = keys.filter(k => !k.startsWith('_') && cp[k].status === 'success').length;
      const error = keys.filter(k => !k.startsWith('_') && cp[k].status === 'error').length;
      const truncated = keys.filter(k => !k.startsWith('_') && cp[k].truncated).length;

      if (!result[model]) result[model] = {};
      result[model][dim] = { done: keys.length, success, error, truncated, total: DIM_COUNTS[dim] || 50 };
    }
  } catch (e) {
    console.error('读取 checkpoint 失败:', e.message);
  }
  return result;
}

const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MiniMax-m3 评测实时监控</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#0f172a; color:#e2e8f0; }
  .header { background:linear-gradient(90deg,#1e3a5f,#0f172a); padding:24px 32px; border-bottom:1px solid #334155; }
  .header h1 { font-size:24px; font-weight:600; }
  .header .subtitle { color:#94a3b8; font-size:14px; margin-top:4px; }
  .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(320px,1fr)); gap:20px; padding:24px 32px; }
  .card { background:#1e293b; border-radius:12px; padding:20px; border:1px solid #334155; }
  .card h3 { font-size:16px; margin-bottom:12px; color:#f8fafc; }
  .model-card { background:#1e293b; border-radius:12px; padding:20px; border:1px solid #334155; }
  .model-name { font-size:18px; font-weight:600; margin-bottom:8px; }
  .model-summary { display:flex; gap:16px; margin-bottom:12px; flex-wrap:wrap; }
  .badge { background:#334155; padding:4px 10px; border-radius:6px; font-size:12px; }
  .badge.ok { background:#166534; color:#86efac; }
  .badge.warn { background:#713f12; color:#fde047; }
  .badge.err { background:#7f1d1d; color:#fca5a5; }
  .dim-row { display:flex; align-items:center; gap:10px; margin:6px 0; font-size:13px; }
  .dim-label { width:80px; text-align:right; color:#94a3b8; }
  .dim-bar-wrap { flex:1; height:18px; background:#334155; border-radius:9px; overflow:hidden; }
  .dim-bar { height:100%; border-radius:9px; transition:width 0.5s ease; }
  .dim-bar.success { background:linear-gradient(90deg,#22c55e,#16a34a); }
  .dim-bar.partial { background:linear-gradient(90deg,#f59e0b,#d97706); }
  .dim-count { width:60px; text-align:right; font-variant-numeric:tabular-nums; }
  .footer { text-align:center; padding:20px; color:#64748b; font-size:12px; }
  .log { background:#0f172a; border:1px solid #334155; border-radius:8px; padding:12px; font-family:monospace; font-size:12px; max-height:200px; overflow-y:auto; }
  .log-line { margin:2px 0; }
  .log-time { color:#64748b; }
</style>
</head>
<body>
<div class="header">
  <h1>🚀 MiniMax-m3 科学评测 v3.0 实时监控</h1>
  <div class="subtitle">4 模型 × 11 维度 × 640 题 | 自动刷新每 5 秒</div>
</div>

<div class="grid">
  <div class="card"><div id="overallChart" style="width:100%;height:280px;"></div></div>
  <div class="card"><div id="dimChart" style="width:100%;height:280px;"></div></div>
  <div class="card" id="logCard" style="grid-column:1/-1;">
    <h3>📋 最新动态</h3>
    <div class="log" id="logBox">等待数据...</div>
  </div>
</div>

<div id="modelsContainer" class="grid"></div>

<div class="footer">
  MiniMax-m3 评测项目 | 刷新时间: <span id="refreshTime">--</span>
</div>

<script>
const DIM_ORDER = ['代码生成','SQL查询','算法能力','代码补全','错误修复','代码优化','多语言办公','信息抽取','文档撰写','邮件处理','表格处理'];
const DIM_COUNTS = {'代码生成':100,'SQL查询':50,'算法能力':80,'代码补全':50,'错误修复':60,'代码优化':50,'多语言办公':50,'信息抽取':50,'文档撰写':50,'邮件处理':50,'表格处理':50};
const DIM_COLORS = {
  '代码生成':'#22c55e','SQL查询':'#3b82f6','算法能力':'#a855f7','代码补全':'#f97316',
  '错误修复':'#ef4444','代码优化':'#06b6d4','多语言办公':'#eab308','信息抽取':'#ec4899',
  '文档撰写':'#14b8a6','邮件处理':'#6366f1','表格处理':'#84cc16'
};
let overallChart, dimChart;

function initCharts(){
  overallChart = echarts.init(document.getElementById('overallChart'));
  dimChart = echarts.init(document.getElementById('dimChart'));
}

function updateCharts(data){
  const models = Object.keys(data).sort();
  const overall = models.map(m => {
    const dims = data[m];
    let done = 0, total = 0;
    Object.values(dims).forEach(d => { done += d.done; total += d.total; });
    return { name: m, value: done, total };
  });

  overallChart.setOption({
    title: { text: '总体完成度', left:'center', textStyle:{color:'#e2e8f0',fontSize:14} },
    tooltip: { trigger:'item', formatter:p=>\`\${p.name}: \${p.value}/\${p.data.total} (\${(p.value/p.data.total*100).toFixed(1)}%)\` },
    series: [{
      type:'pie', radius:['40%','70%'], center:['50%','60%'],
      label:{color:'#e2e8f0',formatter:'{b}\n{d}%'},
      data: overall.map(o=>({name:o.name,value:o.value,total:o.total}))
    }]
  });

  const dimSeries = models.map(m => ({
    name: m, type: 'bar', stack: 'total',
    data: DIM_ORDER.map(d => data[m]?.[d]?.done || 0),
    itemStyle: { color: m==='MiniMax-m3'?'#3b82f6':m==='deepseek-v4-flash'?'#22c55e':m==='mimo-v2.5-pro'?'#f59e0b':'#ec4899' }
  }));

  dimChart.setOption({
    title: { text: '各维度完成数', left:'center', textStyle:{color:'#e2e8f0',fontSize:14} },
    tooltip: { trigger:'axis' },
    legend: { data: models, textStyle:{color:'#94a3b8'}, bottom:0 },
    grid: { left:10, right:10, top:40, bottom:40, containLabel:true },
    xAxis: { type:'category', data: DIM_ORDER, axisLabel:{color:'#94a3b8',rotate:30,fontSize:10} },
    yAxis: { type:'value', axisLabel:{color:'#94a3b8'}, splitLine:{lineStyle:{color:'#334155'}} },
    series: dimSeries
  });
}

function updateModels(data){
  const container = document.getElementById('modelsContainer');
  const models = Object.keys(data).sort();
  let html = '';
  models.forEach(m => {
    const dims = data[m];
    let done = 0, total = 0, succ = 0, err = 0, trunc = 0;
    Object.values(dims).forEach(d => { done += d.done; total += d.total; succ += d.success; err += d.error; trunc += d.truncated; });
    const pct = total > 0 ? (done/total*100).toFixed(1) : 0;

    html += \`<div class="model-card">
      <div class="model-name">\${m}</div>
      <div class="model-summary">
        <span class="badge \${done>=total?'ok':''}">\${done}/\${total} (\${pct}%)</span>
        <span class="badge ok">成功 \${succ}</span>
        <span class="badge \${err>0?'err':''}">失败 \${err}</span>
        <span class="badge \${trunc>0?'warn':''}">截断 \${trunc}</span>
      </div>
      \${DIM_ORDER.map(d=>{
        const info = dims[d] || {done:0,total:DIM_COUNTS[d]||50};
        const dpct = info.total>0 ? (info.done/info.total*100) : 0;
        return \`<div class="dim-row">
          <span class="dim-label">\${d}</span>
          <div class="dim-bar-wrap"><div class="dim-bar \${dpct>=100?'success':'partial'}" style="width:\${dpct}%"></div></div>
          <span class="dim-count">\${info.done}/\${info.total}</span>
        </div>\`;
      }).join('')}
    </div>\`;
  });
  container.innerHTML = html;
}

let logs = [];
function updateLog(data){
  const now = new Date().toLocaleTimeString('zh-CN');
  const models = Object.keys(data).sort();
  models.forEach(m => {
    const dims = data[m];
    let done = 0, total = 0;
    Object.values(dims).forEach(d => { done += d.done; total += d.total; });
    const line = \`[\${now}] \${m}: \${done}/\${total} 完成\`;
    if (!logs.includes(line)) logs.push(line);
  });
  if (logs.length > 20) logs = logs.slice(-20);
  document.getElementById('logBox').innerHTML = logs.map(l=>\`<div class="log-line">\${l}</div>\`).join('');
}

async function refresh(){
  try {
    const res = await fetch('/api/progress');
    const data = await res.json();
    updateCharts(data);
    updateModels(data);
    updateLog(data);
    document.getElementById('refreshTime').textContent = new Date().toLocaleTimeString('zh-CN');
  } catch(e) {
    console.error('刷新失败:', e);
  }
}

initCharts();
refresh();
setInterval(refresh, 5000);
window.addEventListener('resize', () => { overallChart.resize(); dimChart.resize(); });
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (parsed.pathname === '/api/progress') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(getProgress()));
  } else if (parsed.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('MiniMax-m3 评测 Dashboard 已启动！');
  console.log(`访问地址: http://localhost:${PORT}`);
  console.log('按 Ctrl+C 停止');
  console.log('='.repeat(60));
});

/**
 * MiniMax-m3 评测实时监控 Dashboard v2
 * 用法: node dashboard_v2.js [端口，默认 3457]
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = parseInt(process.argv[2], 10) || 3457;
const CP_DIR = 'C:/Users/xingyun/Desktop/MiniMax-m3-评测项目/03-data/checkpoints';

const DIMS = {
  '代码生成': 100, 'SQL查询': 50, '算法能力': 80, '代码补全': 50,
  '错误修复': 60, '代码优化': 50, '多语言办公': 50, '信息抽取': 50,
  '文档撰写': 50, '邮件处理': 50, '表格处理': 50,
};
const DORDER = ['代码生成', 'SQL查询', '算法能力', '代码补全', '错误修复', '代码优化', '多语言办公', '信息抽取', '文档撰写', '邮件处理', '表格处理'];

function getProgress() {
  const result = {};
  try {
    const files = fs.readdirSync(CP_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const base = file.replace('.json', '');
      const lastU = base.lastIndexOf('_');
      if (lastU < 0) continue;
      const dim = base.slice(lastU + 1).replace(/_/g, '');
      const model = base.slice(0, lastU);
      const cp = JSON.parse(fs.readFileSync(path.join(CP_DIR, file), 'utf-8'));
      const keys = Object.keys(cp);
      const s = keys.filter(k => !k.startsWith('_') && cp[k].status === 'success').length;
      const e = keys.filter(k => !k.startsWith('_') && cp[k].status === 'error').length;
      const t = keys.filter(k => !k.startsWith('_') && cp[k].truncated).length;
      if (!result[model]) result[model] = {};
      result[model][dim] = { done: keys.length, success: s, error: e, truncated: t, total: DIMS[dim] || 50 };
    }
  } catch (err) {
    console.error('read checkpoints error:', err.message);
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
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;padding:20px}
.h{text-align:center;margin-bottom:20px}
.h h1{font-size:22px}
.h p{color:#94a3b8;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;margin-bottom:20px}
.card{background:#1e293b;border-radius:10px;padding:16px;border:1px solid #334155}
.card h3{font-size:14px;margin-bottom:10px;color:#f8fafc}
.model{margin-bottom:12px;padding:12px;background:#1e293b;border-radius:8px;border:1px solid #334155}
.model-name{font-weight:600;font-size:15px;margin-bottom:6px}
.meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;font-size:12px}
.tag{background:#334155;padding:2px 8px;border-radius:4px}
.tag.ok{background:#166534;color:#86efac}
.tag.warn{background:#713f12;color:#fde047}
.tag.err{background:#7f1d1d;color:#fca5a5}
.bar-wrap{height:16px;background:#334155;border-radius:8px;overflow:hidden;margin-top:4px}
.bar{height:100%;border-radius:8px;background:linear-gradient(90deg,#22c55e,#16a34a);transition:width .5s}
.bar.warn{background:linear-gradient(90deg,#f59e0b,#d97706)}
.dims{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px;margin-top:8px}
.dim{font-size:11px;color:#94a3b8}
.dim-val{color:#e2e8f0;font-weight:600}
#time{text-align:center;color:#64748b;font-size:12px;margin-top:10px}
</style>
</head>
<body>
<div class="h"><h1>MiniMax-m3 评测实时监控</h1><p>4模型 x 11维度 x 640题 | 每5秒刷新</p></div>
<div class="grid">
  <div class="card"><h3>总体完成度</h3><div id="pie" style="width:100%;height:240px"></div></div>
  <div class="card"><h3>各维度进度</h3><div id="bar" style="width:100%;height:240px"></div></div>
</div>
<div id="models"></div>
<div id="time"></div>
<script>
const DORDER = ['代码生成','SQL查询','算法能力','代码补全','错误修复','代码优化','多语言办公','信息抽取','文档撰写','邮件处理','表格处理'];
const DIMS = {'代码生成':100,'SQL查询':50,'算法能力':80,'代码补全':50,'错误修复':60,'代码优化':50,'多语言办公':50,'信息抽取':50,'文档撰写':50,'邮件处理':50,'表格处理':50};
let p1, b1;
function init(){ p1 = echarts.init(document.getElementById('pie')); b1 = echarts.init(document.getElementById('bar')); }
function fmt(data){
  const ms = Object.keys(data).sort();
  const rows = [];
  ms.forEach(m => { const ds = data[m]; let d = 0, t = 0; Object.values(ds).forEach(x => { d += x.done; t += x.total; }); rows.push({m, d, t, pct: t > 0 ? (d / t * 100).toFixed(1) : 0}); });
  return {ms, rows};
}
function update(data){
  const {ms, rows} = fmt(data);
  p1.setOption({
    tooltip: { trigger: 'item', formatter: x => x.name + ': ' + x.value + '/' + x.data.total + ' (' + x.percent + '%)' },
    series: [{ type: 'pie', radius: ['40%', '70%'], label: { formatter: '{b}\n{d}%' }, data: rows.map(r => ({name: r.m, value: r.d, total: r.t})) }]
  });
  b1.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ms, textStyle: { color: '#94a3b8' }, bottom: 0 },
    grid: { left: 10, right: 10, top: 10, bottom: 30, containLabel: true },
    xAxis: { type: 'category', data: DORDER, axisLabel: { color: '#94a3b8', rotate: 30, fontSize: 9 } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#334155' } } },
    series: ms.map(m => ({ name: m, type: 'bar', stack: 't', data: DORDER.map(d => data[m] && data[m][d] ? data[m][d].done : 0), itemStyle: { color: m === 'MiniMax-m3' ? '#3b82f6' : m === 'deepseek-v4-flash' ? '#22c55e' : m === 'mimo-v2.5-pro' ? '#f59e0b' : '#ec4899' } }))
  });
  let h = '';
  ms.forEach(m => {
    const ds = data[m];
    let d = 0, t = 0, s = 0, e = 0, tr = 0;
    Object.values(ds).forEach(x => { d += x.done; t += x.total; s += x.success; e += x.error; tr += x.truncated; });
    const pct = t > 0 ? (d / t * 100).toFixed(1) : 0;
    h += '<div class="model"><div class="model-name">' + m + '</div><div class="meta">' +
      '<span class="tag ' + (d >= t ? 'ok' : '') + '">' + d + '/' + t + ' (' + pct + '%)</span>' +
      '<span class="tag ok">成功' + s + '</span>' +
      (e > 0 ? '<span class="tag warn">失败' + e + '</span>' : '') +
      (tr > 0 ? '<span class="tag warn">截断' + tr + '</span>' : '') +
      '</div><div class="bar-wrap"><div class="bar ' + (pct < 100 ? 'warn' : '') + '" style="width:' + pct + '%"></div></div>' +
      '<div class="dims">' + DORDER.map(dd => {
        const i = ds[dd] || {done: 0, total: DIMS[dd]};
        const p = i.total > 0 ? (i.done / i.total * 100).toFixed(0) : 0;
        return '<div class="dim">' + dd + ': <span class="dim-val" style="color:' + (p >= 100 ? '#22c55e' : '#f59e0b') + '">' + i.done + '/' + i.total + '</span></div>';
      }).join('') + '</div></div>';
  });
  document.getElementById('models').innerHTML = h;
  document.getElementById('time').textContent = '刷新: ' + new Date().toLocaleTimeString('zh-CN');
}
async function refresh(){
  try { const r = await fetch('/api/progress'); const d = await r.json(); update(d); } catch(e) { console.error(e); }
}
init(); refresh(); setInterval(refresh, 5000);
window.addEventListener('resize', () => { p1.resize(); b1.resize(); });
</script>
</body>
</html>`;

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const p = url.parse(req.url, true);
  if (p.pathname === '/api/progress') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(getProgress()));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
  }
}).listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('Dashboard v2 已启动！');
  console.log('访问: http://localhost:' + PORT);
  console.log('按 Ctrl+C 停止');
  console.log('='.repeat(60));
});

/**
 * eval_v3.js 的单模型并行版本
 * 用法: node eval_v3_single.js <模型名>
 * 示例: node eval_v3_single.js deepseek-v4-flash
 */
const fs = require('fs');
const path = require('path');

const BASE_DIR = 'C:/Users/xingyun/Desktop/MiniMax-m3-评测项目';
const TASKS_PATH = path.join(BASE_DIR, '03-数据与结果/tasks_v3.json');
const OUTPUT_DIR = path.join(BASE_DIR, '03-数据与结果');
const CHECKPOINT_DIR = path.join(BASE_DIR, '03-数据与结果/checkpoints');

const targetModelName = process.argv[2];
if (!targetModelName) {
  console.error('用法: node eval_v3_single.js <模型名>');
  console.error('可用模型: MiniMax-m3, deepseek-v4-flash, mimo-v2.5-pro, kimi-k2.6');
  process.exit(1);
}

const ALL_MODELS = [
  {
    name: 'MiniMax-m3',
    apiUrl: 'https://api.minimax.chat/v1/chat/completions',
    apiKey: 'sk-cp-vTwAJBlIrVtvC0xZ8nhoiAvQTyR2ESKhPtvmmBQ7gZfRMDMWcfQDVS9iWdUwy-ZffnMeOH9kOcB44LKPaiOAlaCL35kclaHcOfUynpt-ONgR_glmXL3Tdio',
    modelId: 'MiniMax-m3',
    isMiniMax: true,
  },
  {
    name: 'deepseek-v4-flash',
    apiUrl: 'http://www.opcrouter.online/v1/chat/completions',
    apiKey: 'sk-1VV3vI8HgxR3kYYRI8byG1dD1QSqVwHmXdfqyiDkjsvaajZB',
    modelId: 'deepseek-v4-flash',
    isMiniMax: false,
  },
  {
    name: 'mimo-v2.5-pro',
    apiUrl: 'http://www.opcrouter.online/v1/chat/completions',
    apiKey: 'sk-9CNkcxVPX4QFpDQ2T89nTecMzlx2jSTHOWjIMw7K01zmIjsF',
    modelId: 'mimo-v2.5-pro',
    isMiniMax: false,
  },
  {
    name: 'kimi-k2.6',
    apiUrl: 'http://www.opcrouter.online/v1/chat/completions',
    apiKey: 'sk-1VV3vI8HgxR3kYYRI8byG1dD1QSqVwHmXdfqyiDkjsvaajZB',
    modelId: 'kimi-k2.6',
    isMiniMax: false,
  },
];

const modelCfg = ALL_MODELS.find(m => m.name === targetModelName);
if (!modelCfg) {
  console.error('未知模型:', targetModelName);
  process.exit(1);
}

// ============ 以下逻辑与 eval_v3.js 完全相同 ============

const SYSTEM_PROMPTS = {
  '代码生成': '你是一位专业的Python程序员。请根据题目要求直接生成Python代码，不要输出任何解释、思考过程或标签。只输出最终代码。',
  'SQL查询': '你是一位专业的数据库工程师。请根据题目要求直接生成SQL语句，不要输出任何解释、思考过程或标签。只输出最终SQL。',
  '错误修复': '你是一位专业的Python程序员。请分析代码bug并直接输出修复后的完整代码，不要输出任何解释、思考过程或标签。只输出最终代码。',
  '代码优化': '你是一位专业的Python程序员。请对代码进行优化并直接输出优化后的完整代码，不要输出任何解释、思考过程或标签。只输出最终代码。',
  '代码补全': '你是一位专业的Python程序员。请补全代码并直接输出补全后的完整代码，不要输出任何解释、思考过程或标签。只输出最终代码。',
  '算法能力': '你是一位算法专家。请直接给出解题思路和代码实现，不要输出思考标签或多余解释。',
  '多语言办公': '你是一位企业办公助手。请根据题目要求直接输出结果，不要输出思考过程或标签。',
  '信息抽取': '你是一位NLP专家。请直接输出抽取结果，不要输出解释或思考过程。',
  '文档撰写': '你是一位专业的企业办公助手，擅长撰写正式规范的办公文档。请直接输出文档内容，不要解释你是AI，不要输出思考过程。',
  '邮件处理': '你是一位专业的企业办公助手，擅长处理邮件相关任务。请直接输出结果，不要解释。',
  '表格处理': '你是一位专业的Excel和数据分析专家。请直接输出公式、代码或分析结果，不要解释。',
};

const MINIMAX_SYSTEM_PROMPTS = {
  '代码生成': '你是Python编程助手。直接输出代码，禁止输出任何解释、注释说明、思考过程、<think>标签或其他标记。只输出纯代码。',
  'SQL查询': '你是SQL专家。直接输出SQL语句，禁止输出任何解释、思考过程、<think>标签或其他标记。只输出纯SQL。',
  '错误修复': '你是Python编程助手。直接输出修复后的代码，禁止输出任何解释、思考过程、<think>标签或其他标记。只输出纯代码。',
  '代码优化': '你是Python编程助手。直接输出优化后的代码，禁止输出任何解释、思考过程、<think>标签或其他标记。只输出纯代码。',
  '代码补全': '你是Python编程助手。直接输出补全后的代码，禁止输出任何解释、思考过程、<think>标签或其他标记。只输出纯代码。',
  '算法能力': '你是算法专家。直接输出解题答案，禁止输出思考过程、<think>标签或其他标记。',
  '多语言办公': '你是办公助手。直接输出结果，禁止输出思考过程、<think>标签或其他标记。',
  '信息抽取': '你是NLP专家。直接输出抽取结果，禁止输出思考过程、<think>标签或其他标记。',
  '文档撰写': '你是文档撰写专家。直接输出文档正文，禁止输出思考过程、<think>标签或其他标记。',
  '邮件处理': '你是邮件处理专家。直接输出邮件内容，禁止输出思考过程、<think>标签或其他标记。',
  '表格处理': '你是数据分析专家。直接输出公式或代码，禁止输出思考过程、<think>标签或其他标记。',
};

const DIM_MAX_TOKENS = {
  '代码生成': 4096, 'SQL查询': 4096, '错误修复': 4096, '代码优化': 4096,
  '代码补全': 4096, '算法能力': 4096, '多语言办公': 2048, '信息抽取': 2048,
  '文档撰写': 2048, '邮件处理': 2048, '表格处理': 2048,
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function loadJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; } }
function saveJSON(p, data) { fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8'); }
function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function stripThinkingTags(text) {
  if (!text) return text;
  let s = text;
  s = s.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '');
  s = s.replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, '');
  s = s.replace(/【思考】[\s\S]*?【\/思考】/g, '');
  s = s.replace(/【推理】[\s\S]*?【\/推理】/g, '');
  s = s.replace(/```reasoning[\s\S]*?```/gi, '');
  s = s.replace(/```think[\s\S]*?```/gi, '');
  s = s.replace(/^Reasoning:.*?(?=\n\n|\n[A-Z]|$)/gis, '');
  s = s.replace(/^思考[:：].*?(?=\n\n|\n[A-Z]|$)/gis, '');
  s = s.replace(/^推理[:：].*?(?=\n\n|\n[A-Z]|$)/gis, '');
  s = s.replace(/<analysis>[\s\S]*?<\/analysis>/gi, '');
  s = s.replace(/<reflection>[\s\S]*?<\/reflection>/gi, '');
  return s.trim();
}

function detectTruncation(text, dim) {
  if (!text || text.length < 10) return true;
  const last50 = text.slice(-50);
  const codeDims = ['代码生成', 'SQL查询', '错误修复', '代码优化', '代码补全', '算法能力', '表格处理'];
  if (codeDims.includes(dim)) {
    const hasNaturalEnd = /[}\]`"']\s*$/.test(last50) || /```\s*$/.test(last50) || /\n\s*$/.test(last50);
    if (!hasNaturalEnd) return true;
  }
  return false;
}

function extractCodeBlock(text) {
  const m = text.match(/```(?:python)?\s*\n?([\s\S]*?)```/);
  if (m) return m[1].trim();
  return text;
}

async function callModel(modelCfg, prompt, systemPrompt, maxTokens) {
  const body = {
    model: modelCfg.modelId,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: maxTokens,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const resp = await fetch(modelCfg.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${modelCfg.apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return { output: `[API Error ${resp.status}] ${errText}`, status: 'error', truncated: false };
    }
    const data = await resp.json();
    let output = data.choices?.[0]?.message?.content || '';
    output = stripThinkingTags(output);
    const codeDims = ['代码生成', '错误修复', '代码优化', '代码补全', '算法能力'];
    const dim = Object.keys(SYSTEM_PROMPTS).find(d => systemPrompt.includes(d)) || '';
    if (codeDims.some(d => systemPrompt.includes(d))) {
      const extracted = extractCodeBlock(output);
      if (extracted && extracted.length > 10) output = extracted;
    }
    const truncated = detectTruncation(output, dim);
    return { output, status: 'success', truncated };
  } catch (err) {
    clearTimeout(timeout);
    return { output: `[Exception] ${err.message}`, status: 'error', truncated: false };
  }
}

async function callWithRetry(modelCfg, prompt, systemPrompt, maxTokens, retries = 3) {
  let result;
  for (let i = 0; i < retries; i++) {
    result = await callModel(modelCfg, prompt, systemPrompt, maxTokens);
    if (result.status === 'success') return result;
    if (i < retries - 1) {
      const delay = 2000 * Math.pow(2, i);
      console.log(`    [Retry ${i + 1}/${retries - 1}] after ${delay}ms...`);
      await sleep(delay);
    }
  }
  return result;
}

function getCheckpointPath(modelName, dim) {
  const safeDim = dim.replace(/\s+/g, '_');
  return path.join(CHECKPOINT_DIR, `${modelName}_${safeDim}.json`);
}
function loadCheckpoint(modelName, dim) {
  const cp = loadJSON(getCheckpointPath(modelName, dim));
  return cp || {};
}
function saveCheckpoint(modelName, dim, data) {
  saveJSON(getCheckpointPath(modelName, dim), data);
}

async function runEvaluation() {
  console.log('='.repeat(60));
  console.log(`MiniMax-m3 科学评测 v3.0 — 单模型模式: ${modelCfg.name}`);
  console.log('='.repeat(60));
  ensureDir(CHECKPOINT_DIR);

  const tasks = loadJSON(TASKS_PATH);
  if (!tasks || !tasks.length) { console.error('无法加载任务文件'); process.exit(1); }
  console.log(`[信息] 共加载 ${tasks.length} 个任务`);

  const dimGroups = {};
  tasks.forEach(t => { const d = t.dim || '其他'; if (!dimGroups[d]) dimGroups[d] = []; dimGroups[d].push(t); });

  console.log('[信息] 维度分布:');
  Object.entries(dimGroups).forEach(([d, list]) => console.log(`  - ${d}: ${list.length} 题`));

  const allResults = {};
  console.log(`\n[模型] ${modelCfg.name}`);
  allResults[modelCfg.name] = {};

  for (const [dim, dimTasks] of Object.entries(dimGroups)) {
    console.log(`  [维度] ${dim} (${dimTasks.length} 题)`);
    const checkpoint = loadCheckpoint(modelCfg.name, dim);
    let completed = 0, skipped = 0;

    for (const task of dimTasks) {
      const tid = task.task_id;
      if (checkpoint[tid] && checkpoint[tid].status === 'success') { skipped++; continue; }

      const systemPrompt = modelCfg.isMiniMax
        ? (MINIMAX_SYSTEM_PROMPTS[dim] || MINIMAX_SYSTEM_PROMPTS['代码生成'])
        : (SYSTEM_PROMPTS[dim] || SYSTEM_PROMPTS['代码生成']);
      const maxTokens = DIM_MAX_TOKENS[dim] || 2048;

      const result = await callWithRetry(modelCfg, task.prompt, systemPrompt, maxTokens, 3);
      checkpoint[tid] = {
        output: result.output, status: result.status, truncated: result.truncated,
        dim, timestamp: new Date().toISOString(),
      };
      saveCheckpoint(modelCfg.name, dim, checkpoint);
      completed++;

      const flag = result.status === 'success' ? (result.truncated ? '⚠️截断' : '✅') : '❌';
      process.stdout.write(`    ${tid} ${flag} | `);
      if (completed % 5 === 0) process.stdout.write('\n');
      await sleep(300);
    }

    if (completed % 5 !== 0) process.stdout.write('\n');
    console.log(`    完成: ${completed} 新调用, 跳过: ${skipped} 已有`);
  }

  console.log('\n[合并] 生成 raw_outputs...');
  const rawOutputs = {};
  rawOutputs[modelCfg.name] = {};
  for (const dim of Object.keys(dimGroups)) {
    const cp = loadCheckpoint(modelCfg.name, dim);
    Object.assign(rawOutputs[modelCfg.name], cp);
  }

  const rawPath = path.join(OUTPUT_DIR, `raw_outputs_${modelCfg.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
  saveJSON(rawPath, rawOutputs);
  console.log(`  已保存: ${rawPath}`);

  let total = 0, success = 0, truncated = 0;
  for (const dim of Object.keys(dimGroups)) {
    const cp = loadCheckpoint(modelCfg.name, dim);
    Object.values(cp).forEach(r => { total++; if (r.status === 'success') success++; if (r.truncated) truncated++; });
  }

  console.log('\n' + '='.repeat(60));
  console.log(`${modelCfg.name} 调用摘要`);
  console.log('='.repeat(60));
  console.log(`总调用: ${total} | 成功: ${success} | 截断: ${truncated} | 失败: ${total - success}`);
  console.log('\n✅ 模型调用完成！');
}

runEvaluation().catch(err => { console.error('运行出错:', err); process.exit(1); });

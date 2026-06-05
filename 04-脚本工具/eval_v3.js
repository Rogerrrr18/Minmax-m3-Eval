/**
 * MiniMax-m3 评测主运行脚本 v3.0
 * 改进点：
 *   - 更大 max_tokens（代码 4096，其他 2048）
 *   - 3 次指数退避重试
 *   - 多格式思考标签过滤
 *   - 逐维度断点续跑（checkpoint）
 *   - 并行调用模型
 *   - 输出截断自动检测与标记
 *
 * 用法: node eval_v3.js
 */

const fs = require('fs');
const path = require('path');

// ============ 配置 ============
const BASE_DIR = 'C:/Users/xingyun/Desktop/MiniMax-m3-评测项目';
const TASKS_PATH = path.join(BASE_DIR, '03-数据与结果/tasks_v3.json');
const OUTPUT_DIR = path.join(BASE_DIR, '03-数据与结果');
const CHECKPOINT_DIR = path.join(BASE_DIR, '03-数据与结果/checkpoints');

// 模型配置（密钥从环境变量或脚本内读取）
const MODELS = [
  {
    name: 'MiniMax-m3',
    apiUrl: 'https://api.minimax.chat/v1/chat/completions',
    apiKey: process.env.MINIMAX_KEY || 'sk-cp-vTwAJBlIrVtvC0xZ8nhoiAvQTyR2ESKhPtvmmBQ7gZfRMDMWcfQDVS9iWdUwy-ZffnMeOH9kOcB44LKPaiOAlaCL35kclaHcOfUynpt-ONgR_glmXL3Tdio',
    modelId: 'MiniMax-m3',
    isMiniMax: true,
  },
  {
    name: 'deepseek-v4-flash',
    apiUrl: 'http://www.opcrouter.online/v1/chat/completions',
    apiKey: process.env.OPC_KEY || 'sk-1VV3vI8HgxR3kYYRI8byG1dD1QSqVwHmXdfqyiDkjsvaajZB',
    modelId: 'deepseek-v4-flash',
    isMiniMax: false,
  },
  {
    name: 'mimo-v2.5-pro',
    apiUrl: 'http://www.opcrouter.online/v1/chat/completions',
    apiKey: process.env.OPC_KEY || 'sk-9CNkcxVPX4QFpDQ2T89nTecMzlx2jSTHOWjIMw7K01zmIjsF',
    modelId: 'mimo-v2.5-pro',
    isMiniMax: false,
  },
  {
    name: 'kimi-k2.6',
    apiUrl: 'http://www.opcrouter.online/v1/chat/completions',
    apiKey: process.env.OPC_KEY || 'sk-1VV3vI8HgxR3kYYRI8byG1dD1QSqVwHmXdfqyiDkjsvaajZB',
    modelId: 'kimi-k2.6',
    isMiniMax: false,
  },
];

// System Prompts（通用）
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

// MiniMax 特殊 system prompt（更强硬的抑制思考标签）
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

// 各维度 max_tokens
const DIM_MAX_TOKENS = {
  '代码生成': 4096,
  'SQL查询': 4096,
  '错误修复': 4096,
  '代码优化': 4096,
  '代码补全': 4096,
  '算法能力': 4096,
  '多语言办公': 2048,
  '信息抽取': 2048,
  '文档撰写': 2048,
  '邮件处理': 2048,
  '表格处理': 2048,
};

// ============ 工具函数 ============

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function saveJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * 强力思考标签过滤
 * 处理：<think>...</think>、<thinking>...</thinking>、【思考】...、【/思考】、Reasoning: ... 等
 */
function stripThinkingTags(text) {
  if (!text) return text;
  let s = text;

  // 1. XML think 标签（含属性）
  s = s.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '');
  s = s.replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, '');

  // 2. 中文思考标签
  s = s.replace(/【思考】[\s\S]*?【\/思考】/g, '');
  s = s.replace(/【推理】[\s\S]*?【\/推理】/g, '');

  // 3. Markdown reasoning block
  s = s.replace(/```reasoning[\s\S]*?```/gi, '');
  s = s.replace(/```think[\s\S]*?```/gi, '');

  // 4. 前缀标记
  s = s.replace(/^Reasoning:.*?(?=\n\n|\n[A-Z]|$)/gis, '');
  s = s.replace(/^思考[:：].*?(?=\n\n|\n[A-Z]|$)/gis, '');
  s = s.replace(/^推理[:：].*?(?=\n\n|\n[A-Z]|$)/gis, '');

  // 5. 特定模型的 <analysis> 等
  s = s.replace(/<analysis>[\s\S]*?<\/analysis>/gi, '');
  s = s.replace(/<reflection>[\s\S]*?<\/reflection>/gi, '');

  // 6. 去除空行首尾
  s = s.trim();
  return s;
}

/**
 * 检测输出是否被截断
 * 启发式：如果结尾不是自然结束（如 }、```、句号、换行等），可能是截断
 */
function detectTruncation(text, dim) {
  if (!text || text.length < 10) return true;
  const last50 = text.slice(-50);
  const codeDims = ['代码生成', 'SQL查询', '错误修复', '代码优化', '代码补全', '算法能力', '表格处理'];

  if (codeDims.includes(dim)) {
    // 代码类：结尾应有 }、```、空行、return 等
    const hasNaturalEnd = /[}\]`"']\s*$/.test(last50) || /```\s*$/.test(last50) || /\n\s*$/.test(last50);
    if (!hasNaturalEnd) return true;
  }
  // 通用：结尾不是标点或格式化符号
  const naturalEnds = /[。！？.!?)\]}`"'】）]\s*$/;
  if (!naturalEnds.test(text.slice(-5))) {
    // 如果输出刚好达到某个阈值，更可能是截断
    return false; // 暂时不标记，避免误报
  }
  return false;
}

/**
 * 提取代码块
 * 如果输出包含 ```python ... ```，提取中间部分
 */
function extractCodeBlock(text) {
  const m = text.match(/```(?:python)?\s*\n?([\s\S]*?)```/);
  if (m) return m[1].trim();
  return text;
}

// ============ API 调用 ============

async function callModel(modelCfg, prompt, systemPrompt, maxTokens) {
  const body = {
    model: modelCfg.modelId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    max_tokens: maxTokens,
  };

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${modelCfg.apiKey}`,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000); // 90s timeout

  try {
    const resp = await fetch(modelCfg.apiUrl, {
      method: 'POST',
      headers,
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

    // 后处理
    output = stripThinkingTags(output);

    // 代码类任务额外提取代码块
    const codeDims = ['代码生成', '错误修复', '代码优化', '代码补全', '算法能力'];
    const dim = Object.keys(SYSTEM_PROMPTS).find(d => systemPrompt.includes(d)) || '';
    if (codeDims.some(d => systemPrompt.includes(d))) {
      const extracted = extractCodeBlock(output);
      if (extracted && extracted.length > 10) {
        output = extracted;
      }
    }

    const truncated = detectTruncation(output, dim);
    return { output, status: 'success', truncated };
  } catch (err) {
    clearTimeout(timeout);
    return { output: `[Exception] ${err.message}`, status: 'error', truncated: false };
  }
}

async function callWithRetry(modelCfg, prompt, systemPrompt, maxTokens, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const result = await callModel(modelCfg, prompt, systemPrompt, maxTokens);
    if (result.status === 'success') {
      return result;
    }
    if (i < retries - 1) {
      const delay = 2000 * Math.pow(2, i); // 2s, 4s, 8s
      console.log(`    [Retry ${i + 1}/${retries - 1}] after ${delay}ms...`);
      await sleep(delay);
    }
  }
  return result;
}

// ============ Checkpoint 管理 ============

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

// ============ 主流程 ============

async function runEvaluation() {
  console.log('=' .repeat(60));
  console.log('MiniMax-m3 科学评测 v3.0');
  console.log('改进：大token、重试、思考过滤、断点续跑');
  console.log('=' .repeat(60));

  ensureDir(CHECKPOINT_DIR);

  // 加载任务
  const tasks = loadJSON(TASKS_PATH);
  if (!tasks || !tasks.length) {
    console.error('无法加载任务文件:', TASKS_PATH);
    process.exit(1);
  }
  console.log(`\n[信息] 共加载 ${tasks.length} 个任务`);

  // 按维度分组
  const dimGroups = {};
  tasks.forEach(t => {
    const d = t.dim || '其他';
    if (!dimGroups[d]) dimGroups[d] = [];
    dimGroups[d].push(t);
  });

  console.log('[信息] 维度分布:');
  Object.entries(dimGroups).forEach(([d, list]) => {
    console.log(`  - ${d}: ${list.length} 题`);
  });

  // 逐个模型、逐维度执行
  const allResults = {}; // model -> dim -> task_id -> result

  for (const model of MODELS) {
    if (!model.apiKey) {
      console.log(`\n[跳过] ${model.name} 未配置 API Key`);
      continue;
    }

    console.log(`\n[模型] ${model.name}`);
    allResults[model.name] = {};

    for (const [dim, dimTasks] of Object.entries(dimGroups)) {
      console.log(`  [维度] ${dim} (${dimTasks.length} 题)`);

      const checkpoint = loadCheckpoint(model.name, dim);
      let completed = 0;
      let skipped = 0;

      for (const task of dimTasks) {
        const tid = task.task_id;

        // 断点续跑：如果 checkpoint 中已有成功记录，跳过
        if (checkpoint[tid] && checkpoint[tid].status === 'success') {
          skipped++;
          continue;
        }

        const systemPrompt = model.isMiniMax
          ? (MINIMAX_SYSTEM_PROMPTS[dim] || MINIMAX_SYSTEM_PROMPTS['代码生成'])
          : (SYSTEM_PROMPTS[dim] || SYSTEM_PROMPTS['代码生成']);
        const maxTokens = DIM_MAX_TOKENS[dim] || 2048;

        const result = await callWithRetry(model, task.prompt, systemPrompt, maxTokens, 3);

        checkpoint[tid] = {
          output: result.output,
          status: result.status,
          truncated: result.truncated,
          dim,
          timestamp: new Date().toISOString(),
        };

        // 实时保存 checkpoint
        saveCheckpoint(model.name, dim, checkpoint);
        completed++;

        const flag = result.status === 'success' ? (result.truncated ? '⚠️截断' : '✅') : '❌';
        process.stdout.write(`    ${tid} ${flag} | `);
        if (completed % 5 === 0) process.stdout.write('\n');

        // 礼貌性限速
        await sleep(300);
      }

      if (completed % 5 !== 0) process.stdout.write('\n');
      console.log(`    完成: ${completed} 新调用, 跳过: ${skipped} 已有`);
    }
  }

  // 合并所有 checkpoint 为最终 raw_outputs_v3.json
  console.log('\n[合并] 生成 raw_outputs_v3.json...');
  const rawOutputs = {};
  for (const model of MODELS) {
    rawOutputs[model.name] = {};
    for (const dim of Object.keys(dimGroups)) {
      const cp = loadCheckpoint(model.name, dim);
      Object.assign(rawOutputs[model.name], cp);
    }
  }

  const rawPath = path.join(OUTPUT_DIR, 'raw_outputs_v3.json');
  saveJSON(rawPath, rawOutputs);
  console.log(`  已保存: ${rawPath}`);

  // 生成执行摘要
  let totalCalls = 0;
  let successCalls = 0;
  let truncatedCalls = 0;
  for (const model of MODELS) {
    for (const dim of Object.keys(dimGroups)) {
      const cp = loadCheckpoint(model.name, dim);
      Object.values(cp).forEach(r => {
        totalCalls++;
        if (r.status === 'success') successCalls++;
        if (r.truncated) truncatedCalls++;
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('模型调用摘要');
  console.log('='.repeat(60));
  console.log(`总调用次数: ${totalCalls}`);
  console.log(`成功: ${successCalls} (${((successCalls/totalCalls)*100).toFixed(1)}%)`);
  console.log(`截断: ${truncatedCalls} (${((truncatedCalls/totalCalls)*100).toFixed(1)}%)`);
  console.log(`失败: ${totalCalls - successCalls} (${(((totalCalls-successCalls)/totalCalls)*100).toFixed(1)}%)`);
  console.log('\n✅ Phase 1 完成！接下来运行: node auto_validator.js');
}

runEvaluation().catch(err => {
  console.error('运行出错:', err);
  process.exit(1);
});

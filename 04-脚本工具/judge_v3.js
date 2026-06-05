/**
 * GPT-5.5 深度裁判评分 v3.0
 * 改进点：
 *   - 0-10 分制（更细粒度）
 *   - 逐模型独立评分（消除位置偏见）
 *   - 裁判输入截断 2000 字符（原 800）
 *   - 每维度专门评分标准
 *   - 结合 auto_validator 基础分
 *   - 断点续跑
 *
 * 用法: node judge_v3.js
 */

const fs = require('fs');
const path = require('path');

// ============ 配置 ============
const BASE_DIR = 'C:/Users/xingyun/Desktop/MiniMax-m3-评测项目';
const TASKS_PATH = path.join(BASE_DIR, '03-数据与结果/tasks_v3.json');
const RAW_PATH = path.join(BASE_DIR, '03-数据与结果/raw_outputs_v3.json');
const AUTO_VAL_PATH = path.join(BASE_DIR, '03-数据与结果/auto_validation_v3.json');
const CHECKPOINT_DIR = path.join(BASE_DIR, '03-数据与结果/checkpoints_judge');
const OUTPUT_PATH = path.join(BASE_DIR, '03-数据与结果/judgments_v3.json');

const JUDGE_URL = 'http://www.opcrouter.online/v1/chat/completions';
const JUDGE_KEY = process.env.OPC_KEY || 'sk-fPpoLMFQf6LZ7NEWsZo4zcpZLwgbcbmaPvMYtqHtKudHNlyV';
const JUDGE_MODEL = 'gpt-5.5';

// ============ 工具函数 ============
function loadJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}
function saveJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}
function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ============ 评分标准（按维度） ============
const SCORING_RUBRICS = {
  '代码生成': `你是Python代码评测专家。请对以下模型输出的代码进行评分。

【评分标准】(0-10分)
- 0-3分：代码无法运行、逻辑完全错误、或输出为空/无关内容
- 4-5分：代码可运行但结果错误，或遗漏关键需求
- 6-7分：基本正确，但效率低、风格差、或有边界条件问题
- 8-9分：完全正确且较高效，符合Python最佳实践
- 10分：完美实现，代码简洁、高效、优雅

【注意】
- 只根据代码本身质量评分，不考虑模型名
- 如果输出包含非代码内容（如解释），忽略解释只看代码
- 如果代码被截断（结尾不完整），最高给4分`,

  'SQL查询': `你是SQL评测专家。请对以下模型输出的SQL语句进行评分。

【评分标准】(0-10分)
- 0-3分：SQL语法错误、完全不符合题意、或为空
- 4-5分：语法基本正确但逻辑错误（如JOIN条件错、遗漏HAVING等）
- 6-7分：基本正确，但有小缺陷（如缺少排序、列名不精确）
- 8-9分：完全正确，满足所有需求
- 10分：完美，包含额外优化（如索引建议、执行效率考虑）

【注意】
- 关注语义正确性而非具体列名别名差异
- 聚合函数使用正确性是重点`,

  '错误修复': `你是Python代码评测专家。请对以下模型输出的修复后代码进行评分。

【评分标准】(0-10分)
- 0-3分：未修复bug、引入新bug、或输出为空
- 4-5分：修复了部分bug但仍有其他问题
- 6-7分：修复了主要bug，但代码风格或可维护性有改进空间
- 8-9分：完全正确修复，代码清晰
- 10分：完美修复，且对代码进行了额外优化

【注意】
- 对比原代码的bug和修复后的代码
- 修复后的代码必须保持原有功能并消除bug`,

  '代码优化': `你是Python代码评测专家。请对以下模型输出的优化后代码进行评分。

【评分标准】(0-10分)
- 0-3分：未优化、比原来更差、或输出为空
- 4-5分：有优化意图但效果有限，或引入新问题
- 6-7分：有一定优化（如减少冗余），但还有优化空间
- 8-9分：明显优化（时间/空间复杂度降低、可读性提升）
- 10分：最优实现，算法层面有改进

【注意】
- 优化必须保持功能等价
- 关注时间复杂度、空间复杂度、可读性三个维度`,

  '代码补全': `你是Python代码评测专家。请对以下模型输出的补全代码进行评分。

【评分标准】(0-10分)
- 0-3分：补全完全错误、无法运行、或为空
- 4-5分：补全了部分但逻辑有误
- 6-7分：基本正确补全，但有小问题
- 8-9分：完全正确补全，与上下文无缝衔接
- 10分：完美补全，且代码风格一致`,

  '算法能力': `你是算法评测专家。请对以下模型输出的算法解答进行评分。

【评分标准】(0-10分)
- 0-3分：完全错误、无意义、或为空
- 4-5分：思路部分正确但结果错误，或复杂度分析错误
- 6-7分：答案基本正确，但过程不够清晰或有小错误
- 8-9分：答案正确，思路清晰，复杂度合理
- 10分：完美解答，含多种解法对比或最优解证明

【注意】
- 数学题关注最终答案正确性
- 算法题关注思路、复杂度、代码正确性`,

  '多语言办公': `你是办公文档评测专家。请对以下模型输出的多语言办公内容进行评分。

【评分标准】(0-10分)
- 0-3分：完全不满足要求、语言错误严重、或为空
- 4-5分：基本满足但有很多语言或格式问题
- 6-7分：满足主要要求，语言通顺，有小瑕疵
- 8-9分：完全满足要求，语言地道、格式规范
- 10分：超出预期，表达精准、专业

【注意】
- 关注语言正确性（中英文混合场景）
- 关注格式规范性和专业性`,

  '信息抽取': `你是NLP评测专家。请对以下模型输出的信息抽取结果进行评分。

【评分标准】(0-10分)
- 0-3分：完全未抽取、抽取内容全错、或为空
- 4-5分：抽取了部分实体但遗漏很多或有不少错误
- 6-7分：抽取了大部分正确实体，有少量遗漏或错误
- 8-9分：实体和关系抽取完全正确
- 10分：完美抽取，且格式规范、无冗余

【注意】
- 关注实体边界是否正确
- 关注是否有遗漏或幻觉（编造的实体）`,

  '文档撰写': `你是企业文档评测专家。请对以下模型输出的文档进行评分。

【评分标准】(0-10分)
- 0-3分：完全不满足要求、格式混乱、或为空
- 4-5分：勉强满足但问题多（缺要素、语气不当、逻辑不清）
- 6-7分：基本满足要求，要素齐全，有改进空间
- 8-9分：很好，满足所有要求，语气专业、结构清晰
- 10分：完美，超出预期，可直接用于正式场合

【注意】
- 检查是否包含题目要求的所有要素
- 关注语气是否符合场景（正式/简洁/温暖等）
- 关注是否有思考过程泄露（如<think>标签残留）`,

  '邮件处理': `你是商务邮件评测专家。请对以下模型输出的邮件内容进行评分。

【评分标准】(0-10分)
- 0-3分：完全不满足要求、语气严重不当、或为空
- 4-5分：基本满足但有多处问题（缺要素、语气偏差）
- 6-7分：满足主要要求，语气得体，有小问题
- 8-9分：完全满足要求，语气专业、礼貌、结构清晰
- 10分：完美，可直接发送，表达精准到位

【注意】
- 邮件必须有明确的收件人意识
- 摘要任务关注信息完整性
- 改写任务关注语气和意图的准确把握`,

  '表格处理': `你是数据分析评测专家。请对以下模型输出的表格处理结果进行评分。

【评分标准】(0-10分)
- 0-3分：公式/代码错误、完全不符合要求、或为空
- 4-5分：有正确意图但实现有错误（如公式语法错）
- 6-7分：基本正确，但有小缺陷（如范围不对、缺少边界处理）
- 8-9分：完全正确，满足所有数据处理需求
- 10分：完美，公式简洁高效，或代码健壮可复用

【注意】
- Excel公式关注语法正确性
- Python代码关注可执行性和正确性
- 数据分析关注结论准确性`,
};

// ============ API 调用 ============

async function callJudge(promptText, systemPrompt) {
  const body = {
    model: JUDGE_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: promptText },
    ],
    temperature: 0.1,
    max_tokens: 256,
  };

  try {
    const resp = await fetch(JUDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${JUDGE_KEY}` },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      return { error: `HTTP ${resp.status}: ${t}` };
    }
    const data = await resp.json();
    return { text: data.choices?.[0]?.message?.content || '' };
  } catch (e) {
    return { error: e.message };
  }
}

function extractScore(text) {
  // 优先匹配 JSON 格式
  const jsonMatch = text.match(/\{[\s\S]*?"score"\s*:\s*(\d+)[\s\S]*?\}/);
  if (jsonMatch) return parseInt(jsonMatch[1], 10);

  // 匹配 "X分" 或 "Score: X" 或 "评分：X"
  const m = text.match(/(?:score|评分|得分)[:：\s]*(\d+)(?:\s*分)?/i);
  if (m) return parseInt(m[1], 10);

  // 匹配 standalone 数字 0-10
  const nums = text.match(/\b(\d{1,2})\b/g);
  if (nums) {
    const n = parseInt(nums[0], 10);
    if (n >= 0 && n <= 10) return n;
  }

  return null;
}

// ============ 主流程 ============

async function runJudging() {
  console.log('='.repeat(60));
  console.log('GPT-5.5 深度裁判评分 v3.0');
  console.log('='.repeat(60));

  ensureDir(CHECKPOINT_DIR);

  const tasks = loadJSON(TASKS_PATH) || [];
  const rawOutputs = loadJSON(RAW_PATH) || {};
  const autoVal = loadJSON(AUTO_VAL_PATH) || {};
  const taskMap = {};
  tasks.forEach(t => taskMap[t.task_id] = t);

  const modelNames = Object.keys(rawOutputs);
  console.log(`[信息] 模型: ${modelNames.join(', ')}`);
  console.log(`[信息] 任务数: ${tasks.length}`);

  const allJudgments = {};

  for (const model of modelNames) {
    console.log(`\n[评分] ${model}`);
    allJudgments[model] = {};

    const modelOutputs = rawOutputs[model];
    const modelAutoVal = autoVal[model] || {};

    // 按维度分批
    const dimTasks = {};
    Object.keys(modelOutputs).forEach(tid => {
      const t = taskMap[tid];
      if (!t) return;
      const d = t.dim;
      if (!dimTasks[d]) dimTasks[d] = [];
      dimTasks[d].push(tid);
    });

    for (const [dim, tids] of Object.entries(dimTasks)) {
      console.log(`  [维度] ${dim} (${tids.length} 题)`);
      const rubric = SCORING_RUBRICS[dim] || SCORING_RUBRICS['文档撰写'];
      const cpPath = path.join(CHECKPOINT_DIR, `${model}_${dim.replace(/\s+/g, '_')}_judge.json`);
      const checkpoint = loadJSON(cpPath) || {};

      let done = 0;
      let skipped = 0;

      for (const tid of tids) {
        if (checkpoint[tid]) {
          skipped++;
          allJudgments[model][tid] = checkpoint[tid];
          continue;
        }

        const task = taskMap[tid];
        const output = modelOutputs[tid]?.output || '';
        const baseScore = modelAutoVal[tid]?.score ?? null;

        // 截断输出到 2000 字符（原 800）
        let displayOutput = output;
        if (displayOutput.length > 2000) {
          displayOutput = displayOutput.slice(0, 2000) + '\n... (截断，共 ' + output.length + ' 字符) ...';
        }

        const userPrompt = `【题目ID】${tid}
【任务类型】${dim}（${task.bench}，${task.difficulty}）
【题目内容】
${task.prompt}

【模型输出】
${displayOutput}

${baseScore !== null ? `【自动验证参考】基础分 ${baseScore}/3（${modelAutoVal[tid]?.reason || ''}）` : ''}

请给出评分（0-10分）和简短理由（30字以内）。
输出格式：
Score: X
Reason: ...`;

        let score = null;
        let reason = '';
        let attempts = 0;

        while (score === null && attempts < 3) {
          const res = await callJudge(userPrompt, rubric);
          if (res.error) {
            console.log(`    [警告] ${tid} API错误: ${res.error}`);
            attempts++;
            await sleep(2000 * attempts);
            continue;
          }
          score = extractScore(res.text);
          if (score === null) {
            console.log(`    [警告] ${tid} 无法解析分数: ${res.text.slice(0, 80)}`);
            attempts++;
            await sleep(1000);
          } else {
            // 提取理由
            const rm = res.text.match(/(?:reason|理由|原因)[:：\s]*(.+)/i);
            reason = rm ? rm[1].trim() : res.text.slice(0, 50);
          }
        }

        if (score === null) {
          score = baseScore !== null ? Math.round(baseScore * 10 / 3) : 5;
          reason = '裁判解析失败，使用自动验证基础分';
        }

        //  Clamp
        score = Math.max(0, Math.min(10, score));

        checkpoint[tid] = { score, reason, dim };
        allJudgments[model][tid] = checkpoint[tid];
        saveJSON(cpPath, checkpoint);

        done++;
        process.stdout.write(`    ${tid}: ${score}/10 | `);
        if (done % 5 === 0) process.stdout.write('\n');

        await sleep(400); // 限速
      }

      if (done % 5 !== 0) process.stdout.write('\n');
      console.log(`    新评分: ${done}, 跳过: ${skipped}`);
    }
  }

  // 保存最终评分
  saveJSON(OUTPUT_PATH, allJudgments);

  // 摘要
  console.log('\n' + '='.repeat(60));
  console.log('评分摘要');
  console.log('='.repeat(60));

  for (const model of modelNames) {
    const scores = Object.values(allJudgments[model]);
    const avg = scores.reduce((a, b) => a + b.score, 0) / scores.length;
    const dimAvgs = {};
    scores.forEach(s => {
      if (!dimAvgs[s.dim]) dimAvgs[s.dim] = [];
      dimAvgs[s.dim].push(s.score);
    });
    console.log(`\n${model} 综合: ${avg.toFixed(2)}/10 (共${scores.length}题)`);
    Object.entries(dimAvgs).forEach(([d, arr]) => {
      const a = arr.reduce((x, y) => x + y, 0) / arr.length;
      console.log(`  ${d}: ${a.toFixed(2)}/10 (${arr.length}题)`);
    });
  }

  console.log(`\n✅ 评分完成！结果保存: ${OUTPUT_PATH}`);
  console.log('接下来运行: node report_v3.js');
}

runJudging().catch(e => {
  console.error('评分出错:', e);
  process.exit(1);
});

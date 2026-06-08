/**
 * 多裁判交叉验证评分 v3.1
 * 3 个独立裁判：GPT-5.5、deepseek-v4-flash、MiniMax-M3
 * 每个裁判独立评分后取平均，消除单一裁判偏见
 * 代码补全评分标准已放宽
 *
 * 用法: node judge_multi.js
 */

const fs = require('fs');
const path = require('path');
const url = require('url');

const BASE_DIR = 'C:/Users/xingyun/Desktop/MiniMax-m3-评测项目';
const TASKS_PATH = path.join(BASE_DIR, '03-data/tasks_v3.json');
const RAW_PATH = path.join(BASE_DIR, '03-data/raw_outputs_v3.json');
const OUTPUT_DIR = path.join(BASE_DIR, '03-data');

// ============ 三个裁判配置 ============
const JUDGES = [
  {
    name: 'gpt55',
    display: 'GPT-5.5',
    apiUrl: 'http://www.opcrouter.online/v1/chat/completions',
    apiKey: 'sk-fPpoLMFQf6LZ7NEWsZo4zcpZLwgbcbmaPvMYtqHtKudHNlyV',
    modelId: 'gpt-5.5',
  },
  {
    name: 'deepseek',
    display: 'deepseek-v4-flash',
    apiUrl: 'http://www.opcrouter.online/v1/chat/completions',
    apiKey: 'sk-DcsnRTU8nKykcKt10Vc5RdIaRRvWNNf0VE8q9xqcCFmPwRWJ',
    modelId: 'deepseek-v4-flash',
  },
  {
    name: 'minimax',
    display: 'MiniMax-M3',
    apiUrl: 'https://api.minimaxi.com/v1/chat/completions',
    apiKey: 'sk-cp-L2AhFRaNjkQKgG3N9Ysu3o-xXwUGN-oXvH7Jw0lGmYwUVDs-f6YaiV4aMR2k_vbXWd3KJTRPzoK4XWlNYSRK6_8ObFvZDQcyYXaO0HqaeXKVxl96MprkPDc',
    modelId: 'MiniMax-M3',
  },
];

// ============ 评分标准（代码补全已放宽） ============
const RUBRICS = {
  '代码生成': `你是Python代码评测专家。对以下模型输出的代码进行评分（0-10分）。
0-3：无法运行/逻辑完全错误；4-5：可运行但结果有误；6-7：基本正确但效率或风格有瑕疵；8-9：正确且较高效；10：完美实现。
只根据代码本身质量评分，忽略模型名。输出格式：Score: X\nReason: ...`,

  'SQL查询': `你是SQL评测专家。对以下SQL语句进行评分（0-10分）。
0-3：语法错误/完全不符合题意；4-5：语法基本正确但逻辑错误；6-7：基本正确但有小缺陷；8-9：完全正确；10：完美。
关注语义正确性而非具体列名别名差异。输出格式：Score: X\nReason: ...`,

  '错误修复': `你是Python代码评测专家。对比原代码的bug和修复后的代码进行评分（0-10分）。
0-3：未修复/引入新bug；4-5：修复了部分bug；6-7：修复了主要bug；8-9：完全正确修复；10：完美修复且额外优化。
输出格式：Score: X\nReason: ...`,

  '代码优化': `你是Python代码评测专家。对优化后的代码进行评分（0-10分）。
0-3：未优化/更差；4-5：有优化意图但效果有限；6-7：有一定优化；8-9：明显优化；10：最优实现。
优化必须保持功能等价。输出格式：Score: X\nReason: ...`,

  '代码补全': `你是Python代码评测专家。对以下代码补全输出进行评分（0-10分）。
【重要评分标准】模型输出可以是：①仅补全缺失的代码片段；②或补全后完整的函数。两种形式都接受。
评分依据：补全的代码是否正确、是否符合上下文逻辑、是否能与已有代码无缝衔接。
0-3：补全完全错误/无关；4-5：部分正确但逻辑有误；6-7：基本正确但有小问题；8-9：完全正确且与上下文衔接良好；10：完美补全。
不要因为是完整函数输出就降分。输出格式：Score: X\nReason: ...`,

  '算法能力': `你是算法评测专家。对以下算法解答进行评分（0-10分）。
0-3：完全错误；4-5：思路部分正确但结果错误；6-7：基本正确但过程不够清晰；8-9：答案正确思路清晰；10：完美解答。
数学题关注最终答案正确性，算法题关注思路和复杂度。输出格式：Score: X\nReason: ...`,

  '多语言办公': `你是办公文档评测专家。对以下多语言办公内容进行评分（0-10分）。
0-3：完全不满足/语言错误严重；4-5：基本满足但有很多问题；6-7：满足主要要求；8-9：完全满足；10：超出预期。
关注语言正确性和格式规范性。输出格式：Score: X\nReason: ...`,

  '信息抽取': `你是NLP评测专家。对以下信息抽取结果进行评分（0-10分）。
0-3：完全未抽取/全错；4-5：抽取了部分但遗漏很多；6-7：抽取了大部分正确；8-9：完全正确；10：完美。
关注实体边界正确性和是否有幻觉（编造实体）。输出格式：Score: X\nReason: ...`,

  '文档撰写': `你是企业文档评测专家。对以下文档进行评分（0-10分）。
0-3：完全不满足/格式混乱；4-5：勉强满足但问题多；6-7：基本满足；8-9：很好；10：完美。
检查是否包含题目要求的所有要素，语气是否符合场景。输出格式：Score: X\nReason: ...`,

  '邮件处理': `你是商务邮件评测专家。对以下邮件内容进行评分（0-10分）。
0-3：完全不满足/语气严重不当；4-5：基本满足但有多处问题；6-7：满足主要要求；8-9：完全满足；10：完美。
邮件必须有明确的收件人意识。输出格式：Score: X\nReason: ...`,

  '表格处理': `你是数据分析评测专家。对以下表格处理结果进行评分（0-10分）。
0-3：公式/代码错误/完全不符合；4-5：有正确意图但实现有错误；6-7：基本正确但有小缺陷；8-9：完全正确；10：完美。
Excel公式关注语法正确性，Python代码关注可执行性。输出格式：Score: X\nReason: ...`,
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function loadJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; } }
function saveJSON(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf-8'); }
function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

async function callJudge(judgeCfg, promptText, systemPrompt) {
  const body = {
    model: judgeCfg.modelId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: promptText },
    ],
    temperature: 0.1,
    max_tokens: 256,
  };
  try {
    const resp = await fetch(judgeCfg.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${judgeCfg.apiKey}` },
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
  const jsonMatch = text.match(/\{[\s\S]*?"score"\s*:\s*(\d+)[\s\S]*?\}/);
  if (jsonMatch) return parseInt(jsonMatch[1], 10);
  const m = text.match(/(?:score|评分|得分)[:：\s]*(\d+)(?:\s*分)?/i);
  if (m) return parseInt(m[1], 10);
  const nums = text.match(/\b(\d{1,2})\b/g);
  if (nums) {
    const n = parseInt(nums[0], 10);
    if (n >= 0 && n <= 10) return n;
  }
  return null;
}

async function runJudge(judge) {
  console.log('\n' + '='.repeat(60));
  console.log(`裁判: ${judge.display} (${judge.name})`);
  console.log('='.repeat(60));

  const cpDir = path.join(OUTPUT_DIR, `checkpoints_judge_${judge.name}`);
  ensureDir(cpDir);

  const tasks = loadJSON(TASKS_PATH) || [];
  const rawOutputs = loadJSON(RAW_PATH) || {};
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
      const rubric = RUBRICS[dim] || RUBRICS['文档撰写'];
      const cpPath = path.join(cpDir, `${model}_${dim.replace(/\s+/g, '_')}_judge.json`);
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

请给出评分（0-10分）和简短理由（30字以内）。
输出格式：
Score: X
Reason: ...`;

        let score = null;
        let reason = '';
        let attempts = 0;

        while (score === null && attempts < 3) {
          const res = await callJudge(judge, userPrompt, rubric);
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
            const rm = res.text.match(/(?:reason|理由|原因)[:：\s]*(.+)/i);
            reason = rm ? rm[1].trim() : res.text.slice(0, 50);
          }
        }

        if (score === null) {
          score = 5;
          reason = '裁判解析失败，使用默认中分';
        }

        score = Math.max(0, Math.min(10, score));

        checkpoint[tid] = { score, reason, dim, judge: judge.name };
        allJudgments[model][tid] = checkpoint[tid];
        saveJSON(cpPath, checkpoint);

        done++;
        process.stdout.write(`    ${tid}: ${score}/10 | `);
        if (done % 5 === 0) process.stdout.write('\n');

        await sleep(400);
      }

      if (done % 5 !== 0) process.stdout.write('\n');
      console.log(`    新评分: ${done}, 跳过: ${skipped}`);
    }
  }

  // 保存该裁判的完整评分
  const judgeOutputPath = path.join(OUTPUT_DIR, `judgments_${judge.name}.json`);
  saveJSON(judgeOutputPath, allJudgments);
  console.log(`\n✅ ${judge.display} 评分完成！保存: ${judgeOutputPath}`);
  return allJudgments;
}

// ============ 合并三个裁判的结果 ============
function mergeJudges() {
  console.log('\n' + '='.repeat(60));
  console.log('合并三个裁判评分，取平均值...');
  console.log('='.repeat(60));

  const merged = {};
  const judgeNames = JUDGES.map(j => j.name);

  // 加载所有裁判结果
  const judgeResults = {};
  for (const j of JUDGES) {
    const p = path.join(OUTPUT_DIR, `judgments_${j.name}.json`);
    judgeResults[j.name] = loadJSON(p) || {};
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

  // 计算新报告
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

  // 打印新排名
  console.log('\n=== 三裁判平均分排名 ===');
  const ranked = modelNames.slice().sort((a, b) => report[b]._overall - report[a]._overall);
  ranked.forEach((m, i) => {
    console.log(`  ${i + 1}. ${m}: ${report[m]._overall}/10`);
  });
}

// ============ 主流程 ============
async function main() {
  const targetJudge = process.argv[2];

  if (targetJudge) {
    // 单裁判模式（用于并行）
    const judge = JUDGES.find(j => j.name === targetJudge);
    if (!judge) {
      console.error('未知裁判:', targetJudge);
      console.error('可用裁判:', JUDGES.map(j => j.name).join(', '));
      process.exit(1);
    }
    console.log(`MiniMax-m3 多裁判交叉验证 v3.1 — 单裁判模式: ${judge.display}`);
    await runJudge(judge);
    console.log('\n🎉 该裁判评分完成！');
  } else {
    // 全裁判串行模式（用于单机跑）
    console.log('MiniMax-m3 多裁判交叉验证 v3.1');
    console.log(`裁判: ${JUDGES.map(j => j.display).join(', ')}`);

    for (const judge of JUDGES) {
      await runJudge(judge);
    }

    mergeJudges();
    console.log('\n🎉 全部完成！');
  }
}

main().catch(e => {
  console.error('运行出错:', e);
  process.exit(1);
});

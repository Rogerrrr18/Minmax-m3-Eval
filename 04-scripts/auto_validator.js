/**
 * 自动轻量级验证器 v3.0
 * 对代码/SQL/算法等可验证维度做规则级检查，输出基础分 (0-3)
 * 深度评分交给 judge_v3.js (GPT-5.5)
 *
 * 验证逻辑：
 *   - 非空检查：输出为空/报错 = 0 分
 *   - 截断检查：输出被截断 = 1 分（上限）
 *   - 格式检查：代码类是否含有效代码结构、SQL 是否含有效语句
 *   - 可执行检查（可选）：若系统有 Python，尝试执行代码/SQL
 *
 * 用法: node auto_validator.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_DIR = 'C:/Users/xingyun/Desktop/MiniMax-m3-评测项目';
const RAW_PATH = path.join(BASE_DIR, '03-data/raw_outputs_v3.json');
const TASKS_PATH = path.join(BASE_DIR, '03-data/tasks_v3.json');
const OUTPUT_PATH = path.join(BASE_DIR, '03-data/auto_validation_v3.json');

// 检测系统是否有可用 Python（Windows 上避免触发 Microsoft Store）
function detectPython() {
  const candidates = ['python3', 'py'];
  for (const cmd of candidates) {
    try {
      const ver = execSync(`${cmd} --version`, { encoding: 'utf-8', timeout: 3000 });
      if (ver.includes('Python')) return cmd;
    } catch {}
  }
  // Windows 上 'python' 可能触发 Microsoft Store，跳过检测
  return null;
}
const PYTHON_CMD = detectPython();
console.log(`[信息] Python 检测: ${PYTHON_CMD || '未找到（将跳过执行验证）'}`);

// ============ 加载数据 ============
const rawOutputs = JSON.parse(fs.readFileSync(RAW_PATH, 'utf-8'));
const tasks = JSON.parse(fs.readFileSync(TASKS_PATH, 'utf-8'));
const taskMap = {};
tasks.forEach(t => taskMap[t.task_id] = t);

// ============ 验证函数 ============

function isEmptyOutput(output) {
  return !output || output.trim().length === 0 || output.startsWith('[API Error') || output.startsWith('[Exception');
}

function hasCodeStructure(output) {
  const code = output.trim();
  // 至少包含一个 Python 关键字/结构
  const patterns = [
    /\bdef\s+\w+\s*\(/,
    /\bclass\s+\w+/,
    /\bimport\s+\w+/,
    /\bfrom\s+\w+\s+import/,
    /\breturn\s+/,
    /\bif\s+__name__\s*==\s*['"]__main__['"]/,
    /\bprint\s*\(/,
    /\bfor\s+\w+\s+in\s+/,
    /\bwhile\s+/,
    /\btry\s*:/,
    /\blambda\s+/,
    /\blist\s*\(|\bdict\s*\(|\bset\s*\(/,
  ];
  return patterns.some(p => p.test(code));
}

function hasSQLStructure(output) {
  const sql = output.trim().toLowerCase();
  return /\b(select|insert|update|delete|create|drop|alter)\b/.test(sql);
}

function extractPythonCode(output) {
  // 提取 ```python ... ``` 或 ``` ... ```
  const m = output.match(/```(?:python)?\s*\n?([\s\S]*?)```/);
  if (m) return m[1].trim();
  return output.trim();
}

function safeExecPython(codeSnippet, timeoutMs = 5000) {
  if (!PYTHON_CMD) return { ok: false, error: 'Python not available' };
  try {
    // 简单包装：把代码写入临时文件执行（更安全）
    const tmpFile = path.join(require('os').tmpdir(), `eval_${Date.now()}_${Math.random().toString(36).slice(2)}.py`);
    fs.writeFileSync(tmpFile, codeSnippet, 'utf-8');
    const result = execSync(`${PYTHON_CMD} "${tmpFile}"`, { encoding: 'utf-8', timeout: timeoutMs });
    fs.unlinkSync(tmpFile);
    return { ok: true, output: result };
  } catch (err) {
    return { ok: false, error: err.stderr || err.message };
  }
}

function validateCodeTask(task, output) {
  if (isEmptyOutput(output)) return { score: 0, reason: '输出为空或API错误' };

  const code = extractPythonCode(output);

  // 截断检测
  const last20 = code.slice(-20);
  const looksTruncated = !/[}\]`"')\n]\s*$/.test(last20) && code.length > 100;
  if (looksTruncated) return { score: 1, reason: '输出可能被截断' };

  // 代码结构检查
  if (!hasCodeStructure(code)) return { score: 1, reason: '输出不含有效Python代码结构' };

  // 尝试执行（如果 Python 可用且代码简单）
  if (PYTHON_CMD && code.length < 2000 && !code.includes('input(')) {
    const execResult = safeExecPython(code, 3000);
    if (execResult.ok) {
      return { score: 3, reason: '代码结构正确且可执行' };
    } else {
      // 执行失败但结构正确
      return { score: 2, reason: '代码结构正确但执行报错（可能缺少上下文）' };
    }
  }

  return { score: 2, reason: '代码结构正确' };
}

function validateSQLTask(task, output) {
  if (isEmptyOutput(output)) return { score: 0, reason: '输出为空或API错误' };

  const sql = extractPythonCode(output).toLowerCase();
  if (!hasSQLStructure(sql)) return { score: 1, reason: '输出不含有效SQL语句' };

  // 简单 SQLite 执行（构建内存表）
  if (PYTHON_CMD) {
    const testSchema = buildSpiderSchema(task.prompt);
    const testScript = `
import sqlite3
conn = sqlite3.connect(':memory:')
c = conn.cursor()
${testSchema}
try:
    c.execute("""${sql.replace(/"/g, '\\"')}""")
    print('SQL_OK')
except Exception as e:
    print('SQL_ERROR:', e)
conn.close()
`;
    const execResult = safeExecPython(testScript, 3000);
    if (execResult.ok && execResult.output.includes('SQL_OK')) {
      return { score: 3, reason: 'SQL语法正确且可在SQLite执行' };
    }
    return { score: 2, reason: 'SQL结构正确但执行可能因schema差异报错' };
  }

  return { score: 2, reason: 'SQL结构正确' };
}

// 为 Spider SQL 构建内存 schema（简化版）
function buildSpiderSchema(prompt) {
  // 从 prompt 中提取表结构并生成 CREATE TABLE
  const lines = prompt.split('\n');
  let schema = '';
  let currentTable = '';
  const tables = {};

  for (const line of lines) {
    const tableMatch = line.match(/表结构[：:]\s*(\w+)\s*\(([^)]+)\)/);
    if (tableMatch) {
      const tName = tableMatch[1];
      const cols = tableMatch[2].split(',').map(c => c.trim().split(/\s+/)[0]);
      tables[tName] = cols;
    }
  }

  for (const [tName, cols] of Object.entries(tables)) {
    const colDefs = cols.map(c => `${c} TEXT`).join(', ');
    schema += `c.execute("CREATE TABLE IF NOT EXISTS ${tName} (${colDefs})")\n`;
  }
  return schema || '';
}

function validateAlgorithmTask(task, output) {
  if (isEmptyOutput(output)) return { score: 0, reason: '输出为空或API错误' };

  // 算法题：检查是否包含数字答案或代码
  const hasCode = hasCodeStructure(output);
  const hasNumbers = /\b\d+\b/.test(output);
  const hasExplanation = /答案|结果|等于|Answer|result/i.test(output);

  if (hasCode) return { score: 3, reason: '包含可执行代码' };
  if (hasNumbers && hasExplanation) return { score: 2, reason: '包含数字答案和解释' };
  if (hasNumbers) return { score: 2, reason: '包含数字答案' };
  return { score: 1, reason: '输出非空但缺少明确答案' };
}

function validateGeneric(task, output) {
  if (isEmptyOutput(output)) return { score: 0, reason: '输出为空或API错误' };
  if (output.length < 10) return { score: 1, reason: '输出过短' };
  return { score: 2, reason: '输出非空且有内容' };
}

// ============ 主流程 ============

function runValidation() {
  const results = {};
  const modelNames = Object.keys(rawOutputs);

  for (const model of modelNames) {
    results[model] = {};
    const modelData = rawOutputs[model];

    for (const [taskId, record] of Object.entries(modelData)) {
      const task = taskMap[taskId];
      if (!task) {
        console.warn(`[警告] 未知任务: ${taskId}`);
        continue;
      }

      const output = record.output || '';
      const dim = task.dim;

      let validation;
      if (['代码生成', '错误修复', '代码优化', '代码补全'].includes(dim)) {
        validation = validateCodeTask(task, output);
      } else if (dim === 'SQL查询') {
        validation = validateSQLTask(task, output);
      } else if (dim === '算法能力') {
        validation = validateAlgorithmTask(task, output);
      } else {
        validation = validateGeneric(task, output);
      }

      results[model][taskId] = {
        ...validation,
        dim,
        outputLength: output.length,
        truncated: record.truncated || false,
      };
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf-8');

  // 摘要
  console.log('\n' + '='.repeat(60));
  console.log('自动验证摘要');
  console.log('='.repeat(60));

  for (const model of modelNames) {
    const scores = Object.values(results[model]);
    const avg = scores.reduce((a, b) => a + b.score, 0) / scores.length;
    const zeros = scores.filter(s => s.score === 0).length;
    const threes = scores.filter(s => s.score === 3).length;
    console.log(`${model}:`);
    console.log(`  平均基础分: ${avg.toFixed(2)}/3`);
    console.log(`  0分(空/错): ${zeros} | 3分(优秀): ${threes} | 总计: ${scores.length}`);
  }

  console.log(`\n✅ 验证结果已保存: ${OUTPUT_PATH}`);
  console.log('接下来运行: node judge_v3.js');
}

runValidation();

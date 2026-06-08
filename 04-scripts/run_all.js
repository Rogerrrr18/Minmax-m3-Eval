/**
 * MiniMax-m3 评测一键执行调度器 v3.0
 * 按顺序执行：eval_v3.js -> auto_validator.js -> judge_v3.js -> report_v3.js
 *
 * 用法: node run_all.js [phase]
 *   phase 可选: eval | validate | judge | report
 *   不传 phase 则执行全部
 */

const { execSync } = require('child_process');
const path = require('path');

const SCRIPT_DIR = __dirname;

const phases = [
  { name: '模型调用 (eval_v3.js)', cmd: 'node eval_v3.js', time: '预计 30-60 分钟' },
  { name: '自动验证 (auto_validator.js)', cmd: 'node auto_validator.js', time: '预计 2-5 分钟' },
  { name: '裁判评分 (judge_v3.js)', cmd: 'node judge_v3.js', time: '预计 60-120 分钟' },
  { name: '生成报告 (report_v3.js)', cmd: 'node report_v3.js', time: '预计 10 秒' },
];

function runPhase(phase) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[执行] ${phase.name}`);
  console.log(`[预计] ${phase.time}`);
  console.log('='.repeat(60));
  try {
    execSync(phase.cmd, { cwd: SCRIPT_DIR, stdio: 'inherit' });
    console.log(`\n✅ ${phase.name} 完成`);
    return true;
  } catch (e) {
    console.error(`\n❌ ${phase.name} 失败: ${e.message}`);
    return false;
  }
}

const targetPhase = process.argv[2];

if (targetPhase) {
  const phaseMap = {
    eval: phases[0],
    validate: phases[1],
    judge: phases[2],
    report: phases[3],
  };
  const p = phaseMap[targetPhase];
  if (!p) {
    console.error(`未知阶段: ${targetPhase}`);
    console.log('可用阶段: eval, validate, judge, report');
    process.exit(1);
  }
  runPhase(p);
} else {
  console.log('MiniMax-m3 评测 v3.0 一键执行');
  console.log('总预计时间: 2-3 小时（取决于网络和 API 速度）');
  console.log('\n提示:');
  console.log('  - 每个阶段支持断点续跑，中断后可重新运行继续');
  console.log('  - 模型调用阶段可以 Ctrl+C 中断，checkpoint 会自动保存');
  console.log('  - 建议分阶段执行以便观察中间结果');
  console.log('\n按 Enter 开始执行全部阶段，或 Ctrl+C 取消...');

  // 非交互式环境直接执行
  if (process.stdin.isTTY) {
    process.stdin.once('data', () => {
      executeAll();
    });
  } else {
    executeAll();
  }
}

function executeAll() {
  for (const phase of phases) {
    const ok = runPhase(phase);
    if (!ok) {
      console.log('\n[中断] 评测流程在某阶段失败，请修复后从该阶段重新运行：');
      console.log(`  node run_all.js ${phase.name.split(' ')[0].toLowerCase()}`);
      process.exit(1);
    }
  }
  console.log('\n' + '='.repeat(60));
  console.log('🎉 全部评测完成！');
  console.log('='.repeat(60));
  console.log('查看报告:');
  console.log('  03-data/eval_report_v3.md');
  console.log('  03-data/eval_report_v3.json');
}

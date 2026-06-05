/**
 * MiniMax-m3 评测数据集准备脚本
 * 目标：补全 11 个维度的测试题目，确保每维度 >= 50 题，总计 >= 550 题
 * 优先使用官方/学术数据集，缺失部分构造高质量中文题目
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = 'C:/Users/xingyun/Desktop/MiniMax-m3-评测项目/05-数据集';
const RESULT_DIR = 'C:/Users/xingyun/Desktop/MiniMax-m3-评测项目/03-数据与结果';

function loadJSON(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf-8'));
  } catch (e) {
    console.error(`Failed to load ${name}: ${e.message}`);
    return [];
  }
}

function saveJSON(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Saved ${name} with ${data.length} items`);
}

// ============ 1. 加载现有数据集 ============
const bigcodebench = loadJSON('bigcodebench_300.json');
const mbpp = loadJSON('mbpp_500.json');
const codecontests = loadJSON('codecontests_200.json');
const codesearchnet = loadJSON('codesearchnet_100.json');
const gsm8k = loadJSON('gsm8k_100.json');
const pawsx = loadJSON('pawsx_200.json');
const spider = loadJSON('spider_300.json');
const xsum = loadJSON('xsum_50.json');
const manualDims = loadJSON('manual_dims.json'); // 60道BugFix
const tasksV2 = JSON.parse(fs.readFileSync(path.join(RESULT_DIR, 'tasks_v2.json'), 'utf-8'));

console.log('=== 现有数据集加载完成 ===');
console.log(`BigCodeBench: ${bigcodebench.length}`);
console.log(`MBPP: ${mbpp.length}`);
console.log(`CodeContests: ${codecontests.length} (无expected_note!)`);
console.log(`CodeSearchNet: ${codesearchnet.length}`);
console.log(`GSM8K: ${gsm8k.length}`);
console.log(`PAWS-X: ${pawsx.length}`);
console.log(`Spider: ${spider.length}`);
console.log(`XSum: ${xsum.length}`);
console.log(`manual_dims (BugFix): ${manualDims.length}`);
console.log(`tasks_v2 总计: ${tasksV2.length}`);

// ============ 2. 提取 tasks_v2 中已有的高质量题目 ============
const existingBugFix = tasksV2.filter(t => t.dim === '错误修复');
const existingOptimize = tasksV2.filter(t => t.dim === '代码优化');
const existingNER = tasksV2.filter(t => t.dim === '信息抽取');

console.log('\n=== tasks_v2 中已有题目 ===');
console.log(`BugFix: ${existingBugFix.length}`);
console.log(`Optimize: ${existingOptimize.length}`);
console.log(`NER: ${existingNER.length}`);

// ============ 3. 生成 BugFix 题目 ============
// manual_dims.json 已有 60 道高质量 BugFix 题，直接使用
const bugfixTasks = [...manualDims];
// 重命名 task_id 确保统一
bugfixTasks.forEach((t, i) => {
  t.task_id = `BugFix_${String(i + 1).padStart(3, '0')}`;
  t.dim = '错误修复';
  t.bench = t.bench || '自建-BugFix';
});
console.log(`\nBugFix 总计: ${bugfixTasks.length} 题`);
saveJSON('bugfix_60.json', bugfixTasks);

// ============ 4. 生成 Optimize 题目 ============
// 使用 tasks_v2 中已有的 30 题 + 从代码数据集构造 20 题
const optimizeTasks = [...existingOptimize];

// 从 mbpp 和 bigcodebench 构造低效版本
function makeInefficient(code) {
  let buggy = code;
  // 模式1: set() -> list()
  if (buggy.includes('set(')) buggy = buggy.replace('set(', 'list(', 1);
  // 模式2: dict() -> {}
  else if (buggy.includes('dict()')) buggy = buggy.replace('dict()', '{}');
  // 模式3: 列表推导式 -> 循环（如果存在）
  else if (/\[\s*\w+\s+for\s+\w+\s+in/.test(buggy)) {
    // 简单的列表推导式替换不太安全，跳过
  }
  // 模式4: .get() -> []
  else if (buggy.includes('.get(')) buggy = buggy.replace('.get(', '[', 1).replace(',', ']', 1);
  // 模式5: 提前 return -> 遍历完再 return
  else if (/return\s+\w+\s*\n/.test(buggy)) {
    // 跳过，太复杂
  }
  return buggy === code ? null : buggy;
}

let optCount = 0;
const codeSources = [
  ...mbpp.filter(t => t.expected_note && t.expected_note.length > 50).map(t => t.expected_note),
  ...bigcodebench.filter(t => t.expected_note && t.expected_note.length > 50).map(t => t.expected_note)
];

for (let i = 0; i < codeSources.length && optCount < 20; i++) {
  const code = codeSources[i];
  const buggy = makeInefficient(code);
  if (buggy) {
    optimizeTasks.push({
      task_id: `Optimize_${String(optimizeTasks.length + 1).padStart(3, '0')}`,
      dim: '代码优化',
      bench: 'BigCodeBench-Opt',
      difficulty: '较难',
      prompt: `请优化以下Python代码，提高时间或空间复杂度（保持功能不变）：\n\`\`\`python\n${buggy}\n\`\`\``,
      expected_note: code
    });
    optCount++;
  }
}

console.log(`\nOptimize 总计: ${optimizeTasks.length} 题`);
saveJSON('optimize_full.json', optimizeTasks);

// ============ 5. 生成 NER 题目 ============
// 使用 tasks_v2 中已有的 30 题 + 构造 20 道新题
const nerTasks = [...existingNER];

const nerTexts = [
  { text: '特斯拉CEO埃隆·马斯克于2022年10月27日以440亿美元收购了Twitter公司，并将其更名为X。', entities: '埃隆·马斯克:人名, 2022年10月27日:时间, 440亿美元:金额, Twitter:组织, X:产品' },
  { text: '中国科学院院士钟南山在2020年1月20日接受央视采访时首次证实新冠病毒存在人传人现象。', entities: '钟南山:人名, 2020年1月20日:时间, 央视:组织, 新冠病毒:疾病' },
  { text: '苹果公司于2023年9月12日在加州库比蒂诺的史蒂夫·乔布斯剧院发布了iPhone 15系列手机。', entities: '苹果公司:组织, 2023年9月12日:时间, 加州:地点, 库比蒂诺:地点, 史蒂夫·乔布斯:人名, iPhone 15:产品' },
  { text: '贵州茅台股价于2021年2月10日达到历史新高2608.59元，总市值超过3.2万亿元人民币。', entities: '贵州茅台:组织, 2021年2月10日:时间, 2608.59元:金额, 3.2万亿元:金额' },
  { text: '2024年巴黎奥运会于7月26日开幕，中国体育代表团由乒乓球运动员马龙和花样游泳运动员冯雨担任旗手。', entities: '2024年:时间, 巴黎:地点, 7月26日:时间, 中国体育代表团:组织, 马龙:人名, 冯雨:人名' },
  { text: '复旦大学附属华山医院感染科主任张文宏教授在2023年全国两会上建议加强基层医疗体系建设。', entities: '复旦大学附属华山医院:组织, 张文宏:人名, 2023年:时间' },
  { text: '大疆创新科技有限公司创始人汪滔于1980年出生于浙江杭州，2006年在深圳创立了大疆。', entities: '大疆创新科技有限公司:组织, 汪滔:人名, 1980年:时间, 浙江杭州:地点, 2006年:时间, 深圳:地点, 大疆:产品' },
  { text: '拜登政府于2024年5月14日宣布对价值180亿美元的中国进口商品加征关税，包括电动汽车、太阳能电池等。', entities: '拜登:人名, 2024年5月14日:时间, 180亿美元:金额, 中国:地点' },
  { text: '携程旅行网联合创始人梁建章于1969年出生于上海，1999年与季琦、沈南鹏、范敏共同创立了携程。', entities: '携程旅行网:组织, 梁建章:人名, 1969年:时间, 上海:地点, 1999年:时间, 季琦:人名, 沈南鹏:人名, 范敏:人名, 携程:组织' },
  { text: '比亚迪股份有限公司董事长王传福于1966年2月15日出生于安徽芜湖，1995年在深圳创立了比亚迪。', entities: '比亚迪股份有限公司:组织, 王传福:人名, 1966年2月15日:时间, 安徽芜湖:地点, 1995年:时间, 深圳:地点, 比亚迪:组织' },
  { text: 'OpenAI于2022年11月30日发布了ChatGPT，引发全球人工智能应用热潮。该公司成立于2015年，总部位于旧金山。', entities: 'OpenAI:组织, 2022年11月30日:时间, ChatGPT:产品, 2015年:时间, 旧金山:地点' },
  { text: '诺贝尔文学奖得主莫言于1955年2月17日出生于山东高密，2012年获得诺贝尔文学奖，代表作有《红高粱家族》。', entities: '莫言:人名, 1955年2月17日:时间, 山东高密:地点, 2012年:时间, 诺贝尔文学奖:奖项, 《红高粱家族》:作品' },
  { text: '美团点评于2018年9月20日在香港联交所上市，发行价69港元，创始人王兴持股约11.4%。', entities: '美团点评:组织, 2018年9月20日:时间, 香港联交所:组织, 69港元:金额, 王兴:人名' },
  { text: '中国探月工程嫦娥六号探测器于2024年5月3日在海南文昌发射，成功完成世界首次月球背面采样返回任务。', entities: '中国探月工程:组织, 嫦娥六号:产品, 2024年5月3日:时间, 海南文昌:地点' },
  { text: '著名物理学家杨振宁于1957年获得诺贝尔物理学奖，当时他年仅35岁，在普林斯顿高等研究院工作。', entities: '杨振宁:人名, 1957年:时间, 诺贝尔物理学奖:奖项, 35岁:数量, 普林斯顿高等研究院:组织' },
  { text: '蔚来汽车创始人李斌于2014年11月在上海创立蔚来，公司2021年营收361.4亿元人民币。', entities: '蔚来汽车:组织, 李斌:人名, 2014年11月:时间, 上海:地点, 蔚来:组织, 2021年:时间, 361.4亿元人民币:金额' },
  { text: '京东集团创始人刘强东于1974年2月14日出生于江苏宿迁，1998年6月18日在北京中关村创立了京东公司。', entities: '京东集团:组织, 刘强东:人名, 1974年2月14日:时间, 江苏宿迁:地点, 1998年6月18日:时间, 北京中关村:地点, 京东:组织' },
  { text: '华为Mate 60 Pro手机于2023年8月29日突然发售，搭载麒麟9000S芯片，起售价6999元。', entities: '华为:组织, Mate 60 Pro:产品, 2023年8月29日:时间, 麒麟9000S:产品, 6999元:金额' },
  { text: '字节跳动旗下抖音海外版TikTok于2017年5月上线，截至2023年全球月活用户超过15亿。', entities: '字节跳动:组织, 抖音:产品, TikTok:产品, 2017年5月:时间, 2023年:时间, 15亿:数量' },
  { text: '中国工程院院士袁隆平于1930年9月7日出生于北京，被誉为"杂交水稻之父"，2021年5月22日在长沙逝世。', entities: '袁隆平:人名, 1930年9月7日:时间, 北京:地点, 杂交水稻之父:头衔, 2021年5月22日:时间, 长沙:地点' }
];

for (let i = 0; i < nerTexts.length && nerTasks.length < 50; i++) {
  const item = nerTexts[i];
  nerTasks.push({
    task_id: `NER_${nerTasks.length}`,
    dim: '信息抽取',
    bench: '自建-NER',
    difficulty: '中等',
    prompt: `从以下文本中抽取所有命名实体（人名、组织名、地点、时间、产品名等），按格式"实体:类型"输出：\n${item.text}`,
    expected_note: item.entities
  });
}

console.log(`\nNER 总计: ${nerTasks.length} 题`);
saveJSON('ner_50.json', nerTasks.slice(0, 50));

// ============ 6. 解决 CodeContests 无答案问题 ============
// 方案：保留 GSM8K 20题，从 mbpp 选 30 道算法题，废弃 CodeContests
const algorithmTasks = gsm8k.slice(0, 50).map((t, i) => ({
  ...t,
  task_id: `GSM8K_${i}`,
  dim: '算法能力',
  bench: 'GSM8K'
}));

// 从 mbpp 中选有挑战性的算法题（排序、搜索、数学相关）
const algoKeywords = ['sort', 'search', 'find', 'max', 'min', 'sum', 'prime', 'fibonacci', 'factorial', 'gcd', 'lcm', 'permutation', 'combination', 'binary'];
const mbppAlgo = mbpp.filter(t => {
  const p = (t.prompt || '').toLowerCase();
  return algoKeywords.some(k => p.includes(k));
}).slice(0, 30).map((t, i) => ({
  ...t,
  task_id: `Algo_MBPP_${i}`,
  dim: '算法能力',
  bench: 'MBPP-Algo',
  difficulty: '中等'
}));

algorithmTasks.push(...mbppAlgo);

console.log(`\n算法能力总计: ${algorithmTasks.length} 题 (GSM8K ${gsm8k.slice(0, 50).length} + MBPP-Algo ${mbppAlgo.length})`);

// ============ 7. 其他维度扩充 ============

// SQL查询: 从 spider_300 取 50 题
const sqlTasks = spider.slice(0, 50).map((t, i) => ({
  ...t,
  task_id: `Spider_${i}`,
  dim: 'SQL查询',
  bench: 'Spider'
}));
console.log(`SQL查询: ${sqlTasks.length} 题`);

// 代码补全: 从 codesearchnet 取 50 题（但只有98项）
const completionTasks = codesearchnet.slice(0, 50).map((t, i) => ({
  ...t,
  task_id: `CodeSearch_${i}`,
  dim: '代码补全',
  bench: 'CodeSearchNet'
}));
console.log(`代码补全: ${completionTasks.length} 题`);

// 多语言办公: 从 pawsx_200 取 50 题
const multilingualTasks = pawsx.slice(0, 50).map((t, i) => ({
  ...t,
  task_id: `PAWSX_${i}`,
  dim: '多语言办公',
  bench: 'PAWS-X'
}));
console.log(`多语言办公: ${multilingualTasks.length} 题`);

// 文档撰写: 已有 30 题 + 从 xsum 取 20 题
const docTasks = tasksV2.filter(t => t.dim === '文档撰写').slice(0, 30);
const xsumDoc = xsum.slice(0, 20).map((t, i) => ({
  task_id: `XSum_Doc_${i}`,
  dim: '文档撰写',
  bench: 'XSum',
  difficulty: '中等',
  prompt: `请对以下新闻进行摘要（不超过100字）：\n${t.prompt || t.article || t.text || ''}`,
  expected_note: t.expected_note || t.summary || ''
}));
docTasks.push(...xsumDoc);
console.log(`文档撰写: ${docTasks.length} 题`);

// 邮件处理: 已有 30 题，构造 20 题补充
const emailTasks = tasksV2.filter(t => t.dim === '邮件处理').slice(0, 30);
const extraEmails = [
  { prompt: '将以下邮件改写成更具说服力的商务合作邀约：「我们想和你们合作，有兴趣的话联系我们。』', expected: '表达合作诚意、说明具体合作领域、提出会面邀请、提供联系方式' },
  { prompt: '作为项目经理，给客户发送一封项目里程碑达成通知邮件，包含：已完成的关键里程碑、团队付出的努力、感谢客户的配合、下一步计划。', expected: '里程碑描述具体、感谢真诚、计划清晰' },
  { prompt: '将以下邮件改写成符合 GDPR 要求的数据处理通知：「我们要用你的数据，你同意一下。』', expected: '明确数据处理目的、法律依据、数据类型、保留期限、用户权利、撤回同意方式' },
  { prompt: '作为招聘经理，向通过终面的候选人发送录用通知邮件，包含：职位名称、入职时间、薪资福利概述、需要准备的材料、回复截止日期。', expected: '信息完整、语气热情专业、材料清单清晰' },
  { prompt: '将以下邮件改写为项目变更通知：「需求变了，之前做的不要了，重做。』', expected: '说明变更原因、影响范围、时间调整、资源重新分配、对团队的歉意' },
  { prompt: '作为法务，向合作方发送一份保密协议签署提醒邮件，说明协议重要性、签署截止日期、未签署的后果、联系人和方式。', expected: '语气严肃但不失礼貌、截止日期明确、后果说明合理' },
  { prompt: '将以下会议邀请改写成更正式的日程安排：「下周二开会，讨论一下方案。』', expected: '会议目的明确、议程清晰、时间地点、参会人员、需要准备的材料' },
  { prompt: '作为产品经理，向研发团队发送一封需求澄清邮件，回应团队对需求文档的疑问，提供更详细的用例说明和验收标准。', expected: '逐一回应疑问、用例具体可执行、验收标准量化' },
  { prompt: '将以下催款邮件改写得更专业：「钱还没到账，赶紧付。』', expected: '语气专业、说明款项明细、提供付款方式、设定期限、保持合作关系' },
  { prompt: '作为 CEO，向全体员工发送公司搬迁通知邮件，包含：搬迁原因、新址信息、搬迁时间表、对员工通勤的影响和补贴方案、疑问解答渠道。', expected: '原因充分、影响评估全面、补贴方案具体、沟通渠道畅通' },
  { prompt: '将以下绩效反馈改写成建设性的发展建议：「你今年表现一般，有些地方需要改进。』', expected: '具体表扬优点、明确指出改进领域、提供发展资源、设定目标' },
  { prompt: '作为客户成功经理，向续约客户发送感谢邮件，包含：回顾合作成果、表达对未来的期待、提供专属优惠、安排年度回顾会议。', expected: '成果量化、期待具体、优惠有吸引力、会议邀请明确' },
  { prompt: '将以下产品下线通知改写成对用户友好的公告：「这个产品不做了，你们换别的吧。』', expected: '说明下线原因、提供迁移方案、数据导出说明、替代产品推荐、时间线清晰' },
  { prompt: '作为 IT 安全负责人，向全员发送钓鱼邮件防范提醒，包含：常见钓鱼手段、识别技巧、遇到可疑邮件的处理步骤、报告渠道。', expected: '案例具体、技巧实用、步骤清晰、报告渠道易记' },
  { prompt: '将以下休假通知改写成对客户影响最小的版本：「我下周休假，有事找别人。』', expected: '提前通知、交接安排、紧急联系方式、预期回复时间、感谢理解' },
  { prompt: '作为供应链经理，向供应商发送质量整改通知，包含：质量问题描述、不合格率数据、整改要求、验收标准、整改期限、后续合作条件。', expected: '问题描述具体、数据支撑、要求可量化、期限合理' },
  { prompt: '将以下内部调动通知改写成正式的岗位调整邮件：「你去别的部门了，下周报道。』', expected: '调动原因、新岗位职责、报到时间、汇报关系、过渡安排、欢迎和祝福' },
  { prompt: '作为培训负责人，向参训员工发送培训效果调研邮件，包含：感谢参与、调研目的、问卷链接、填写时间预估、反馈将如何使用。', expected: '感谢真诚、目的明确、链接醒目、时间预估合理、反馈用途透明' },
  { prompt: '将以下节日祝福改写成有企业文化的节日邮件：「节日快乐。』', expected: '结合企业文化、回顾年度亮点、表达感谢、未来展望、祝福语真挚' },
  { prompt: '作为办公室管理员，向全员发送办公环境升级通知，包含：升级内容、施工时间、影响区域、临时安排、完工预期、建议反馈渠道。', expected: '内容具体、时间安排详细、影响说明充分、替代方案实用' }
].map((e, i) => ({
  task_id: `email_extra_${i}`,
  dim: '邮件处理',
  bench: '自建-邮件',
  difficulty: i % 2 === 0 ? '中等' : '较难',
  prompt: e.prompt,
  expected_note: e.expected
}));
emailTasks.push(...extraEmails);
console.log(`邮件处理: ${emailTasks.length} 题`);

// 表格处理: 已有 30 题，构造 20 题补充
const tableTasks = tasksV2.filter(t => t.dim === '表格处理').slice(0, 30);
const extraTables = [
  { prompt: '给定销售数据表（A=日期, B=销售员, C=产品, D=数量, E=单价），请写Excel公式计算每位销售员的月度总销售额，并按销售额降序排列。', expected: '使用SUMIFS和排序功能，公式正确' },
  { prompt: '有一张学生成绩表（A=姓名, B=语文, C=数学, D=英语），请写公式计算每位学生的总分和平均分，并标记平均分低于60分的学生。', expected: '总分=SUM, 平均分=AVERAGE, 条件格式标红<60' },
  { prompt: '用Python pandas读取CSV文件（columns: user_id, login_date, duration），统计每个用户的月登录次数和平均在线时长，输出为Excel。', expected: 'pandas读取、groupby、to_excel' },
  { prompt: '给定库存表（A=商品名, B=入库量, C=出库量, D=库存量），请写Excel公式实时计算库存量，并设置库存低于10时自动标黄预警。', expected: '库存=入库-出库，条件格式<10黄色' },
  { prompt: '用Python读取两个Excel表（订单表和客户表），按客户ID合并，统计每个客户的订单总金额和最近订单日期，输出汇总表。', expected: 'pandas merge、groupby agg、to_excel' },
  { prompt: '有一张考勤表（A=姓名, B=日期, C=上班时间, D=下班时间），请写公式计算每日工作时长，并统计每人每月迟到次数（上班>9:00）。', expected: '时长=D-C，迟到=COUNTIFS(时间>"9:00")' },
  { prompt: '用Python对CSV数据进行异常值检测：读取sales.csv（date, amount），用Z-score方法标记异常交易，输出异常列表。', expected: 'pandas读取、scipy.stats.zscore、筛选|z|>3' },
  { prompt: '给定项目进度表（A=项目名, B=开始日期, C=结束日期, D=进度%），请写Excel公式计算剩余天数，并用条件格式标记延期项目（进度<100%且结束日期<今天）。', expected: '剩余天数=结束日期-TODAY()，条件格式双重判断' },
  { prompt: '用Python生成一份数据报告：读取performance.csv（team, member, kpi, score），按团队分组统计KPI达标率，并生成柱状图和饼图。', expected: 'pandas groupby、matplotlib双图' },
  { prompt: '有一张报销单（A=日期, B=类别, C=金额, D=发票号），请写Excel数据验证规则：类别只能从「交通/餐饮/住宿/其他」中选择，金额必须>0，发票号不能重复。', expected: '数据验证列表、数值>0、条件格式重复值' },
  { prompt: '用Python清洗数据：读取raw_data.csv，处理缺失值（数值填中位数，文本填"未知"），去除重复行，标准化日期格式，输出clean_data.csv。', expected: 'fillna、drop_duplicates、pd.to_datetime' },
  { prompt: '给定财务报表（A=科目, B=预算, C=实际, D=差异），请写Excel公式计算差异率，并用条件格式标记差异率超过10%的科目。', expected: '差异率=(实际-预算)/预算，条件格式>10%' },
  { prompt: '用Python实现数据透视表功能：读取sales.csv（region, product, month, amount），生成按region×product的交叉汇总表，并计算同比增长率。', expected: 'pivot_table、groupby shift计算同比' },
  { prompt: '有一张客户表（A=客户ID, B=注册日期, C=最近购买日期, D=购买次数），请写Excel公式计算客户生命周期（天）和RFM评分。', expected: '生命周期=最近购买-注册日期，R=距今天数，F=购买次数' },
  { prompt: '用Python对时间序列数据进行滚动统计：读取stock.csv（date, price），计算5日/20日/60日移动平均线，并标注金叉死叉信号。', expected: 'rolling mean、条件判断金叉死叉' },
  { prompt: '给定调查问卷结果表（A=受访者ID, B=满意度1-5, C=推荐意愿1-10, D=留言），请写Excel公式计算NPS得分（推荐者% - 贬损者%）。', expected: 'NPS=COUNTIF(>=9)/总数 - COUNTIF(<=6)/总数' },
  { prompt: '用Python进行A/B测试分析：读取ab_test.csv（group, conversion），计算转化率、置信区间，并进行卡方检验判断差异是否显著。', expected: '分组统计、scipy.stats.chi2_contingency' },
  { prompt: '有一张设备维护表（A=设备名, B=上次维护日期, C=维护周期天, D=状态），请写Excel公式计算下次维护日期，并提前7天标红预警。', expected: '下次维护=上次维护+周期，条件格式<TODAY()+7' },
  { prompt: '用Python生成自动报表：读取multi_sheet.xlsx的所有sheet，汇总各sheet的销售额，生成总表并添加趋势折线图，保存为新Excel。', expected: 'pd.read_excel(sheet_name=None)、concat、to_excel' },
  { prompt: '给定员工信息表（A=姓名, B=部门, C=入职日期, D=薪资），请写Excel公式计算工龄（年）、按部门统计平均薪资，并用数据条可视化薪资分布。', expected: '工龄=DATEDIF、AVERAGEIF、数据条条件格式' }
].map((e, i) => ({
  task_id: `table_extra_${i}`,
  dim: '表格处理',
  bench: '自建-表格',
  difficulty: i % 2 === 0 ? '中等' : '较难',
  prompt: e.prompt,
  expected_note: e.expected
}));
tableTasks.push(...extraTables);
console.log(`表格处理: ${tableTasks.length} 题`);

// 代码生成: 已有 90 题，从 mbpp 和 bigcodebench 补充到 100
const codeGenTasks = tasksV2.filter(t => t.dim === '代码生成').slice(0, 90);
const extraCodeGen = mbpp.slice(30, 40).map((t, i) => ({
  ...t,
  task_id: `MBPP_Extra_${i}`,
  dim: '代码生成',
  bench: 'MBPP'
}));
codeGenTasks.push(...extraCodeGen);
console.log(`代码生成: ${codeGenTasks.length} 题`);

// ============ 8. 合并所有任务生成 tasks_v3.json ============
const allTasks = [
  ...codeGenTasks,
  ...sqlTasks,
  ...algorithmTasks,
  ...completionTasks,
  ...bugfixTasks,
  ...optimizeTasks,
  ...multilingualTasks,
  ...nerTasks,
  ...docTasks,
  ...emailTasks,
  ...tableTasks
];

// 去重（按 task_id）
const seen = new Set();
const uniqueTasks = allTasks.filter(t => {
  if (seen.has(t.task_id)) return false;
  seen.add(t.task_id);
  return true;
});

fs.writeFileSync(path.join(RESULT_DIR, 'tasks_v3.json'), JSON.stringify(uniqueTasks, null, 2), 'utf-8');

console.log('\n========== 数据集准备完成 ==========');
console.log(`代码生成: ${codeGenTasks.length}`);
console.log(`SQL查询: ${sqlTasks.length}`);
console.log(`算法能力: ${algorithmTasks.length}`);
console.log(`代码补全: ${completionTasks.length}`);
console.log(`错误修复: ${bugfixTasks.length}`);
console.log(`代码优化: ${optimizeTasks.length}`);
console.log(`多语言办公: ${multilingualTasks.length}`);
console.log(`信息抽取: ${nerTasks.length}`);
console.log(`文档撰写: ${docTasks.length}`);
console.log(`邮件处理: ${emailTasks.length}`);
console.log(`表格处理: ${tableTasks.length}`);
console.log(`-----------------------------------`);
console.log(`总计: ${uniqueTasks.length} 题`);
console.log(`已保存到 tasks_v3.json`);

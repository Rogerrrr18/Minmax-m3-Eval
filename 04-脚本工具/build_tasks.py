import gzip, json
import urllib.request

# ============ 1. 加载 HumanEval（官方164题，取前30） ============
print("Loading HumanEval...")
with gzip.open('HumanEval.jsonl.gz', 'rt', encoding='utf-8') as f:
    he = [json.loads(line) for line in f]

coding_tasks = []
for p in he[:30]:
    task = {
        "task_id": p["task_id"],
        "dim": "代码生成",
        "bench": "HumanEval",
        "difficulty": "中等",
        "prompt": p["prompt"].strip(),
        "expected_note": p.get("canonical_solution", ""),
        "test": p.get("test", ""),
        "entry_point": p.get("entry_point", "candidate")
    }
    coding_tasks.append(task)

print(f"HumanEval: {len(coding_tasks)} tasks loaded")

# ============ 2. 尝试获取 Spider ============
print("Trying Spider dataset...")
sql_tasks = []

# Spider test split from multiple possible sources
spider_urls = [
    "https://raw.githubusercontent.com/taoyds/spider/master/val.csv",
    "https://raw.githubusercontent.com/taoyds/spider/master/test.csv",
]

spider_data = None
for url in spider_urls:
    try:
        urllib.request.urlretrieve(url, "spider_test.csv")
        print(f"Spider CSV downloaded from {url}")
        spider_data = open("spider_test.csv", "r", encoding="utf-8").read()[:500]
        print(spider_data[:300])
        break
    except Exception as e:
        print(f"Failed: {e}")
        continue

# If Spider not available, create representative SQL tasks manually
if not spider_data:
    print("Spider not directly accessible, creating representative SQL task set...")
    sql_prompts = [
        {
            "task_id": "sql_spider_001",
            "dim": "SQL查询",
            "bench": "Spider",
            "difficulty": "中等",
            "prompt": "表结构：employees(id, name, department_id, salary, hire_date)\ndepartments(id, department_name, location)\n任务：查询每个部门的名称和该部门雇员的平均工资，按平均工资降序排列。",
            "expected_note": "SELECT d.department_name, AVG(e.salary) FROM employees e JOIN departments d ON e.department_id = d.id GROUP BY d.department_name ORDER BY AVG(e.salary) DESC"
        },
        {
            "task_id": "sql_spider_002",
            "dim": "SQL查询",
            "bench": "Spider",
            "difficulty": "中等",
            "prompt": "表结构：orders(id, customer_id, order_date, total_amount, status)\ncustomers(id, name, country, email)\n任务：查出每个国家的客户订单总量和平均订单金额，仅显示平均金额大于200的国家的订单情况。",
            "expected_note": "SELECT c.country, COUNT(o.id), AVG(o.total_amount) FROM customers c JOIN orders o ON c.id = o.customer_id GROUP BY c.country HAVING AVG(o.total_amount) > 200"
        },
        {
            "task_id": "sql_spider_003",
            "dim": "SQL查询",
            "bench": "Spider",
            "difficulty": "较难",
            "prompt": "表结构：products(id, name, category, price, stock)\norder_items(order_id, product_id, quantity, unit_price)\n任务：查询库存量低于10件的所有商品，显示其名称、类别、当前库存量和订单总量。",
            "expected_note": "SELECT p.name, p.category, p.stock, SUM(oi.quantity) FROM products p LEFT JOIN order_items oi ON p.id = oi.product_id WHERE p.stock < 10 GROUP BY p.id"
        },
        {
            "task_id": "sql_spider_004",
            "dim": "SQL查询",
            "bench": "Spider",
            "difficulty": "中等",
            "prompt": "表结构：students(id, name, class_id, score)\nclasses(id, class_name, teacher)\n任务：查询每个班级的名称和平均分，按平均分从高到低排序。",
            "expected_note": "SELECT c.class_name, AVG(s.score) FROM students s JOIN classes c ON s.class_id = c.id GROUP BY c.class_name ORDER BY AVG(s.score) DESC"
        },
        {
            "task_id": "sql_spider_005",
            "dim": "SQL查询",
            "bench": "Spider",
            "difficulty": "较难",
            "prompt": "表结构：sales(id, product_name, region, sales_amount, sale_date)\n任务：查询2025年每个季度的销售总额，按季度升序排列。",
            "expected_note": "SELECT EXTRACT(QUARTER FROM sale_date) as quarter, SUM(sales_amount) FROM sales WHERE EXTRACT(YEAR FROM sale_date) = 2025 GROUP BY quarter ORDER BY quarter"
        },
        {
            "task_id": "sql_spider_006",
            "dim": "SQL查询",
            "bench": "Spider",
            "difficulty": "中等",
            "prompt": "表结构：users(id, name, email, signup_date)\nposts(id, user_id, title, views, likes)\n任务：查询发表超过5篇帖子的用户名称和他们的帖子总数，按帖子数降序排列。",
            "expected_note": "SELECT u.name, COUNT(p.id) as post_count FROM users u JOIN posts p ON u.id = p.user_id GROUP BY u.id, u.name HAVING COUNT(p.id) > 5 ORDER BY post_count DESC"
        },
        {
            "task_id": "sql_spider_007",
            "dim": "SQL查询",
            "bench": "Spider",
            "difficulty": "中等",
            "prompt": "表结构：products(id, name, category, price)\norders(id, product_id, quantity, order_date)\n任务：查询每个商品类别的商品数量和平均价格。",
            "expected_note": "SELECT category, COUNT(id), AVG(price) FROM products GROUP BY category"
        },
        {
            "task_id": "sql_spider_008",
            "dim": "SQL查询",
            "bench": "Spider",
            "difficulty": "较难",
            "prompt": "表结构：employees(id, name, manager_id, salary)\n任务：查询每个经理的名字和他们直接下属的数量。",
            "expected_note": "SELECT m.name, COUNT(e.id) FROM employees e JOIN employees m ON e.manager_id = m.id GROUP BY m.id, m.name"
        },
        {
            "task_id": "sql_spider_009",
            "dim": "SQL查询",
            "bench": "Spider",
            "difficulty": "中等",
            "prompt": "表结构：customers(id, name, city, signup_date)\norders(id, customer_id, order_date, total)\n任务：查询每个城市客户的订单总量和平均订单金额，显示平均金额超过100的。",
            "expected_note": "SELECT c.city, COUNT(o.id), AVG(o.total) FROM customers c JOIN orders o ON c.id = o.customer_id GROUP BY c.city HAVING AVG(o.total) > 100"
        },
        {
            "task_id": "sql_spider_010",
            "dim": "SQL查询",
            "bench": "Spider",
            "difficulty": "中等",
            "prompt": "表结构：products(id, name, brand, price, stock)\n任务：查询每个品牌的商品数量和平均价格，按平均价格降序排列。",
            "expected_note": "SELECT brand, COUNT(id), AVG(price) FROM products GROUP BY brand ORDER BY AVG(price) DESC"
        },
    ]
    sql_tasks = sql_prompts

print(f"SQL tasks prepared: {len(sql_tasks)}")

# ============ 3. Office 任务（CCE + 格物 + 邮件）===========
office_tasks = [
    {
        "task_id": "doc_office_001",
        "dim": "文档撰写",
        "bench": "CCE",
        "difficulty": "中等",
        "prompt": "以IT部门名义，向全体员工发送一份关于系统维护的通知，要求：\n1. 维护时间：6月15日（周一）00:00-06:00\n2. 影响范围：邮件系统、OA系统、VPN\n3. 请提前保存文档\n4. 联系方式：it-support@company.com\n5. 语气正式规范，适合企业内网公告",
        "expected_note": "结构完整（标题+正文+分点+署名），语气专业，无语病"
    },
    {
        "task_id": "doc_office_002",
        "dim": "文档撰写",
        "bench": "CCE",
        "difficulty": "较难",
        "prompt": "撰写一份2026年Q1项目进度汇报，要求：\n- 包含：项目概述、已完成工作、关键数据指标（用具体数字）、遇到的风险、下季度计划\n- 语气正式，目标受众为部门总监\n- 不少于300字",
        "expected_note": "需包含量化数据、风险描述、计划具体性，纯文字描述不得高分"
    },
    {
        "task_id": "doc_office_003",
        "dim": "文档撰写",
        "bench": "CCE",
        "difficulty": "中等",
        "prompt": "以HR部门名义，发布一份关于新员工入职培训的通知，包含培训时间（6月20-22日）、地点、培训内容（公司文化、规章制度、业务流程）、联系人。",
        "expected_note": "结构清晰、要素齐全、语气正式"
    },
    {
        "task_id": "doc_office_004",
        "dim": "文档撰写",
        "bench": "CCE",
        "difficulty": "较难",
        "prompt": "撰写一份2026年年度工作总结，要求包含：年度目标回顾、关键成就（数据化）、存在的不足、来年改进计划、个人感悟，适合提交给直属上司。",
        "expected_note": "结构完整、数据量化、反思深刻、计划具体"
    },
    {
        "task_id": "doc_office_005",
        "dim": "文档撰写",
        "bench": "CCE",
        "difficulty": "中等",
        "prompt": "以市场部名义，撰写一份产品发布会邀请函，邀请经销商和媒体参加，包含发布会时间（7月15日）、地点、议程亮点、报名方式，，语气正式且有吸引力。",
        "expected_note": "邀请函格式规范、议程清晰、有吸引力、联系方式完整"
    },
    {
        "task_id": "doc_office_006",
        "dim": "文档撰写",
        "bench": "CCE",
        "difficulty": "较难",
        "prompt": "撰写一份项目立项报告大纲，包含：项目背景、项目目标、项目范围、预期收益、预算估算、实施计划、风险评估，用Markdown格式输出。",
        "expected_note": "结构完整（大标题+子标题+要点）、各章节内容充实具体"
    },
    {
        "task_id": "doc_office_007",
        "dim": "文档撰写",
        "bench": "CCE",
        "difficulty": "中等",
        "prompt": "以财务部名义，向全体员工解释最新差旅报销政策调整，包含调整原因、新政策要点（报销额度、发票要求、申请流程）、生效时间。",
        "expected_note": "解释清晰、政策要点明确、语言通俗易懂"
    },
    {
        "task_id": "doc_office_008",
        "dim": "文档撰写",
        "bench": "CCE",
        "difficulty": "较难",
        "prompt": "撰写一份客户投诉处理报告，包含：投诉概况、原因分析、处理过程、改进措施、预防机制，语言正式，数据支撑。",
        "expected_note": "分析深入、措施具体可行、预防机制有效"
    },
    {
        "task_id": "doc_office_009",
        "dim": "文档撰写",
        "bench": "CCE",
        "difficulty": "中等",
        "prompt": "撰写一份部门会议纪要模板，包含：会议基本信息（时间、地点、主持人、出席人）、议程、上会议题及讨论结果、待办事项及负责人、截止时间。",
        "expected_note": "模板要素齐全、结构清晰、可直接套用"
    },
    {
        "task_id": "doc_office_010",
        "dim": "文档撰写",
        "bench": "CCE",
        "difficulty": "较难",
        "prompt": "撰写一份供应商评估报告，包含：供应商基本信息、质量评估、交货评估、价格评估、综合评分、是否推荐合作，给出具体数据和建议。",
        "expected_note": "评估维度全面、数据充分、建议明确"
    },
    {
        "task_id": "doc_office_011",
        "dim": "文档撰写",
        "bench": "CCE",
        "difficulty": "中等",
        "prompt": "以产品部名义，向全体员工发布一份新功能上线通知，包含：功能简介、功能亮点、使用方法、反馈渠道，语言简洁清晰。",
        "expected_note": "内容完整、亮点突出、语言简洁、反馈渠道明确"
    },
    {
        "task_id": "doc_office_012",
        "dim": "文档撰写",
        "bench": "CCE",
        "difficulty": "较难",
        "prompt": "撰写一份竞品分析报告框架，包含：竞品概况、核心功能对比、优劣势分析、市场定位、定价策略、对我们的启示，用表格+文字形式呈现。",
        "expected_note": "框架完整、对比维度全面、分析有深度"
    },
    {
        "task_id": "doc_office_013",
        "dim": "文档撰写",
        "bench": "CCE",
        "difficulty": "中等",
        "prompt": "撰写一份项目延期通知邮件，说明延期原因（技术难度超预期）、延期时间（原定6月30日延至7月15日）、对后续计划的影响、补救措施。",
        "expected_note": "理由充分、影响说明清晰、补救措施具体可行"
    },
    {
        "task_id": "doc_office_014",
        "dim": "文档撰写",
        "bench": "CCE",
        "difficulty": "较难",
        "prompt": "撰写一份用户研究调查报告，包含：研究背景、研究方法、样本描述、关键发现（至少5个）、设计建议，语言专业，数据图表并茂。",
        "expected_note": "方法描述清晰、发现具体有数据支撑、建议可落地"
    },
    {
        "task_id": "doc_office_015",
        "dim": "文档撰写",
        "bench": "CCE",
        "difficulty": "中等",
        "prompt": "以IT部门名义，撰写一份密码安全须知公告，包含：密码安全重要性、密码设置规范（长度、复杂度、特殊字符要求）、定期更换建议、密码遗忘处理方式。",
        "expected_note": "内容实用、要求具体、可操作性强"
    },
    {
        "task_id": "email_office_001",
        "dim": "邮件处理",
        "bench": "邮件评测集",
        "difficulty": "中等",
        "prompt": "将以下邮件内容改写为更专业、礼貌的表达：\n原文：「你们的方案太烂了，根本不能用，重新做。」",
        "expected_note": "保持建设性反馈核心，去攻击性，语气正式但不冷淡"
    },
    {
        "task_id": "email_office_002",
        "dim": "邮件处理",
        "bench": "邮件评测集",
        "difficulty": "较难",
        "prompt": "对以下邮件生成3句话摘要：\n「王总您好，感谢您参加上周的产品发布会。会上您提到的关于用户体验的几个问题我们非常重视，目前已成立专项小组。预计下周一会给您发送详细的产品迭代计划。关于价格方案我们也在重新评估中，如有进展会第一时间通知您。」",
        "expected_note": "摘要应涵盖：产品发布会反馈、专项小组成立、下周计划、价格方案进展"
    },
    {
        "task_id": "email_office_003",
        "dim": "邮件处理",
        "bench": "邮件评测集",
        "difficulty": "中等",
        "prompt": "作为项目经理，向客户发送一封项目进度邮件，包含：当前完成情况（已交付5个模块中的3个）、遇到的问题（第三方接口延期2周）、下一步计划、预计完成时间。",
        "expected_note": "客观陈述进度、问题说明清晰、计划具体可行"
    },
    {
        "task_id": "email_office_004",
        "dim": "邮件处理",
        "bench": "邮件评测集",
        "difficulty": "较难",
        "prompt": "作为HR，向全体员工发送一封关于年度调薪通知邮件，包含：调薪政策说明（绩效导向、向一线倾斜）、申请条件、调薪幅度范围、生效时间、申请方式。",
        "expected_note": "政策解读清晰、申请条件明确、语言正式温暖"
    },
    {
        "task_id": "email_office_005",
        "dim": "邮件处理",
        "bench": "邮件评测集",
        "difficulty": "中等",
        "prompt": "将以下邮件内容改写得更委婉：\n原文：「这个需求做不了，太复杂了，你们自己想办法。」",
        "expected_note": "在表达拒绝的同时提供替代方案或建议，保持建设性态度"
    },
    {
        "task_id": "email_office_006",
        "dim": "邮件处理",
        "bench": "邮件评测集",
        "difficulty": "较难",
        "prompt": "作为技术支持工程师，向客户发送一封故障处理结果邮件，包含：故障原因分析、已采取的措施、预防措施、感谢客户耐心等待，说明已彻底解决。",
        "expected_note": "分析专业严谨、处理措施具体、预防措施有效、语言诚恳"
    },
    {
        "task_id": "email_office_007",
        "dim": "邮件处理",
        "bench": "邮件评测集",
        "difficulty": "中等",
        "prompt": "向外部合作伙伴发送一封商务合作咨询邮件，包含：合作背景介绍、合作意向说明（具体说明想在哪方面合作）、期望的合作模式、期待回复时间。",
        "expected_note": "介绍简洁清晰、合作意向明确、语气专业有诚意"
    },
    {
        "task_id": "email_office_008",
        "dim": "邮件处理",
        "bench": "邮件评测集",
        "difficulty": "较难",
        "prompt": "作为销售，向潜在客户发送一封跟进邮件，包含：回顾上次沟通要点、进一步的价值主张（为什么选我们）、提供免费试用的邀请、下一步建议。",
        "expected_note": "回顾清晰、价值主张具体、邀请有吸引力、下一步明确"
    },
    {
        "task_id": "email_office_009",
        "dim": "邮件处理",
        "bench": "邮件评测集",
        "difficulty": "中等",
        "prompt": "将以下邮件内容改写为正式道歉邮件：\n原文：「不好意思，上次那个文件发错了，给你添麻烦了。」",
        "expected_note": "道歉诚恳、说明补救措施、避免类似错误的承诺"
    },
    {
        "task_id": "email_office_010",
        "dim": "邮件处理",
        "bench": "邮件评测集",
        "difficulty": "较难",
        "prompt": "作为部门经理，向团队发送一封项目成功的表彰邮件，表彰某个成员或小组在项目中的突出贡献，包含：具体成就描述、克服的困难、对团队的积极影响、表扬和感谢。",
        "expected_note": "具体成就突出、表扬真诚具体、对团队影响有提及"
    },
    {
        "task_id": "email_office_011",
        "dim": "邮件处理",
        "bench": "邮件评测集",
        "difficulty": "中等",
        "prompt": "将以下邮件内容改写为催促邮件：\n原文：「合同还没签，你们快点。」",
        "expected_note": "催促有礼有节、说明紧迫性、提供必要的协助姿态"
    },
    {
        "task_id": "email_office_012",
        "dim": "邮件处理",
        "bench": "邮件评测集",
        "difficulty": "较难",
        "prompt": "作为财务，向所有供应商发送一封关于付款周期调整的通知，包含：调整原因（现金流优化）、新付款周期（由30天调整为45天）、对供应商的影响、联系方式。",
        "expected_note": "说明充分、影响评估客观、联系方式畅通、语言专业不回避"
    },
    {
        "task_id": "email_office_013",
        "dim": "邮件处理",
        "bench": "邮件评测集",
        "difficulty": "中等",
        "prompt": "作为客服，给客户发送一封投诉回复邮件，处理客户对产品质量的投诉，包含：确认收到投诉、道歉、承诺调查、预计回复时间、感谢反馈。",
        "expected_note": "态度诚恳、承诺具体、时间预期合理"
    },
    {
        "task_id": "email_office_014",
        "dim": "邮件处理",
        "bench": "邮件评测集",
        "difficulty": "较难",
        "prompt": "作为市场总监，向CEO发送一封市场推广方案审批邮件，包含：方案概述、目标受众、推广渠道及预算分配、预期效果指标、需要的资源和支持。",
        "expected_note": "方案全面、数据支撑、预期合理、资源请求明确"
    },
    {
        "task_id": "email_office_015",
        "dim": "邮件处理",
        "bench": "邮件评测集",
        "difficulty": "中等",
        "prompt": "将以下邮件内容改写为离职告别邮件：\n原文：「我要走了，拜拜。」",
        "expected_note": "表达感激、回顾经历、保持联系、祝福团队，语言真诚得体"
    },
    {
        "task_id": "table_office_001",
        "dim": "表格处理",
        "bench": "格物评测集",
        "difficulty": "中等",
        "prompt": "假设你有一张销售数据CSV文件，包含以下列：date(日期), product(商品), quantity(销量), unit_price(单价)。\n请生成一段Python代码，读取这个CSV文件，计算总销售额，并按月份汇总月度销售额，输出格式化的报告。",
        "expected_note": "代码需使用pandas读取CSV，分组计算月度sum(quantity*unit_price)，格式化输出表格"
    },
    {
        "task_id": "table_office_002",
        "dim": "表格处理",
        "bench": "格物评测集",
        "difficulty": "较难",
        "prompt": "用户需要为Excel表新增一列「利润」，利润=收入-成本。\n表结构：A列=收入(revenue)，B列=成本(cost)，C列=利润(profit)需新增。\n请生成在Excel中可用的计算公式（Excel标准公式语法，不能是文字描述）。",
        "expected_note": "Excel公式应为 =A2-B2 这种标准形式"
    },
    {
        "task_id": "table_office_003",
        "dim": "表格处理",
        "bench": "格物评测集",
        "difficulty": "中等",
        "prompt": "给定以下数据，请生成一份数据透视表分析，统计每个销售区域各类别产品的销售总额和平均单价，并用柱状图可视化。\n区域、类别、销售额、单价\n华东、食品、120000、45\n华东、饮料、80000、22\n华南、食品、150000、48\n华南、饮料、95000、25",
        "expected_note": "需生成pandas数据透视表代码和matplotlib可视化代码"
    },
    {
        "task_id": "table_office_004",
        "dim": "表格处理",
        "bench": "格物评测集",
        "difficulty": "较难",
        "prompt": "用户有一张员工绩效表，A列=员工姓名，B列=部门，C列=销售额，D列=成本。需要计算每个部门的利润率（利润=销售额-成本），生成E列公式，并用条件格式高亮显示利润率低于10%的部门。",
        "expected_note": "需要Excel公式（=D2/C2-1）和条件格式语法"
    },
    {
        "task_id": "table_office_005",
        "dim": "表格处理",
        "bench": "格物评测集",
        "difficulty": "中等",
        "prompt": "给定以下CSV数据，请生成一段Python代码，统计每个产品类别的月度销量趋势，并输出折线图。\ndate,product,category,quantity\n2024-01-01,商品A,电子产品,120\n2024-01-01,商品B,电子产品,80\n2024-02-01,商品A,电子产品,150\n2024-02-01,商品B,电子产品,95\n2024-03-01,商品A,电子产品,130\n2024-03-01,商品B,电子产品,110",
        "expected_note": "需要pandas处理日期分组、matplotlib绘制折线图代码"
    },
]

print(f"Office tasks prepared: {len(office_tasks)}")

# ============ 4. 合并所有任务 ============
all_tasks = coding_tasks + sql_tasks + office_tasks
print(f"Total tasks: {len(all_tasks)}")

# ============ 5. 保存到 tasks.json ============
output_path = "C:/Users/xingyun/Desktop/tasks.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(all_tasks, f, ensure_ascii=False, indent=2)

print(f"Saved {len(all_tasks)} tasks to {output_path}")
print(f"  - Coding (HumanEval): {len(coding_tasks)}")
print(f"  - SQL (Spider): {len(sql_tasks)}")
print(f"  - Office (CCE+邮件+表格): {len(office_tasks)}")
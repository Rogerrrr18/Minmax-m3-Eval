"""
从已有数据集构建缺失维度题目
"""
import json, random

random.seed(42)

# 1. 从BigCodeBench构造错误修复题目
print('=== Building BugFix ===')
with open('bigcodebench_300.json', 'r', encoding='utf-8') as f:
    bigcode = json.load(f)

bugfix_items = []
for i, item in enumerate(bigcode):
    code = item.get('expected_note', '')
    if len(code) < 100 or 'def ' not in code:
        continue
    # 构造常见bug版本
    buggy = code
    # 多种bug模式
    if 'return ' in buggy:
        buggy = buggy.replace('return True', 'return False', 1)
    elif '==' in buggy:
        buggy = buggy.replace('==', '!=', 1)
    elif '+=' in buggy:
        buggy = buggy.replace('+=', '-=', 1)
    elif '>' in buggy:
        buggy = buggy.replace('>', '<', 1)
    elif 'and' in buggy:
        buggy = buggy.replace('and', 'or', 1)
    elif 'max(' in buggy:
        buggy = buggy.replace('max(', 'min(', 1)
    elif 'min(' in buggy:
        buggy = buggy.replace('min(', 'max(', 1)
    else:
        continue

    if buggy != code:
        bugfix_items.append({
            'task_id': f'BugFix_{i}',
            'dim': '错误修复',
            'bench': 'BigCodeBench-BugFix',
            'difficulty': '中等',
            'prompt': f'以下Python代码有bug，请找出并修复（保持原有功能不变）：\n```python\n{buggy}\n```',
            'expected_note': code
        })
    if len(bugfix_items) >= 50:
        break

with open('bugfix_50.json', 'w', encoding='utf-8') as f:
    json.dump(bugfix_items, f, ensure_ascii=False, indent=2)
print(f'  BugFix: {len(bugfix_items)} items')

# 2. 从BigCodeBench构造代码优化题目
print('=== Building Optimize ===')
opt_items = []
for i, item in enumerate(bigcode):
    code = item.get('expected_note', '')
    if len(code) < 100 or 'for ' not in code:
        continue
    # 构造低效版本
    slow = code
    if 'set(' in slow:
        slow = slow.replace('set(', 'list(', 1)
    elif 'dict(' in slow:
        slow = slow.replace('dict()', '{}')
    elif '.get(' in slow:
        slow = slow.replace('.get(', '[', 1).replace(',', ']', 1)
    else:
        continue

    if slow != code:
        opt_items.append({
            'task_id': f'Optimize_{i}',
            'dim': '代码优化',
            'bench': 'BigCodeBench-Opt',
            'difficulty': '较难',
            'prompt': f'请优化以下Python代码，提高时间或空间复杂度（保持功能不变）：\n```python\n{slow}\n```',
            'expected_note': code
        })
    if len(opt_items) >= 50:
        break

with open('optimize_50.json', 'w', encoding='utf-8') as f:
    json.dump(opt_items, f, ensure_ascii=False, indent=2)
print(f'  Optimize: {len(opt_items)} items')

# 3. 扩充NER题目
print('=== Building NER ===')
ner_items = []
ner_texts = [
    ('阿里巴巴创始人马云于1964年9月10日出生在浙江杭州，1999年创立了阿里巴巴集团。', '马云:人名, 1964年9月10日:时间, 浙江杭州:地点, 1999年:时间, 阿里巴巴集团:组织'),
    ('华为技术有限公司创始人任正非1944年10月25日出生于贵州省安顺市镇宁县，1987年在深圳创立华为。', '任正非:人名, 1944年10月25日:时间, 贵州省安顺市镇宁县:地点, 1987年:时间, 深圳:地点, 华为:组织'),
    ('字节跳动CEO张一鸣1983年出生于福建省龙岩市永定区，2012年在北京中关村创立了字节跳动。', '张一鸣:人名, 1983年:时间, 福建省龙岩市永定区:地点, 2012年:时间, 北京中关村:地点, 字节跳动:组织'),
    ('小米集团创始人雷军1969年12月16日出生于湖北仙桃，2010年4月6日在北京创立了小米公司。', '雷军:人名, 1969年12月16日:时间, 湖北仙桃:地点, 2010年4月6日:时间, 北京:地点, 小米公司:组织'),
    ('美团创始人王兴1979年2月18日出生于福建龙岩，2010年3月4日创立了美团网。', '王兴:人名, 1979年2月18日:时间, 福建龙岩:地点, 2010年3月4日:时间, 美团网:组织'),
    ('京东创始人刘强东1974年2月14日出生于江苏宿迁，1998年6月18日在北京中关村创立了京东公司。', '刘强东:人名, 1974年2月14日:时间, 江苏宿迁:地点, 1998年6月18日:时间, 北京中关村:地点, 京东公司:组织'),
    ('拼多多创始人黄峥1980年出生于浙江杭州，2015年9月在上海创立了拼多多。', '黄峥:人名, 1980年:时间, 浙江杭州:地点, 2015年9月:时间, 上海:地点, 拼多多:组织'),
    ('百度创始人李彦宏1968年11月17日出生于山西阳泉，2000年1月1日在中关村创立了百度。', '李彦宏:人名, 1968年11月17日:时间, 山西阳泉:地点, 2000年1月1日:时间, 中关村:地点, 百度:组织'),
    ('蔚来汽车创始人李斌1974年6月22日出生于安徽安庆，2014年11月在上海创立了蔚来汽车。', '李斌:人名, 1974年6月22日:时间, 安徽安庆:地点, 2014年11月:时间, 上海:地点, 蔚来汽车:组织'),
    ('比亚迪创始人王传福1966年2月15日出生于安徽芜湖，1995年在深圳创立了比亚迪。', '王传福:人名, 1966年2月15日:时间, 安徽芜湖:地点, 1995年:时间, 深圳:地点, 比亚迪:组织'),
    ('理想汽车创始人李想1981年10月5日出生于河北石家庄，2015年7月在北京创立了理想汽车。', '李想:人名, 1981年10月5日:时间, 河北石家庄:地点, 2015年7月:时间, 北京:地点, 理想汽车:组织'),
    ('小鹏汽车创始人何小鹏1977年出生于湖北黄石，2014年在广州创立了小鹏汽车。', '何小鹏:人名, 1977年:时间, 湖北黄石:地点, 2014年:时间, 广州:地点, 小鹏汽车:组织'),
    ('大疆创新创始人汪滔1980年出生于浙江杭州，2006年在深圳创立了大疆。', '汪滔:人名, 1980年:时间, 浙江杭州:地点, 2006年:时间, 深圳:地点, 大疆:组织'),
    ('携程创始人梁建章1969年出生于上海，1999年在上海创立了携程旅行网。', '梁建章:人名, 1969年:时间, 上海:地点, 1999年:时间, 携程旅行网:组织'),
    ('网易创始人丁磊1971年10月1日出生于浙江宁波，1997年6月在广州创立了网易。', '丁磊:人名, 1971年10月1日:时间, 浙江宁波:地点, 1997年6月:时间, 广州:地点, 网易:组织'),
]

for i, (text, entities) in enumerate(ner_texts):
    ner_items.append({
        'task_id': f'NER_{i}',
        'dim': '信息抽取',
        'bench': '自建-NER',
        'difficulty': '中等',
        'prompt': f'从以下文本中抽取所有命名实体（人名、组织名、地点、时间、产品名等），按格式"实体:类型"输出：\n{text}',
        'expected_note': entities
    })

with open('ner_50.json', 'w', encoding='utf-8') as f:
    json.dump(ner_items, f, ensure_ascii=False, indent=2)
print(f'  NER: {len(ner_items)} items')

print('All missing dimensions built!')

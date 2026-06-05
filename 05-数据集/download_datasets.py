"""
12维度官方基准数据集下载脚本
尝试从多个源下载，失败则跳过
"""
import urllib.request, os, json, ssl, sys

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE = os.path.dirname(os.path.abspath(__file__))

def download(url, out_name, timeout=60):
    out_path = os.path.join(BASE, out_name)
    if os.path.exists(out_path) and os.path.getsize(out_path) > 100:
        print(f"  [SKIP] {out_name} already exists ({os.path.getsize(out_path)} bytes)")
        return True
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx, timeout=timeout) as resp:
            data = resp.read()
            with open(out_path, 'wb') as f:
                f.write(data)
        print(f"  [OK] {out_name}: {len(data)} bytes")
        return True
    except Exception as e:
        print(f"  [FAIL] {out_name}: {str(e)[:80]}")
        return False

results = {}

print("="*60)
print("开始下载12维度官方基准数据集")
print("="*60)

# 1. MBPP (代码生成补充)
print("\n[1/8] MBPP (代码生成)...")
results['mbpp'] = download(
    'https://huggingface.co/datasets/mbpp/resolve/main/mbpp.jsonl',
    'mbpp.jsonl',
    timeout=120
)

# 2. Spider dev (SQL查询)
print("\n[2/8] Spider dev (SQL查询)...")
results['spider_dev'] = download(
    'https://raw.githubusercontent.com/taoyds/spider/master/dev.json',
    'spider_dev.json',
    timeout=60
)

# 3. Spider train
print("\n[3/8] Spider train (SQL查询)...")
results['spider_train'] = download(
    'https://raw.githubusercontent.com/taoyds/spider/master/train_spider.json',
    'spider_train.json',
    timeout=60
)

# 4. Spider tables.json (schema)
print("\n[4/8] Spider tables.json...")
results['spider_tables'] = download(
    'https://raw.githubusercontent.com/taoyds/spider/master/tables.json',
    'spider_tables.json',
    timeout=60
)

# 5. BigCodeBench (代码生成/错误修复/优化)
print("\n[5/8] BigCodeBench test...")
results['bigcodebench'] = download(
    'https://huggingface.co/datasets/bigcode/bigcodebench/resolve/main/bigcodebench.jsonl',
    'bigcodebench.jsonl',
    timeout=180
)

# 6. LiveCodeBench (算法)
print("\n[6/8] LiveCodeBench...")
results['livecodebench'] = download(
    'https://huggingface.co/datasets/livecodebench/code_generation_lite/resolve/main/test.json',
    'livecodebench_test.json',
    timeout=180
)

# 7. XGLUE (多语言)
print("\n[7/8] XGLUE PAWS-X (多语言)...")
results['xglue'] = download(
    'https://huggingface.co/datasets/google/xtreme/resolve/main/paws-x.json',
    'paws-x.json',
    timeout=120
)

# 8. C-Eval (中文综合评测，含写作)
print("\n[8/8] C-Eval sample...")
results['ceval'] = download(
    'https://huggingface.co/datasets/ceval/ceval-exam/resolve/main/ceval-exam.json',
    'ceval-exam.json',
    timeout=120
)

print("\n" + "="*60)
print("下载结果汇总:")
print("="*60)
for name, ok in results.items():
    status = "✅ 成功" if ok else "❌ 失败"
    print(f"  {status} {name}")

# 统计下载成功的文件
print("\n下载成功的文件:")
for f in os.listdir(BASE):
    if f.endswith(('.json', '.jsonl', '.zip')):
        size = os.path.getsize(os.path.join(BASE, f))
        print(f"  {f}: {size:,} bytes")

"""
MiniMax-m3 科学评测脚本 v2.0
GPT-5.5 独立裁判 · 多模型横向对比 · Coding × Office

用法: python eval_scientific.py
"""

import os
import sys
import json
import time
import random
import string
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI

# ============ 全局配置 ============
DESKTOP = "C:/Users/xingyun/Desktop"

JUDGE_MODEL = "gpt-5.5"
JUDGE_URL = "http://www.opcrouter.online/v1"
JUDGE_KEY = "sk-fPpoLMFQf6LZ7NEWsZo4zcpZLwgbcbmaPvMYtqHtKudHNlyV"

MODELS = [
    {
        "name": "MiniMax-m3",
        "url": "https://api.minimax.chat/v1",
        "key": "sk-cp-vTwAJBlIrVtvC0xZ8nhoiAvQTyR2ESKhPtvmmBQ7gZfRMDMWcfQDVS9iWdUwy-ZffnMeOH9kOcB44LKPaiOAlaCL35kclaHcOfUynpt-ONgR_glmXL3Tdio",
        "id": "MiniMax-m3"
    },
    {
        "name": "deepseek-v4-flash",
        "url": "http://www.opcrouter.online/v1",
        "key": "sk-1VV3vI8HgxR3kYYRI8byG1dD1QSqVwHmXdfqyiDkjsvaajZB",
        "id": "deepseek-v4-flash"
    },
    {
        "name": "mimo-v2.5-pro",
        "url": "http://www.opcrouter.online/v1",
        "key": "sk-9CNkcxVPX4QFpDQ2T89nTecMzlx2jSTHOWjIMw7K01zmIjsF",
        "id": "mimo-v2.5-pro"
    },
    {
        "name": "kimi-k2.6",
        "url": "http://www.opcrouter.online/v1",
        "key": "sk-1VV3vI8HgxR3kYYRI8byG1dD1QSqVwHmXdfqyiDkjsvaajZB",
        "id": "kimi-k2.6"
    },
]

SYSTEM_PROMPTS = {
    "代码生成": "你是一位专业的Python程序员。请根据题目要求生成Python代码，直接输出代码，不要解释。",
    "SQL查询": "你是一位专业的数据库工程师。请根据题目要求生成SQL语句，直接输出SQL，不要解释。",
    "错误修复": "你是一位专业的Python程序员。请分析以下代码的bug并修复，直接输出修复后的完整代码，不要解释。",
    "文档撰写": "你是一位专业的企业办公助手，擅长撰写正式规范的办公文档。请根据题目要求生成文档内容，直接输出文档内容，不要解释你是AI。",
    "邮件处理": "你是一位专业的企业办公助手，擅长处理邮件相关任务（撰写、摘要、改写等）。请根据题目要求完成任务，直接输出结果，不要解释。",
    "表格处理": "你是一位专业的Excel和数据分析专家。请根据题目要求生成Excel公式、Python代码或数据分析报告，直接输出内容，不要解释。",
}

# MiniMax-m3 特殊 system prompt（抑制 think 标签，要求直接输出）
MINIMAX_SYSTEM_PROMPTS = {
    "代码生成": "你是一位专业的Python程序员。请根据题目要求直接生成Python代码。注意：不要输出任何思考过程、解释或<think>标签，直接输出最终代码。",
    "SQL查询": "你是一位专业的数据库工程师。请根据题目要求直接生成SQL语句。注意：不要输出任何思考过程、解释或<think>标签，直接输出最终SQL。",
    "错误修复": "你是一位专业的Python程序员。请分析代码bug并直接输出修复后的完整代码。注意：不要输出任何思考过程、解释或<think>标签，直接输出最终代码。",
    "文档撰写": "你是一位专业的企业办公助手。请根据题目要求直接生成文档内容。注意：不要输出任何思考过程或<think>标签，直接输出最终文档。",
    "邮件处理": "你是一位专业的企业办公助手。请根据题目要求直接完成任务。注意：不要输出任何思考过程或<think>标签，直接输出最终结果。",
    "表格处理": "你是一位专业的Excel和数据分析专家。请根据题目要求直接生成内容。注意：不要输出任何思考过程或<think>标签，直接输出最终结果。",
}

JUDGE_SYSTEM_PROMPT = """【角色】你是一位严格、公正的AI模型评测员。你的任务是对多个AI模型在相同任务上的输出进行评分。
【原则】你不知道哪个输出对应哪个模型，只能根据质量打分。对所有模型一视同仁，严格按照标准评判。
【输出格式】你必须严格按以下JSON格式输出，不要有任何多余内容：
{
  "task_id": "题目ID",
  "model_A_score": 0或1或2,
  "model_B_score": 0或1或2,
  "model_C_score": 0或1或2,
  "model_D_score": 0或1或2,
  "reasoning": "简短评分理由（50字以内）"
}
【评分标准】
- Coding类题目（代码生成/SQL/错误修复）：0=代码无法运行/结果错误，1=代码可运行但效率或风格有问题，2=代码完全正确且高效
- Office类题目（文档/表格/邮件）：0=完全不满足要求，1=基本满足但有改进空间，2=完全满足要求
【注意】每个task_id对应一个题目，你需要输出4个模型的分数。如果某个模型输出为空或明显作弊，给0分。"""

# ============ API 调用函数 ============
def call_model(model_cfg, prompt, system_prompt=None, temperature=0, max_tokens=1024):
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    try:
        client = OpenAI(api_key=model_cfg["key"], base_url=model_cfg["url"], timeout=60)
        response = client.chat.completions.create(
            model=model_cfg["id"],
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content, "success"
    except Exception as e:
        return f"[API Error] {str(e)}", "error"

def extract_code_from_think(output):
    """如果输出包含 <think> 标签，尝试提取其中的代码块"""
    if "<think>" in output and "</think>" in output:
        after_think = output.split("</think>")[-1].strip()
        if after_think:
            return after_think
    return output

def batch_call_single_model(model_cfg, tasks):
    """并行调用单个模型处理一批任务"""
    results = {}
    is_minimax = model_cfg["name"] == "MiniMax-m3"
    for task in tasks:
        dim = task.get("dim", "代码生成")
        # MiniMax-m3 使用特殊 system prompt 和更大 max_tokens
        if is_minimax:
            system_prompt = MINIMAX_SYSTEM_PROMPTS.get(dim, MINIMAX_SYSTEM_PROMPTS["代码生成"])
            max_tok = 2048
        else:
            system_prompt = SYSTEM_PROMPTS.get(dim, SYSTEM_PROMPTS["代码生成"])
            max_tok = 1024
        output, status = call_model(model_cfg, task["prompt"], system_prompt, max_tokens=max_tok)
        # 后处理：提取 think 后的代码
        if is_minimax:
            output = extract_code_from_think(output)
        results[task["task_id"]] = {
            "output": output,
            "status": status,
            "dim": dim
        }
        print(f"  [{model_cfg['name']}] {task['task_id']} -> {status}")
        time.sleep(0.3)
    return model_cfg["name"], results

# ============ GPT-5.5 裁判评分 ============
def extract_json_from_response(text):
    """从裁判响应中提取JSON"""
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
    except:
        pass
    return None

def call_judge_blind_evaluate(all_outputs_per_task, tasks, model_names):
    """
    GPT-5.5 批量盲评。
    all_outputs_per_task: { task_id: { model_name: output } }
    """
    judge_client = OpenAI(api_key=JUDGE_KEY, base_url=JUDGE_URL, timeout=60)
    judgments = {}

    for task in tasks:
        task_id = task["task_id"]
        outputs = all_outputs_per_task.get(task_id, {})

        # 构建盲评 prompt，输出顺序随机打乱
        model_names_shuffled = model_names[:]
        random.shuffle(model_names_shuffled)

        user_prompt = f"""【评分任务】请对以下{len(MODELS)}个AI模型在同一个任务上的输出进行评分。

【题目ID】{task_id}
【任务类型】{task.get("dim", "未知")}（{task.get("bench", "")}，{task.get("difficulty", "")}）
【题目内容】
{task['prompt']}
"""

        for i, mn in enumerate(model_names_shuffled):
            output_text = outputs.get(mn, {}).get("output", "(无输出)")
            # 截断过长输出，避免 token 爆表
            if len(output_text) > 800:
                output_text = output_text[:800] + "\n... (截断) ..."
            user_prompt += f"\n\n【模型{chr(65+i)}（{mn}）输出】\n{output_text}"

        user_prompt += "\n\n请严格按JSON格式输出评分结果，不要有任何其他内容。"

        try:
            resp = judge_client.chat.completions.create(
                model=JUDGE_MODEL,
                messages=[
                    {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0,
                max_tokens=512
            )
            raw = resp.choices[0].message.content
            result = extract_json_from_response(raw)

            if result:
                # 将打乱顺序的分数映射回原始模型
                for i, mn in enumerate(model_names_shuffled):
                    score_key = f"model_{chr(65+i)}_score"
                    if score_key in result:
                        if mn not in judgments:
                            judgments[mn] = {}
                        judgments[mn][task_id] = result[score_key]
                judgments["_reasoning"] = judgments.get("_reasoning", {})
                judgments["_reasoning"][task_id] = result.get("reasoning", "")
            else:
                print(f"  [Judge] Failed to parse JSON for {task_id}: {raw[:100]}")
        except Exception as e:
            print(f"  [Judge] Error for {task_id}: {e}")

        time.sleep(0.5)

    return judgments

# ============ 主流程 ============
def run_scientific_eval():
    print("=" * 60)
    print("MiniMax-m3 科学评测 v2.0")
    print("GPT-5.5 独立裁判 · 多模型横向对比")
    print("=" * 60)

    # Step 1: 加载任务集
    print("\n[Step 1] 加载任务集...")
    tasks_path = os.path.join(DESKTOP, "tasks.json")
    with open(tasks_path, "r", encoding="utf-8") as f:
        tasks = json.load(f)
    print(f"  共加载 {len(tasks)} 个任务")
    model_names = [m["name"] for m in MODELS]
    print(f"  参评模型: {model_names}")

    # Step 2: 并行调用所有模型
    print("\n[Step 2] 并行调用所有模型...")
    all_outputs = {}  # task_id -> { model_name -> {output, status, dim} }

    with ThreadPoolExecutor(max_workers=len(MODELS)) as executor:
        futures = {}
        for model in MODELS:
            future = executor.submit(batch_call_single_model, model, tasks)
            futures[future] = model["name"]

        for future in as_completed(futures):
            model_name = futures[future]
            name, outputs = future.result()
            for task_id, result in outputs.items():
                if task_id not in all_outputs:
                    all_outputs[task_id] = {}
                all_outputs[task_id][model_name] = result
            print(f"  {model_name} 完成")

    # Step 3: 保存原始输出
    print("\n[Step 3] 保存原始输出...")
    raw_output_path = os.path.join(DESKTOP, "raw_outputs.json")
    with open(raw_output_path, "w", encoding="utf-8") as f:
        json.dump(all_outputs, f, ensure_ascii=False, indent=2)
    print(f"  已保存到 {raw_output_path}")

    # Step 4: GPT-5.5 盲评
    print("\n[Step 4] GPT-5.5 盲评...")
    judgments = call_judge_blind_evaluate(all_outputs, tasks, model_names)

    judge_output_path = os.path.join(DESKTOP, "judgments.json")
    with open(judge_output_path, "w", encoding="utf-8") as f:
        json.dump(judgments, f, ensure_ascii=False, indent=2)
    print(f"  已保存到 {judge_output_path}")

    # Step 5: 计算各模型各维度得分
    print("\n[Step 5] 计算评分...")

    # 按维度分组
    dim_tasks = {}
    for task in tasks:
        dim = task.get("dim", "其他")
        if dim not in dim_tasks:
            dim_tasks[dim] = []
        dim_tasks[dim].append(task["task_id"])

    # 计算每个模型、每个维度的平均分
    report = {}
    for model in model_names:
        report[model] = {}
        model_scores = judgments.get(model, {})
        for dim, task_ids in dim_tasks.items():
            scores = [model_scores.get(tid, 0) for tid in task_ids]
            avg = sum(scores) / len(scores) if scores else 0
            report[model][dim] = {
                "avg": round(avg, 2),
                "scores": scores,
                "count": len(scores)
            }
        # Overall avg
        all_scores = [s for dim_data in report[model].values() for s in dim_data["scores"]]
        report[model]["_overall"] = round(sum(all_scores) / len(all_scores), 2) if all_scores else 0
        report[model]["_total"] = len(all_scores)

    # 保存报告
    report_path = os.path.join(DESKTOP, "eval_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"  已保存到 {report_path}")

    # Step 6: 打印摘要
    print("\n" + "=" * 60)
    print("评测结果摘要")
    print("=" * 60)
    dims = ["代码生成", "SQL查询", "文档撰写", "邮件处理", "表格处理"]
    header = f"{'模型':<20}" + "".join([f"{d:<12}" for d in dims]) + f"{'综合':<8}"
    print(header)
    print("-" * len(header))
    for model in model_names:
        row = f"{model:<20}"
        dim_avgs = []
        for dim in dims:
            if dim in report[model]:
                row += f"{report[model][dim]['avg']:<12.2f}"
                dim_avgs.append(report[model][dim]["avg"])
            else:
                row += f"{'N/A':<12}"
        row += f"{report[model]['_overall']:<8.2f}"
        print(row)

    print(f"\n✅ 评测完成！报告已保存到: {report_path}")
    print(f"   原始输出: {raw_output_path}")
    print(f"   裁判评分: {judge_output_path}")

    return report, judgments

if __name__ == "__main__":
    report, judgments = run_scientific_eval()
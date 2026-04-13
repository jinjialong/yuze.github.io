import os
import re
import json
import sys
from datetime import datetime
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import requests
from app.config import API_KEY, OPENAI_BASE_URL, MODEL_GOOD, MODEL_CHEAP, API_TIMEOUT


def clean_web_text(raw_text: str) -> str:
    """文本清洗器：剔除所有无用的 HTML/CSS/JS 代码垃圾"""
    text = re.sub(r'<script.*?>.*?</script>', '', raw_text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style.*?>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<svg.*?>.*?</svg>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def call_api(messages, model, temperature=0.1, max_tokens=2000):
    """统一 API 调用函数"""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens
    }

    api_url = f"{OPENAI_BASE_URL}/v1/chat/completions" if OPENAI_BASE_URL else "https://api.openai.com/v1/chat/completions"

    response = requests.post(api_url, headers=headers, json=payload, timeout=API_TIMEOUT)
    response.raise_for_status()

    return response.json()['choices'][0]['message']['content']


def generate_report(vision_data: dict, raw_text: str, audit_feedback: str = "", history: list = None) -> dict:
    """
    数据清洗 + 报告生成

    返回 JSON 格式:
    {
        "status": "success|failed",
        "step": "generate",
        "timestamp": "2026-04-13T14:30:22",
        "data": {
            "report_content": "# Markdown 内容...",
            "report_summary": "...",
            "confidence": "high"
        },
        "error": null,
        "error_message": ""
    }
    """
    timestamp = datetime.now().isoformat()
    result = {
        "status": "success",
        "step": "generate",
        "timestamp": timestamp,
        "data": {},
        "error": None,
        "error_message": ""
    }

    try:
        # 数据清洗
        web_text = clean_web_text(raw_text)
        print(f" 数据清洗对比：清洗前 {len(raw_text)} 字符 -> 清洗后 {len(web_text)} 字符")

        # Model Routing: 使用便宜模型预摘要
        print(" [Model Routing] 使用低成本模型压缩文本...")
        condense_prompt = f"""请将以下网页文本压缩为500字以内的结构化摘要，保留：产品名称、核心功能、定价信息、目标用户、竞争优势。

【原始文本】：
{web_text[:15000]}"""

        condensed_text = call_api(
            messages=[{"role": "user", "content": condense_prompt}],
            model=MODEL_CHEAP,
            temperature=0,
            max_tokens=1000
        )

        print(f" 摘要完成：{len(web_text)} 字符 → {len(condensed_text)} 字符")

        # 构造报告生成 Prompt
        correction_instruction = ""
        if audit_feedback:
            correction_instruction = f"""
            【重要：请修正以下审计发现的错误】：
            {audit_feedback}

            请在本次重写中务必严格修改，特别是将"待核实"改为确定的事实，补齐缺失的数据。
            """

        # 构建历史上下文（用于多次迭代）
        history_context = ""
        if history:
            history_context = "\n\n【历史版本记录】：\n"
            for i, h in enumerate(history, 1):
                history_context += f"\n--- 第{i}次尝试 ---\n"
                if h.get('report_summary'):
                    history_context += f"报告摘要：{h['report_summary'][:500]}...\n"
                if h.get('review_issues'):
                    history_context += f"审核问题：{', '.join(h['review_issues'])}\n"
                if h.get('review_suggestions'):
                    history_context += f"修改建议：{h['review_suggestions'][:500]}...\n"

        prompt = f"""
你是一个有经验的 AI 产品经理。请结合【网页截图的视觉分析】和【网页核心摘要】，出一份深度竞品分析报告。
{correction_instruction}{history_context}

报告要求：
1. 使用 Markdown 格式
2. 包含以下章节：
   - ## 1. 产品概述
   - ## 2. 核心功能
   - ## 3. 目标用户
   - ## 4. 产品定位
   - ## 5. 定价策略
   - ## 6. UI/UX 亮点
   - ## 7. 竞争优势
   - ## 8. 总结与建议
3. 交叉验证：图文不一致时，以文本数据（如价格）为准
4. 严禁幻觉：所有结论必须在文本或视觉分析中有据可查

【视觉分析结果】：
{json.dumps(vision_data, ensure_ascii=False, indent=2)}

【网页核心摘要】：
{condensed_text}

请直接输出 Markdown 格式的报告内容。
"""

        print(" 正在生成报告...")
        report_content = call_api(
            messages=[{"role": "user", "content": prompt}],
            model=MODEL_GOOD,
            temperature=0.1,
            max_tokens=4000
        )

        result["data"] = {
            "report_content": report_content,
            "report_summary": report_content[:200] + "..." if len(report_content) > 200 else report_content,
            "confidence": "high"
        }

        print(" 报告生成完成")

    except Exception as e:
        result["status"] = "failed"
        result["error"] = type(e).__name__
        result["error_message"] = f"报告生成失败: {str(e)}"
        print(f" Report generation failed: {e}")

    return result


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("用法: python final_report_agent.py <vision_json文件> <text文件> [audit_feedback]")
        print("示例: python final_report_agent.py vision_result.json web_text.txt")
        sys.exit(1)

    vision_file = sys.argv[1]
    text_file = sys.argv[2]
    audit_feedback = sys.argv[3] if len(sys.argv) > 3 else ""

    print(f"\n正在测试报告生成 Agent...")
    print(f"视觉分析文件: {vision_file}")
    print(f"网页文本文件: {text_file}")
    if audit_feedback:
        print(f"审计反馈: {audit_feedback}")
    print()

    # 读取文件
    with open(vision_file, 'r', encoding='utf-8') as f:
        vision_data = json.load(f)

    with open(text_file, 'r', encoding='utf-8') as f:
        raw_text = f.read()

    result = generate_report(vision_data, raw_text, audit_feedback)

    print("\n" + "="*50)
    print("测试结果:")
    print("="*50)
    print(json.dumps(result, ensure_ascii=False, indent=2))

    # 保存报告到过程数据目录
    if result["status"] == "success":
        # 优先使用过程数据目录，否则保存到当前目录
        output_dir = Path(vision_file).parent if len(sys.argv) > 1 else Path(".")
        output_file = output_dir / "generated_report.md"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(result["data"]["report_content"])
        print(f"\n报告已保存到: {output_file}")

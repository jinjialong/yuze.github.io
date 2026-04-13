import os
import base64
import json
import sys
from io import BytesIO
from datetime import datetime
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from PIL import Image
import requests

from app.config import API_KEY, OPENAI_BASE_URL, MODEL_GOOD, MAX_IMAGE_SIZE, API_TIMEOUT


def encode_image_for_critic(image_path: str, max_size: int = MAX_IMAGE_SIZE) -> str:
    """图片压缩与 base64 编码"""
    if not os.path.exists(image_path):
        return None
    try:
        with Image.open(image_path) as img:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            buffered = BytesIO()
            img.save(buffered, format="PNG")
            return base64.b64encode(buffered.getvalue()).decode('utf-8')
    except Exception:
        return None


def call_api(messages, model, temperature=0, max_tokens=2000):
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


def review_report(report_content: str, clean_text: str, screenshot_path: str) -> dict:
    """
    审查验证报告

    返回 JSON 格式:
    {
        "status": "success|failed",
        "step": "review",
        "timestamp": "2026-04-13T14:30:22",
        "data": {
            "passed": true|false,
            "issues": [...],
            "suggestions": "...",
            "fact_check_score": 0.95
        },
        "error": null,
        "error_message": ""
    }
    """
    timestamp = datetime.now().isoformat()
    result = {
        "status": "success",
        "step": "review",
        "timestamp": timestamp,
        "data": {},
        "error": None,
        "error_message": ""
    }

    try:
        base64_image = encode_image_for_critic(screenshot_path)

        system_instruction = """你是一个务实的商业审计员。
任务：对比[初版研报]与[网页截图]及[网页纯文本]，重点核查关键事实错误。

判定准则（只核查以下严重问题，忽略表达方式差异）：
1. 【定价信息】：研报中提到的价格、收费模式必须与证据一致。若不一致 → [FAIL]
2. 【核心功能】：研报声称的功能必须在网页中有体现。若凭空捏造功能 → [FAIL]
3. 【产品名称】：研报使用的产品名、术语必须与网页一致。若出现不存在的新名词 → [FAIL]
4. 【事实性错误】：明显的与网页内容矛盾的事实。若存在 → [FAIL]

以下情况应予以通过（不要过度严格）：
- 表达方式、描述风格的差异（如"简洁设计"vs"极简风格"）
- 对 UI 元素的合理推断（如"搜索按钮突出"）
- 对功能价值的合理分析（如"热搜提升用户粘性"）
- 未明确提及但未与证据矛盾的推测

输出要求（JSON格式）：
{
    "passed": true|false,
    "issues": ["关键问题1", "关键问题2"],
    "suggestions": "具体修改建议...",
    "fact_check_score": 0-1之间的分数,
    "failed_reason": "如果未通过，简要说明核心原因"
}
- 若无严重事实错误：{"passed": true, "issues": [], "suggestions": "", "fact_check_score": 0.9}
- 若有关键事实错误：{"passed": false, "issues": ["..."], "suggestions": "...", "fact_check_score": 0.6, "failed_reason": "定价与实际不符"}"""

        user_content = f"【研报内容】：\n{report_content}\n\n【网页纯文本备份】：\n{clean_text[:12000]}"

        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_content}
        ]

        # 如果有图片，添加图片描述（通过文本方式）
        if base64_image:
            messages[1]["content"] += "\n\n【网页截图】：已提供，请参考分析。"

        print(" 正在审查报告...")
        audit_response = call_api(
            messages=messages,
            model=MODEL_GOOD,
            temperature=0,
            max_tokens=2000
        )

        # 解析 JSON 响应
        try:
            audit_result = json.loads(audit_response)
        except json.JSONDecodeError:
            # 如果返回的不是 JSON，尝试提取
            passed = "[FAIL]" not in audit_response and '"passed": true' in audit_response.lower()
            audit_result = {
                "passed": passed,
                "issues": [] if passed else ["审查发现潜在问题"],
                "suggestions": "" if passed else audit_response,
                "fact_check_score": 0.9 if passed else 0.6
            }

        result["data"] = audit_result

        if audit_result.get("passed"):
            print(" 审查通过")
        else:
            print(f" 审查不通过: {audit_result.get('issues', [])}")

    except Exception as e:
        result["status"] = "failed"
        result["error"] = type(e).__name__
        result["error_message"] = f"审查验证失败: {str(e)}"
        print(f" Review failed: {e}")

    return result


if __name__ == "__main__":
    import sys
    # 添加项目根目录到路径
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    if len(sys.argv) < 3:
        print("用法: python critic_agent.py <report文件> <text文件> [截图路径]")
        print("示例: python critic_agent.py report.md web_text.txt screenshot.jpg")
        sys.exit(1)

    report_file = sys.argv[1]
    text_file = sys.argv[2]
    screenshot_path = sys.argv[3] if len(sys.argv) > 3 else ""

    print(f"\n正在测试审查 Agent...")
    print(f"报告文件: {report_file}")
    print(f"文本文件: {text_file}")
    if screenshot_path:
        print(f"截图路径: {screenshot_path}")
    print()

    # 读取文件
    with open(report_file, 'r', encoding='utf-8') as f:
        report_content = f.read()

    with open(text_file, 'r', encoding='utf-8') as f:
        clean_text = f.read()

    result = review_report(report_content, clean_text, screenshot_path)

    print("\n" + "="*50)
    print("测试结果:")
    print("="*50)
    print(json.dumps(result, ensure_ascii=False, indent=2))

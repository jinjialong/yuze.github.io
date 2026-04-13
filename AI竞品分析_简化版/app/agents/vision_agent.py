import os
import re
import json
import base64
from io import BytesIO
from datetime import datetime
from pathlib import Path
from typing import List
from PIL import Image

from app.config import API_KEY, OPENAI_BASE_URL, MODEL_GOOD, MAX_IMAGE_SIZE, API_TIMEOUT


def encode_image(image_path: str, max_size: int = MAX_IMAGE_SIZE) -> str:
    """图片压缩与 base64 编码"""
    with Image.open(image_path) as img:
        width, height = img.size
        if width > max_size or height > max_size:
            print(f" 触发画幅保护：原图尺寸 {width}x{height}，正在强制压缩...")
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            print(f" 压缩完成，当前发送给 AI 的尺寸为：{img.width}x{img.height}")
        else:
            print(f" 图片尺寸安全 ({width}x{height})，直接处理。")

        buffered = BytesIO()
        img.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode('utf-8')


def analyze_screenshot(image_path: str) -> dict:
    """
    视觉识别分析

    返回 JSON 格式:
    {
        "status": "success|failed",
        "step": "vision",
        "timestamp": "2026-04-13T14:30:22",
        "data": {
            "core_features": [...],
            "ui_highlights": [...],
            "target_users": "...",
            "conversion_elements": [...],
            "product_positioning": "..."
        },
        "error": null,
        "error_message": ""
    }
    """
    timestamp = datetime.now().isoformat()
    result = {
        "status": "success",
        "step": "vision",
        "timestamp": timestamp,
        "data": {},
        "error": None,
        "error_message": ""
    }

    try:
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"找不到截图: {image_path}")

        file_size = os.path.getsize(image_path) / (1024 * 1024)
        print(f" 截图大小: {file_size:.2f} MB")

        base64_image = encode_image(image_path)

        # 使用 requests 直接调用 API
        import requests

        headers = {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": MODEL_GOOD,
            "messages": [
                {
                    "role": "system",
                    "content": "你是一个资深 AI 产品经理。请分析这张竞品截图，输出结构化的JSON数据。必须包含：core_features（核心功能列表，3-5条）、ui_highlights（UI亮点，2-4条）、target_users（目标用户一句话）、conversion_elements（转化元素，2-4条）、product_positioning（产品定位一句话）。只返回JSON格式。"
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "请分析这张竞品截图，输出结构化JSON数据。"},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{base64_image}"}}
                    ]
                }
            ],
            "temperature": 0.1,
            "max_tokens": 2000
        }

        api_url = f"{OPENAI_BASE_URL}/v1/chat/completions" if OPENAI_BASE_URL else "https://api.openai.com/v1/chat/completions"

        print(" 正在发送视觉分析请求...")
        response = requests.post(api_url, headers=headers, json=payload, timeout=API_TIMEOUT)
        response.raise_for_status()

        response_data = response.json()
        content = response_data['choices'][0]['message']['content']

        # 解析 JSON
        try:
            # 尝试直接解析
            result_json = json.loads(content)
        except json.JSONDecodeError:
            # 尝试提取 JSON 代码块
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', content)
            if json_match:
                result_json = json.loads(json_match.group(1).strip())
            else:
                # 尝试找花括号包裹的内容
                json_match = re.search(r'\{[\s\S]*\}', content)
                if json_match:
                    result_json = json.loads(json_match.group(0))
                else:
                    raise ValueError("无法解析 JSON 响应")

        result["data"] = result_json
        print(f" 视觉分析完成: {len(result_json.get('core_features', []))} 个核心功能")

    except Exception as e:
        result["status"] = "failed"
        result["error"] = type(e).__name__
        result["error_message"] = f"视觉识别失败: {str(e)}"
        print(f" Vision analysis failed: {e}")

    return result


if __name__ == "__main__":
    import sys
    from pathlib import Path
    from datetime import datetime

    if len(sys.argv) < 2:
        print("用法: python vision_agent.py <图片路径> [过程数据目录]")
        print("示例: python vision_agent.py ./data/process/baidu/20240101_120000/compressed.jpg")
        sys.exit(1)

    image_path = sys.argv[1]
    image_path = Path(image_path)

    # 如果提供了过程数据目录，使用它；否则从图片路径推断
    if len(sys.argv) > 2:
        process_dir = Path(sys.argv[2])
    else:
        # 使用图片所在目录作为过程数据目录
        process_dir = image_path.parent

    print(f"\n正在测试视觉识别 Agent...")
    print(f"图片路径: {image_path}")
    print(f"过程数据目录: {process_dir}\n")

    result = analyze_screenshot(str(image_path))

    # 保存结果到过程数据目录
    result_file = process_dir / "vision_result.json"
    with open(result_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print("\n" + "="*50)
    print("测试结果:")
    print("="*50)
    print(f"状态: {result['status']}")
    if result['status'] == 'success':
        print(f"核心功能: {len(result['data'].get('core_features', []))} 个")
        print(f"UI亮点: {len(result['data'].get('ui_highlights', []))} 个")
        print(f"产品定位: {result['data'].get('product_positioning', '')}")
    else:
        print(f"错误: {result['error_message']}")
    print(f"\n结果已保存到: {result_file}")

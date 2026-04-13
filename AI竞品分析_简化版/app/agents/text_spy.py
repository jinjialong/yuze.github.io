import json
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from pathlib import Path


def fetch_web_text(url: str, output_dir: str = None) -> dict:
    """
    抓取网页文本

    返回 JSON 格式:
    {
        "status": "success|failed",
        "step": "text_capture",
        "timestamp": "2026-04-13T14:30:22",
        "data": {
            "url": "...",
            "text": "...",
            "text_length": 5000,
            "text_preview": "前200字符..."
        },
        "error": null,
        "error_message": ""
    }
    """
    timestamp = datetime.now().isoformat()
    result = {
        "status": "success",
        "step": "text_capture",
        "timestamp": timestamp,
        "data": {},
        "error": None,
        "error_message": ""
    }

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        # 强制使用 UTF-8 编码（处理中文网页）
        response.encoding = response.apparent_encoding or 'utf-8'

        soup = BeautifulSoup(response.text, 'html.parser')

        for script_or_style in soup(["script", "style"]):
            script_or_style.decompose()

        text = soup.get_text(separator='\n')
        lines = (line.strip() for line in text.splitlines())
        clean_text = '\n'.join(chunk for chunk in lines if chunk)

        preview = clean_text[:200] + "..." if len(clean_text) > 200 else clean_text

        result["data"] = {
            "url": url,
            "text": clean_text,
            "text_length": len(clean_text),
            "text_preview": preview
        }

        print(f"Text capture success: {len(clean_text)} characters")

        # 如果指定了输出目录，保存文件
        if output_dir:
            from pathlib import Path
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)

            # 保存 JSON 结果
            result_file = output_path / "text_capture_result.json"
            with open(result_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)

            # 保存纯文本文件
            text_file = output_path / "web_text.txt"
            with open(text_file, 'w', encoding='utf-8') as f:
                f.write(clean_text)
            print(f" 文本结果已保存到: {output_dir}")

    except requests.exceptions.Timeout:
        result["status"] = "failed"
        result["error"] = "Timeout"
        result["error_message"] = "网页请求超时，请检查 URL 是否可访问"
    except requests.exceptions.RequestException as e:
        result["status"] = "failed"
        result["error"] = "RequestError"
        result["error_message"] = f"无法访问目标网页: {str(e)}"
    except Exception as e:
        result["status"] = "failed"
        result["error"] = type(e).__name__
        result["error_message"] = f"文本抓取失败: {str(e)}"

    return result


if __name__ == "__main__":
    import sys
    import json
    from pathlib import Path
    from urllib.parse import urlparse

    if len(sys.argv) < 2:
        print("用法: python text_spy.py <URL> [过程数据目录]")
        print("示例: python text_spy.py https://www.baidu.com")
        print("示例: python text_spy.py https://www.baidu.com ./data/process/baidu/20240101_120000")
        sys.exit(1)

    url = sys.argv[1]

    # 如果提供了过程数据目录，使用它；否则自动创建
    if len(sys.argv) > 2:
        process_dir = Path(sys.argv[2])
    else:
        from datetime import datetime
        parsed = urlparse(url)
        domain = parsed.netloc.replace("www.", "").split(".")[0]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        process_dir = Path(__file__).parent.parent.parent / "data" / "process" / domain / timestamp

    process_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n正在测试文本抓取 Agent...")
    print(f"目标 URL: {url}")
    print(f"过程数据目录: {process_dir}\n")

    result = fetch_web_text(url)

    # 保存结果到过程数据目录
    result_file = process_dir / "text_capture_result.json"
    with open(result_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    # 同时保存纯文本文件方便查看
    if result['status'] == 'success':
        text_file = process_dir / "web_text.txt"
        with open(text_file, 'w', encoding='utf-8') as f:
            f.write(result['data']['text'])
        print(f"文本内容已保存到: {text_file}")

    print("\n" + "="*50)
    print("测试结果:")
    print("="*50)
    print(f"状态: {result['status']}")
    print(f"抓取文本长度: {result['data'].get('text_length', 0)} 字符")
    print(f"预览: {result['data'].get('text_preview', '')[:100]}...")
    print(f"\n结果已保存到: {result_file}")

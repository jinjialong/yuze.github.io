import os
import sys
import asyncio
import threading
from datetime import datetime
from pathlib import Path
from playwright.async_api import async_playwright

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import MAX_IMAGE_SIZE, JPEG_QUALITY, CHROME_PATH


async def create_stealth_browser(p, headless=True):
    """创建带反检测功能的浏览器"""
    chrome_path = CHROME_PATH if CHROME_PATH else ""

    args = [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
    ]

    launch_options = {
        "headless": headless,
        "args": args
    }

    if chrome_path and os.path.exists(chrome_path):
        launch_options["executable_path"] = chrome_path
        print("Using local Chrome (stealth mode)")
    else:
        print("Using Playwright Chromium (stealth mode)")

    browser = await p.chromium.launch(**launch_options)

    context = await browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        locale='zh-CN',
        timezone_id='Asia/Shanghai',
    )

    await context.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined
        });
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
        });
        window.chrome = { runtime: {} };
    """)

    return browser, context


async def capture_screenshot(url: str, output_dir: str) -> dict:
    """
    抓取网页截图

    返回 JSON 格式:
    {
        "status": "success|failed",
        "step": "screenshot",
        "timestamp": "2026-04-13T14:30:22",
        "data": {
            "screenshot_path": "...",
            "compressed_path": "...",
            "page_title": "...",
            "file_size_mb": 1.5
        },
        "error": null,
        "error_message": ""
    }
    """
    timestamp = datetime.now().isoformat()
    result = {
        "status": "success",
        "step": "screenshot",
        "timestamp": timestamp,
        "data": {},
        "error": None,
        "error_message": ""
    }

    try:
        async with async_playwright() as p:
            browser, context = await create_stealth_browser(p, headless=True)
            page = await context.new_page()

            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await asyncio.sleep(1)
            await page.mouse.wheel(0, 300)
            await asyncio.sleep(0.5)

            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)

            screenshot_path = output_path / "screenshot.png"
            compressed_path = output_path / "compressed.jpg"

            await page.screenshot(
                path=str(screenshot_path),
                full_page=True,
                type='jpeg',
                quality=JPEG_QUALITY
            )

            from PIL import Image
            with Image.open(screenshot_path) as img:
                img.thumbnail((MAX_IMAGE_SIZE, MAX_IMAGE_SIZE), Image.Resampling.LANCZOS)
                img.save(str(compressed_path), format="JPEG", quality=JPEG_QUALITY)

            title = await page.title()
            file_size = os.path.getsize(screenshot_path) / (1024 * 1024)

            await browser.close()

            result["data"] = {
                "screenshot_path": str(screenshot_path),
                "compressed_path": str(compressed_path),
                "page_title": title,
                "file_size_mb": round(file_size, 2)
            }

            print(f"Screenshot saved: {screenshot_path}")
            print(f"Compressed saved: {compressed_path}")

    except Exception as e:
        result["status"] = "failed"
        result["error"] = type(e).__name__
        result["error_message"] = f"网页截图失败: {str(e)}"
        print(f"Capture failed: {e}")

    return result


async def run_screenshot_async(url: str, output_dir: str) -> dict:
    """异步截图接口 - 在独立线程中运行 asyncio.run()"""
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_run_capture, url, output_dir)
        return await asyncio.wrap_future(future)


def _run_capture(url: str, output_dir: str) -> dict:
    """在线程中运行截图（自带事件循环）"""
    return asyncio.run(capture_screenshot(url, output_dir))


if __name__ == "__main__":
    import sys
    import json
    from urllib.parse import urlparse

    if len(sys.argv) < 2:
        print("用法: python spy.py <URL>")
        print("示例: python spy.py https://www.baidu.com")
        sys.exit(1)

    url = sys.argv[1]

    # 从 URL 提取网站名称
    parsed = urlparse(url)
    domain = parsed.netloc.replace("www.", "").split(".")[0]

    # 创建规范的过程数据目录: data/process/{网站名}/{时间戳}/
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    process_dir = Path(__file__).parent.parent.parent / "data" / "process" / domain / timestamp
    process_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n正在测试截图 Agent...")
    print(f"目标 URL: {url}")
    print(f"过程数据目录: {process_dir}\n")

    result = run_screenshot(url, str(process_dir))

    # 保存结果到 JSON 文件
    result_file = process_dir / "screenshot_result.json"
    with open(result_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print("\n" + "="*50)
    print("测试结果:")
    print("="*50)
    print(f"状态: {result['status']}")
    if result['status'] == 'success':
        print(f"截图: {result['data']['screenshot_path']}")
        print(f"压缩图: {result['data']['compressed_path']}")
        print(f"页面标题: {result['data']['page_title']}")
    else:
        print(f"错误: {result['error_message']}")
    print(f"\n结果已保存到: {result_file}")

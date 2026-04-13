import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
APP_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
SCREENSHOT_DIR = DATA_DIR / "screenshots"
REPORT_DIR = DATA_DIR / "reports"

DATA_DIR.mkdir(exist_ok=True)
# SCREENSHOT_DIR 已废弃，截图现在保存在 data/process/{domain}/{timestamp}/ 中
# SCREENSHOT_DIR.mkdir(exist_ok=True)
REPORT_DIR.mkdir(exist_ok=True)

# API 配置（云雾 API）
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.yunwu.ai")
API_KEY = os.getenv("API_KEY", "sk-DORVD1QtFHXtWNRnYimZsA22ZKcKy3BCVgz3faV54MOIEg4F")

# 模型配置
# 好模型：用于视觉识别、报告生成、审查验证
MODEL_GOOD = os.getenv("MODEL_GOOD", "gpt-4o")
# 便宜模型：用于数据清洗
MODEL_CHEAP = os.getenv("MODEL_CHEAP", "gpt-4o-mini")

# Chrome 浏览器路径
CHROME_PATH = os.getenv("CHROME_PATH", r"C:\Program Files\Google\Chrome\Application\chrome.exe")

MAX_IMAGE_SIZE = 1500
JPEG_QUALITY = 85
MAX_RETRIES = 3

API_TIMEOUT = 600.0

TEMP_FILES = [
    "raw_text.txt",
    "cleaned_data.json",
    "vision_analysis.json",
    "audit_result.json",
    "screenshot.png"
]

STEP_NAMES = {
    "screenshot": "网页截图",
    "text_capture": "文本抓取",
    "vision": "视觉识别",
    "clean": "数据清洗",
    "generate": "报告生成",
    "review": "审查验证"
}

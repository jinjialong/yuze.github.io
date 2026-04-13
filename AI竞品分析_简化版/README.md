# AI 竞品分析工具

一个基于多 Agent 协作的竞品分析工具，通过网页截图、视觉识别、文本抓取、AI 生成和审查验证，自动生成结构化的竞品分析报告。

## 功能特性

- 🤖 多 Agent 协作：截图抓取 → 视觉识别 → 数据清洗 → 报告生成 → 审查验证
- 📊 智能分析：结合网页截图和文本内容，生成深度竞品分析报告
- 🔄 版本管理：同一竞品多次分析，自动创建新版本（v1, v2...）
- ✓ 防幻觉机制：AI 审查验证，确保内容基于事实
- 💰 成本控制：数据清洗使用便宜模型，节省 Token 费用

## 技术栈

- **后端**: FastAPI + Python
- **浏览器自动化**: Playwright + Chrome
- **AI 调用**: LangChain + OpenAI 兼容 API
- **前端**: HTML + CSS + JavaScript

## 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd AI竞品分析_简化版
```

### 2. 安装依赖

```bash
# 创建虚拟环境
python -m venv venv

# Windows
venv\Scripts\activate

# 安装 Python 依赖
pip install -r requirements.txt

# 安装 Playwright 浏览器
playwright install chromium
```

### 3. 配置环境变量

创建 `.env` 文件或在系统环境变量中设置：

```env
OPENAI_BASE_URL=https://your-api-endpoint.com
API_KEY=sk-your-api-key

# 可选：指定模型
MODEL_GOOD=claude-3-5-sonnet-20241022
MODEL_CHEAP=claude-3-haiku-20240307

# 可选：指定 Chrome 路径
CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
```

### 4. 启动服务

```bash
python app/main.py
```

访问 http://localhost:8000

## 使用说明

1. 点击「新建分析」
2. 输入竞品名称和目标 URL
3. 点击「开始分析」，等待进度完成
4. 分析完成后，可查看报告列表
5. 点击「查看全文」阅读完整报告

## 项目结构

```
AI竞品分析_简化版/
├── app/
│   ├── agents/           # Agent 模块
│   ├── core/             # 核心工作流
│   ├── models/           # 数据模型
│   ├── static/           # 前端资源
│   ├── main.py           # FastAPI 入口
│   └── config.py         # 配置
├── data/                 # 数据存储（.gitignore）
├── requirements.txt      # 依赖
└── README.md            # 项目说明
```

## 部署到腾讯云

### 1. 准备服务器

- 购买腾讯云 Windows Server
- 开放端口 8000

### 2. 安装 Chrome

```powershell
# 下载并安装 Google Chrome
```

### 3. 部署代码

```bash
# 上传代码到服务器
# 安装依赖（同上）
```

### 4. 配置环境变量

```powershell
# 系统属性 → 高级 → 环境变量
setx OPENAI_BASE_URL "https://your-api-endpoint.com"
setx API_KEY "sk-your-api-key"
```

### 5. 启动服务

```powershell
python app\main.py
```

或使用 NSSM 部署为 Windows 服务。

## 注意事项

1. **API Key 安全**: 不要将 API Key 提交到 Git，使用环境变量
2. **数据备份**: 定期备份 `data/` 目录
3. **日志查看**: 控制台会输出详细日志
4. **错误处理**: 分析失败时会自动清理临时文件

## License

MIT

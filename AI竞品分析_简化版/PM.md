# AI 竞品分析工具 - 产品方案与技术方案

> 版本：v1.0（无 RAG 版）  
> 更新日期：2026-04-13  
> 状态：已确认，待开发

---

## 一、产品概述

### 1.1 产品定位
- **用户规模**：单用户工具
- **使用场景**：个人日常使用，快速分析竞品网页
- **核心目标**：输入竞品名称和 URL，自动生成结构化竞品分析报告

### 1.2 核心功能
- 网页截图抓取（整页截图）
- 视觉内容识别（VLM 多模态分析）
- 网页文本提取与清洗
- AI 自动生成竞品分析报告
- AI 审查验证（防幻觉机制）

### 1.3 本次不做
- RAG 检索问答功能
- 批量分析
- 竞品对比（同时分析多个）
- 用户登录/账单系统
- PDF/Word 导出功能

---

## 二、工作流设计（同步执行）

```
用户输入（竞品名称 + URL）
    ↓
[步骤1] 截图抓取（spy.py）
    - Playwright + Chrome 浏览器
    - 整页截图 + JPEG 压缩（质量85%）
    - 输出：screenshot.png
    ↓
[步骤2] 文本抓取（text_spy.py）
    - requests + BeautifulSoup
    - 提取纯文本，剔除 script/style 标签
    - 输出 JSON：{"status": "success", "data": {"text": "...", "text_length": 5000}}
    ↓
[步骤3] 视觉识别（vision_agent.py）
    - 好模型（Claude-3.5-Sonnet 或同等能力）
    - 图片压缩至 1500px 最大边
    - 输出 JSON（Structured Output）：
      {"core_features": [...], "ui_highlights": [...], "target_users": "...", ...}
    ↓
[步骤4] 数据清洗（clean_agent - 集成在 final_report_agent.py）
    - 便宜模型（Haiku / GPT-3.5）
    - 清洗 HTML 残留，提取结构化信息
    - 输出 JSON：{"cleaned_text": "...", "compression_ratio": "60%"}
    ↓
[步骤5] 报告生成（final_report_agent.py）
    - 好模型（Claude-3.5-Sonnet）
    - 融合视觉分析 + 清洗后文本
    - 输出 JSON：{"report_content": "# Markdown 内容...", "confidence": "high"}
    ↓
[步骤6] 审查验证（critic_agent.py）
    - 好模型（Claude-3.5-Sonnet）
    - 图文交叉验证，检查幻觉
    - 输出 JSON：{"passed": true/false, "issues": [...], "suggestions": "..."}
    ↓
审查通过？
    ├─ 是 → 保存报告，清理临时文件，前端展示成功
    └─ 否 → 重试计数+1
              ↓
         重试次数 < 3？
              ├─ 是 → 返回步骤5，携带审查意见重写
              └─ 否 → 标记置信度"低"，保存报告，清理临时文件，前端提示"置信度较低"
```

---

## 三、Agent 间数据传递规范（JSON 标准格式）

所有 Agent 之间传递统一使用以下 JSON Schema：

```json
{
  "status": "success|failed",
  "step": "text_capture|vision|clean|generate|review",
  "timestamp": "2026-04-13T14:30:22",
  "data": {},
  "error": null,
  "error_message": "",
  "retry_count": 0
}
```

### 3.1 各步骤 data 结构定义

**text_capture（文本抓取）**
```json
{
  "url": "https://www.example.com",
  "text_length": 5000,
  "text_preview": "前200字符预览..."
}
```

**vision（视觉识别）**
```json
{
  "core_features": ["功能1", "功能2", "功能3"],
  "ui_highlights": ["亮点1", "亮点2"],
  "target_users": "目标用户描述",
  "conversion_elements": ["转化按钮1", "转化路径2"],
  "product_positioning": "产品定位一句话"
}
```

**clean（数据清洗）**
```json
{
  "cleaned_text": "清洗后的纯文本...",
  "original_length": 10000,
  "cleaned_length": 4000,
  "compression_ratio": "60%"
}
```

**generate（报告生成）**
```json
{
  "report_content": "# 竞品分析报告\n\n## 1. 产品概述...",
  "report_summary": "报告摘要...",
  "confidence": "high"
}
```

**review（审查验证）**
```json
{
  "passed": true,
  "issues": [],
  "suggestions": "",
  "fact_check_score": 0.95
}
```

---

## 四、数据存储规范

### 4.1 目录结构

```
AI竞品分析/
├── app/
│   ├── main.py                 # FastAPI 主入口
│   ├── config.py               # 配置管理
│   ├── core/
│   │   └── workflow.py         # 工作流编排器
│   ├── models/
│   │   └── database.py         # JSON 文件操作
│   ├── agents/
│   │   ├── spy.py              # 截图抓取（Playwright）
│   │   ├── text_spy.py         # 文本抓取
│   │   ├── vision_agent.py     # 视觉识别
│   │   ├── final_report_agent.py  # 清洗+报告生成
│   │   └── critic_agent.py     # 审查验证
│   └── static/
│       ├── index.html          # 前端页面
│       ├── style.css           # 样式
│       └── app.js              # 前端逻辑
├── data/                       # 数据目录（.gitignore）
│   ├── screenshots/            # 截图文件
│   │   └── {竞品名}_{时间戳}/
│   │       ├── screenshot.png
│   │       └── compressed.jpg
│   └── reports/                # 报告文件
│       └── {竞品名}/
│           ├── v1_20260413_143022.md
│           ├── v2_20260413_153045.md
│           └── metadata.json   # 版本元数据
└── requirements.txt
```

### 4.2 存储规则

**保留的文件（分析成功后）：**
- `final_report.md` - 最终报告（Markdown）
- `screenshot_compressed.jpg` - 压缩后的配图
- `metadata.json` - 版本信息

**临时文件（分析完成后删除，无论成功与否）：**
- `raw_text.txt` - 原始网页文本
- `cleaned_data.json` - 清洗后的数据
- `vision_analysis.json` - 视觉分析中间结果
- `audit_result.json` - 审查结果
- `screenshot.png` - 原始截图（保留 compressed 版本）

### 4.3 metadata.json 格式

```json
{
  "competitor_name": "飞书",
  "url": "https://www.feishu.cn",
  "created_at": "2026-04-13T14:30:22",
  "versions": [
    {
      "version": "v2",
      "timestamp": "2026-04-13T14:30:22",
      "confidence": "high",
      "report_path": "data/reports/飞书/v2_20260413_143022.md",
      "screenshot_path": "data/screenshots/飞书_20260413_143022/compressed.jpg"
    },
    {
      "version": "v1",
      "timestamp": "2026-04-12T09:15:33",
      "confidence": "low",
      "report_path": "data/reports/飞书/v1_20260412_091533.md",
      "screenshot_path": "data/screenshots/飞书_20260412_091533/compressed.jpg"
    }
  ]
}
```

### 4.4 版本命名规则

- 同一 URL 多次分析，自动递增版本号：v1, v2, v3...
- 时间戳格式：`YYYYMMDD_HHMMSS`
- 文件名格式：`{version}_{时间戳}.md`

---

## 五、前端交互设计

### 5.1 页面布局

```
┌────────────────────────────────────────────────────────────┐
│  AI竞品分析                                    [+ 新建分析] │
├─────────────┬──────────────────────────────────────────────┤
│             │                                              │
│  📁 竞品列表  │           主内容区（动态变化）                │
│             │                                              │
│  📂 飞书     │  ┌──────────────────────────────────────┐   │
│    ├─ v2    │  │          新建分析表单                  │   │
│    └─ v1    │  │  ─────────────────────────────────    │   │
│             │  │  竞品名称: [________________]         │   │
│  📂 Notion  │  │  目标URL:  [________________]         │   │
│    └─ v1    │  │                                      │   │
│             │  │         [    开始分析    ]            │   │
│  📂 钉钉     │  └──────────────────────────────────────┘   │
│    └─ v1    │                                              │
│             │  ┌──────────────────────────────────────┐   │
│  [+ 新建]   │  │          分析进度面板                  │   │
│             │  │  ████████████░░░░░░  75%              │   │
│             │  │                                      │   │
│             │  │  ✅ 网页截图完成                       │   │
│             │  │  ✅ 视觉识别完成                       │   │
│             │  │  ✅ 数据清洗完成                       │   │
│             │  │  ⏳ 报告生成中...                      │   │
│             │  │  ○ 审查验证                            │   │
│             │  └──────────────────────────────────────┘   │
│             │                                              │
│             │  ┌──────────────────────────────────────┐   │
│             │  │          分析完成                     │   │
│             │  │  ✓ 竞品分析已完成                      │   │
│             │  │                                      │   │
│             │  │  置信度: 高 ✓                         │   │
│             │  │  耗时: 2分30秒                        │   │
│             │  │                                      │   │
│             │  │  [查看报告列表]  [新建下一个]          │   │
│             │  └──────────────────────────────────────┘   │
│             │                                              │
└─────────────┴──────────────────────────────────────────────┘
```

### 5.2 交互流程

**1. 新建分析**
- 点击「+ 新建分析」按钮
- 弹出表单：输入竞品名称、目标 URL
- 点击「开始分析」

**2. 分析中（防重复提交）**
- 表单区域变为进度面板
- 显示进度条（0% → 100%）
- 显示当前步骤状态（图标 + 文字）
- **分析过程中，「新建分析」按钮禁用**

**3. 分析完成**
- 显示完成状态 + 置信度（高/低）
- 显示耗时
- 提供「查看报告列表」和「新建下一个」按钮

**4. 查看报告列表（弹窗/抽屉）**
```
┌─────────────────────────────────────────┐
│  飞书 - 历史版本                  [×]   │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ v2  2026-04-13 14:30:22          │   │
│  │ 置信度: 高 ✓                     │   │
│  │ [查看全文]                       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ v1  2026-04-12 09:15:33          │   │
│  │ 置信度: 低 ⚠️                   │   │
│  │ [查看全文]                       │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

**5. 查看报告全文（弹窗）**
- Markdown 渲染显示
- 可滚动阅读
- 关闭后返回列表

**6. 分析失败**
- 弹窗提示：「分析失败，临时文件已自动清理，请重新提交分析」
- 确认后关闭弹窗，返回新建表单

### 5.3 进度更新机制

- **技术方案**：HTTP 轮询（每秒请求一次进度）
- **后端**：工作流每完成一步，更新内存中的进度状态
- **前端**：轮询接口获取当前步骤和百分比

---

## 六、技术架构

### 6.1 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端框架 | FastAPI | Python Web 框架 |
| 浏览器自动化 | Playwright | 截图抓取，指定 Chrome 路径 |
| HTTP 请求 | requests + BeautifulSoup | 文本抓取 |
| AI 调用 | langchain-openai | OpenAI 兼容格式 |
| 前端 | HTML + CSS + JavaScript | 原生，无框架 |
| 数据存储 | JSON 文件 | 元数据管理 |
| 部署 | 腾讯云 Windows Server | 国内可访问 |

### 6.2 模型路由（成本控制）

| 步骤 | 模型选择 | 说明 |
|------|---------|------|
| 数据清洗 | 便宜模型 | Haiku / GPT-3.5 / 等效模型 |
| 视觉识别 | 好模型 | Claude-3.5-Sonnet / GPT-4o / 等效模型 |
| 报告生成 | 好模型 | Claude-3.5-Sonnet / GPT-4o / 等效模型 |
| 审查验证 | 好模型 | Claude-3.5-Sonnet / GPT-4o / 等效模型 |

**成本优化策略**：清洗阶段使用便宜模型，预计节省 60-80% Token 成本。

### 6.3 API 配置

```python
# 用户提供的信息
OPENAI_BASE_URL = "https://api.example.com"  # 不带 /v1
API_KEY = "sk-xxxxxxxx"

# 代码自动拼接
FULL_URL = f"{OPENAI_BASE_URL}/v1"
```

---

## 七、技术实现细节

### 7.1 浏览器配置

**Windows 环境**
- 优先查找系统安装的 Chrome
- 环境变量 `CHROME_PATH` 可指定路径
- 备用：Playwright 自带 Chromium

**Linux 环境（备用）**
- 需先安装 Chrome
- 使用 `--no-sandbox` 参数（无头模式必需）
- 安装依赖：`playwright install-deps chromium`

### 7.2 图片处理

```python
# 压缩参数
MAX_SIZE = 1500  # 最大边像素
QUALITY = 85     # JPEG 质量

# 流程
1. Playwright 截图（full_page=True）→ PNG
2. PIL 压缩（thumbnail + LANCZOS）→ JPEG
3. 传给 VLM 时转 base64（必要时再压缩）
```

### 7.3 错误处理机制

**重试策略**
- 每个步骤最多尝试 3 次（首次 + 2 次重试）
- 重试间隔：指数退避（1s → 2s → 4s）
- 超过 3 次：标记失败，前端提示

**错误提示（中文）**
| 错误场景 | 前端提示 |
|---------|---------|
| 网页无法访问 | "无法访问目标网页，请检查 URL 是否正确" |
| 截图失败 | "网页截图失败，请稍后重试" |
| API 调用失败 | "AI 服务暂时不可用，请稍后重试" |
| 审查不通过（3次）| "报告生成完成，但置信度较低，请人工核实" |
| 未知错误 | "分析过程中出现错误，临时文件已清理，请重新提交" |

### 7.4 路径兼容性

```python
# 使用 os.path.join 确保跨平台
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
SCREENSHOT_DIR = os.path.join(DATA_DIR, "screenshots")
REPORT_DIR = os.path.join(DATA_DIR, "reports")
```

---

## 八、项目目录结构

```
AI竞品分析/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI 入口
│   ├── config.py                  # 配置（API Key、模型名、路径）
│   ├── core/
│   │   ├── __init__.py
│   │   └── workflow.py            # 工作流编排（串联 Agent、重试逻辑）
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── spy.py                 # 截图抓取（Playwright + Chrome）
│   │   ├── text_spy.py            # 文本抓取（requests + BS4）
│   │   ├── vision_agent.py        # 视觉识别（VLM，输出 JSON）
│   │   ├── final_report_agent.py  # 数据清洗 + 报告生成
│   │   └── critic_agent.py        # 审查验证（图文交叉验证）
│   ├── models/
│   │   ├── __init__.py
│   │   └── database.py            # JSON 文件操作（metadata 读写）
│   └── static/
│       ├── index.html             # 前端页面
│       ├── style.css              # 样式文件
│       └── app.js                 # 前端逻辑（轮询、弹窗等）
├── data/                          # 数据目录（.gitignore）
│   ├── screenshots/               # 截图存储
│   └── reports/                   # 报告存储
├── requirements.txt               # Python 依赖
└── README.md                      # 项目说明
```

---

## 九、部署说明

### 9.1 本地开发（Windows）

```bash
# 1. 创建虚拟环境
python -m venv venv
venv\Scripts\activate

# 2. 安装依赖
pip install -r requirements.txt

# 3. 安装 Playwright 浏览器
playwright install chromium

# 4. 设置环境变量
set OPENAI_BASE_URL=https://api.example.com
set API_KEY=sk-xxxxxxxx

# 5. 启动
python app/main.py
```

### 9.2 腾讯云部署（Windows Server）

```bash
# 1. 安装 Chrome 浏览器
# 下载 Chrome 安装包并安装

# 2. 安装 Python 依赖（同上）

# 3. 安装 Playwright 及依赖
playwright install chromium
playwright install-deps chromium

# 4. 配置系统环境变量
# 控制面板 → 系统 → 高级系统设置 → 环境变量

# 5. 使用 NSSM 或 Windows Service 部署为后台服务
# 或直接用 pythonw 运行
```

### 9.3 注意事项

- **防火墙**：开放应用端口（默认 8000）
- **安全**：API Key 存储在环境变量，不要提交到 Git
- **日志**：配置日志轮转，避免磁盘占满
- **备份**：定期备份 data/ 目录

---

## 十、后续版本规划

### v2.0 - RAG 增强版（规划中）

- 引入 Chroma 向量数据库
- 报告切片向量化存储（800字/块，10%重叠）
- 跨报告检索问答
- 连续对话上下文

---

## 附录：API 响应格式

### 进度查询接口

```json
{
  "status": "analyzing",
  "progress": 60,
  "current_step": "generate",
  "step_name": "报告生成中...",
  "steps": [
    {"name": "截图抓取", "status": "completed"},
    {"name": "文本抓取", "status": "completed"},
    {"name": "视觉识别", "status": "completed"},
    {"name": "数据清洗", "status": "completed"},
    {"name": "报告生成", "status": "processing"},
    {"name": "审查验证", "status": "pending"}
  ]
}
```

### 分析结果接口

```json
{
  "status": "success",
  "competitor_name": "飞书",
  "version": "v2",
  "timestamp": "2026-04-13T14:30:22",
  "confidence": "high",
  "report_path": "data/reports/飞书/v2_20260413_143022.md",
  "duration_seconds": 150
}
```

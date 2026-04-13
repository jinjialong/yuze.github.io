import sys
import os

# 项目根目录
project_dir = os.path.dirname(os.path.abspath(__file__))

# 添加到 Python 路径
sys.path.insert(0, project_dir)

# 切换到项目目录
os.chdir(project_dir)

print("=" * 50)
print("AI 竞品分析工具启动中...")
print("访问地址: http://localhost:8081")
print("=" * 50)

# 使用 uvicorn 运行
import uvicorn
uvicorn.run("app.main:app", host="0.0.0.0", port=8082, reload=False)

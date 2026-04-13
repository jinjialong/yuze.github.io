#!/usr/bin/env python
"""
完整工作流测试脚本 - 从截图到最终报告
"""
import sys
import asyncio
from datetime import datetime
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent))

from app.core.workflow import workflow_manager


async def progress_callback(job):
    """进度回调函数"""
    print(f"\n[{job['progress']}%] 当前步骤: {job['current_step']}")
    if job.get('retry_count'):
        print(f"  重试次数: {job['retry_count']}")


async def main():
    job_id = f"test_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    competitor_name = "百度"
    url = "https://www.baidu.com"

    print("=" * 60)
    print(f"开始完整工作流测试")
    print(f"任务ID: {job_id}")
    print(f"竞品名称: {competitor_name}")
    print(f"目标URL: {url}")
    print("=" * 60)

    try:
        result = await workflow_manager.run_analysis(
            job_id=job_id,
            competitor_name=competitor_name,
            url=url,
            progress_callback=progress_callback
        )

        print("\n" + "=" * 60)
        print("工作流完成!")
        print("=" * 60)
        print(f"最终结果:")
        print(f"  版本: {result['version']}")
        print(f"  置信度: {result['confidence']}")
        print(f"  报告路径: {result['report_path']}")

    except Exception as e:
        print(f"\n工作流失败: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())

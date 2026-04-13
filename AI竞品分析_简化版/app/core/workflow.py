import json
import os
import re
import asyncio
import shutil
from datetime import datetime
from pathlib import Path
from typing import Callable, Dict, Optional

from app.config import MAX_RETRIES, TEMP_FILES, STEP_NAMES
from app.models.database import db
from app.agents.spy import run_screenshot_async
from app.agents.text_spy import fetch_web_text
from app.agents.vision_agent import analyze_screenshot
from app.agents.final_report_agent import clean_web_text, generate_report
from app.agents.critic_agent import review_report


class WorkflowManager:
    """工作流管理器 - 管理竞品分析的完整流程"""

    def __init__(self):
        self.active_jobs: Dict[str, dict] = {}

    def create_job(self, job_id: str, competitor_name: str, url: str) -> dict:
        """创建新的分析任务"""
        job = {
            "id": job_id,
            "competitor_name": competitor_name,
            "url": url,
            "status": "pending",
            "progress": 0,
            "current_step": "",
            "steps": [
                {"name": "screenshot", "status": "pending", "label": STEP_NAMES["screenshot"]},
                {"name": "text_capture", "status": "pending", "label": STEP_NAMES["text_capture"]},
                {"name": "vision", "status": "pending", "label": STEP_NAMES["vision"]},
                {"name": "clean", "status": "pending", "label": STEP_NAMES["clean"]},
                {"name": "generate", "status": "pending", "label": STEP_NAMES["generate"]},
                {"name": "review", "status": "pending", "label": STEP_NAMES["review"]},
            ],
            "result": None,
            "error": None,
            "start_time": datetime.now().isoformat(),
            "end_time": None,
            "retry_count": 0,
            "max_retries": MAX_RETRIES
        }
        self.active_jobs[job_id] = job
        return job

    def get_job(self, job_id: str) -> Optional[dict]:
        """获取任务状态"""
        return self.active_jobs.get(job_id)

    def _update_step_status(self, job_id: str, step_name: str, status: str):
        """更新步骤状态"""
        job = self.active_jobs.get(job_id)
        if job:
            for step in job["steps"]:
                if step["name"] == step_name:
                    step["status"] = status
                    break

    def _calculate_progress(self, job_id: str) -> int:
        """计算整体进度"""
        job = self.active_jobs.get(job_id)
        if not job:
            return 0

        completed = sum(1 for step in job["steps"] if step["status"] == "completed")
        processing = sum(1 for step in job["steps"] if step["status"] == "processing")
        total = len(job["steps"])

        return int((completed + processing * 0.5) / total * 100)

    def _clean_temp_files(self, output_dir: str):
        """清理临时文件"""
        output_path = Path(output_dir)
        for filename in TEMP_FILES:
            file_path = output_path / filename
            if file_path.exists():
                try:
                    file_path.unlink()
                    print(f" 清理临时文件: {filename}")
                except Exception as e:
                    print(f" 清理失败 {filename}: {e}")

    async def run_analysis(self, job_id: str, competitor_name: str, url: str, progress_callback: Callable = None):
        """运行完整的分析流程"""
        job = self.create_job(job_id, competitor_name, url)

        # 准备工作目录（过程数据）
        process_base_dir = Path(__file__).parent.parent.parent / "data" / "process" / competitor_name

        # 始终生成新的时间戳（用于报告文件名）
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        # 始终创建新的工作目录
        work_dir = process_base_dir / f"work_{timestamp}"
        work_dir.mkdir(parents=True, exist_ok=True)
        print(f" 创建新过程数据目录: {work_dir}")

        try:
            # Step 1: 截图抓取
            job["current_step"] = "screenshot"
            job["status"] = "analyzing"
            self._update_step_status(job_id, "screenshot", "processing")
            if progress_callback:
                await progress_callback(job)

            screenshot_result = await run_screenshot_async(url, str(work_dir))

            if screenshot_result["status"] == "failed":
                raise Exception(screenshot_result.get("error_message", "截图失败"))

            self._update_step_status(job_id, "screenshot", "completed")
            job["progress"] = self._calculate_progress(job_id)
            print(f"[WORKFLOW] screenshot 完成, progress={job['progress']}")
            if progress_callback:
                await progress_callback(job)
            screenshot_path = screenshot_result["data"]["screenshot_path"]
            compressed_path = screenshot_result["data"]["compressed_path"]

            # Step 2: 文本抓取
            job["current_step"] = "text_capture"
            self._update_step_status(job_id, "text_capture", "processing")
            if progress_callback:
                await progress_callback(job)

            text_result = await asyncio.to_thread(fetch_web_text, url, str(work_dir))

            if text_result["status"] == "failed":
                raise Exception(text_result.get("error_message", "文本抓取失败"))

            self._update_step_status(job_id, "text_capture", "completed")
            job["progress"] = self._calculate_progress(job_id)
            if progress_callback:
                await progress_callback(job)
            raw_text = text_result["data"]["text"]

            # Step 3: 视觉识别
            job["current_step"] = "vision"
            self._update_step_status(job_id, "vision", "processing")
            if progress_callback:
                await progress_callback(job)

            vision_result = await asyncio.to_thread(analyze_screenshot, compressed_path)

            if vision_result["status"] == "failed":
                raise Exception(vision_result.get("error_message", "视觉识别失败"))

            self._update_step_status(job_id, "vision", "completed")
            job["progress"] = self._calculate_progress(job_id)
            if progress_callback:
                await progress_callback(job)
            vision_data = vision_result["data"]

            # Step 4 & 5: 数据清洗 + 报告生成 (在 final_report_agent 中整合)
            job["current_step"] = "generate"
            self._update_step_status(job_id, "clean", "completed")
            self._update_step_status(job_id, "generate", "processing")
            if progress_callback:
                await progress_callback(job)

            # 审查循环
            audit_feedback = ""
            final_report = None
            confidence = "high"
            history = []  # 记录每次迭代的报告和审核结果

            for attempt in range(MAX_RETRIES):
                # 生成报告（带上历史上下文）
                report_result = await asyncio.to_thread(generate_report, vision_data, raw_text, audit_feedback, history)

                if report_result["status"] == "failed":
                    if attempt < MAX_RETRIES - 1:
                        job["retry_count"] = attempt + 1
                        continue
                    raise Exception(report_result.get("error_message", "报告生成失败"))

                report_content = report_result["data"]["report_content"]

                # 保存本次生成的报告
                report_file = work_dir / f"report_v{attempt + 1}.md"
                with open(report_file, 'w', encoding='utf-8') as f:
                    f.write(report_content)
                print(f" 报告 v{attempt + 1} 已保存: {report_file}")

                # Step 6: 审查验证
                job["current_step"] = "review"
                self._update_step_status(job_id, "review", "processing")
                job["progress"] = self._calculate_progress(job_id)
                if progress_callback:
                    await progress_callback(job)

                # 清洗文本用于审查
                clean_text = clean_web_text(raw_text)
                review_result = await asyncio.to_thread(review_report, report_content, clean_text, compressed_path)

                if review_result["status"] == "failed":
                    error_msg = review_result.get("error_message", "审查异常")

                    # 保存审查失败记录
                    review_file = work_dir / f"review_v{attempt + 1}_failed.json"
                    with open(review_file, 'w', encoding='utf-8') as f:
                        json.dump({
                            "attempt": attempt + 1,
                            "status": "failed",
                            "error": error_msg,
                            "timestamp": datetime.now().isoformat()
                        }, f, ensure_ascii=False, indent=2)

                    # 记录到历史
                    history.append({
                        "report_summary": report_content[:1000] if len(report_content) > 1000 else report_content,
                        "review_issues": [f"审查异常: {error_msg}"],
                        "review_suggestions": "请检查数据质量"
                    })

                    if attempt < MAX_RETRIES - 1:
                        job["retry_count"] = attempt + 1
                        audit_feedback = error_msg
                        continue
                    confidence = "low"
                    final_report = report_content
                    break

                review_data = review_result["data"]

                # 保存本次审查结果
                review_file = work_dir / f"review_v{attempt + 1}.json"
                with open(review_file, 'w', encoding='utf-8') as f:
                    json.dump({
                        "attempt": attempt + 1,
                        "passed": review_data.get("passed", False),
                        "issues": review_data.get("issues", []),
                        "suggestions": review_data.get("suggestions", ""),
                        "fact_check_score": review_data.get("fact_check_score", 0),
                        "timestamp": datetime.now().isoformat()
                    }, f, ensure_ascii=False, indent=2)
                print(f" 审查 v{attempt + 1} 结果: {'通过' if review_data.get('passed') else '不通过'}")

                if review_data.get("passed"):
                    final_report = report_content
                    break
                else:
                    # 记录本次迭代到历史
                    history.append({
                        "report_summary": report_content[:1000] if len(report_content) > 1000 else report_content,
                        "review_issues": review_data.get("issues", []),
                        "review_suggestions": review_data.get("suggestions", "")
                    })

                    if attempt < MAX_RETRIES - 1:
                        job["retry_count"] = attempt + 1
                        audit_feedback = review_data.get("suggestions", "")
                        print(f" 审查不通过，第 {attempt + 1} 次重试...")
                    else:
                        confidence = "low"
                        final_report = report_content
                        print(" 审查不通过，已达到最大重试次数")

            self._update_step_status(job_id, "review", "completed")
            job["progress"] = self._calculate_progress(job_id)
            if progress_callback:
                await progress_callback(job)

            # 如果置信度低（3次未通过），在报告开头添加说明
            if confidence == "low" and history:
                last_review = history[-1]
                failed_issues = last_review.get('review_issues', [])
                failed_reason = "; ".join(failed_issues) if failed_issues else "审核发现关键事实需要核实"

                disclaimer = f"""---

> ⚠️ **置信度说明**：本报告经过 {MAX_RETRIES} 轮审核，未能完全通过事实核查。
>
> **主要原因**：{failed_reason}
>
> **建议**：请人工核实报告中的关键信息（如定价、功能描述等）后再使用。

---

"""
                final_report = disclaimer + final_report

            # 保存最终报告到 reports 目录（新结构：版本+时间戳文件夹）
            competitor_dir = db.get_competitor_dir(competitor_name)
            version = db.get_next_version(competitor_name)

            # 创建版本文件夹：v{版本号}_{时间戳}
            version_dir = competitor_dir / f"{version}_{timestamp}"
            version_dir.mkdir(parents=True, exist_ok=True)

            # 报告统一文件名：AI竞品分析报告.md
            report_path = version_dir / "AI竞品分析报告.md"
            with open(report_path, "w", encoding="utf-8") as f:
                f.write(final_report)

            # 元数据也放到版本文件夹里
            version_metadata = {
                "competitor_name": competitor_name,
                "url": url,
                "version": version,
                "timestamp": timestamp,
                "confidence": confidence,
                "report_path": str(report_path),
                "created_at": datetime.now().isoformat()
            }
            metadata_path = version_dir / "metadata.json"
            with open(metadata_path, 'w', encoding='utf-8') as f:
                json.dump(version_metadata, f, ensure_ascii=False, indent=2)

            # 确保数据库记录（必须先创建，否则 add_version 会失败）
            if not db.get_metadata(competitor_name):
                db.create_competitor(competitor_name, url)

            # 更新全局数据库（记录版本列表）
            db.add_version(
                competitor_name=competitor_name,
                version=version,
                timestamp=timestamp,
                confidence=confidence,
                report_path=str(report_path),
                metadata_path=str(metadata_path)
            )

            # 清理临时文件
            self._clean_temp_files(str(work_dir))

            # 更新任务状态
            job["status"] = "success"
            job["progress"] = 100
            job["end_time"] = datetime.now().isoformat()
            job["result"] = {
                "competitor_name": competitor_name,
                "version": version,
                "timestamp": timestamp,
                "confidence": confidence,
                "report_path": str(report_path)
            }

            if progress_callback:
                await progress_callback(job)

            return job["result"]

        except Exception as e:
            job["status"] = "failed"
            job["error"] = str(e)
            job["end_time"] = datetime.now().isoformat()
            job["progress"] = self._calculate_progress(job_id)

            # 清理临时文件（失败时也清理）
            self._clean_temp_files(str(work_dir))

            if progress_callback:
                await progress_callback(job)

            raise


workflow_manager = WorkflowManager()

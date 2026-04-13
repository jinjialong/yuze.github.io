import os
import uuid
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.workflow import workflow_manager
from app.models.database import db
from app.config import BASE_DIR

app = FastAPI(title="AI竞品分析工具")

static_dir = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")


class AnalyzeRequest(BaseModel):
    competitor_name: str
    url: str


class AnalyzeResponse(BaseModel):
    job_id: str
    status: str
    message: str


class ProgressResponse(BaseModel):
    job_id: str
    status: str
    progress: int
    current_step: str
    step_name: str
    steps: list
    retry_count: int
    result: Optional[dict] = None
    error: Optional[str] = None


class CompetitorListResponse(BaseModel):
    name: str
    url: str
    version_count: int


class VersionInfo(BaseModel):
    version: str
    timestamp: str
    confidence: str
    report_path: str
    metadata_path: str


class CompetitorDetailResponse(BaseModel):
    competitor_name: str
    url: str
    created_at: str
    versions: list


@app.get("/")
async def root():
    return FileResponse(str(static_dir / "index.html"))


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def start_analysis(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    """启动竞品分析任务"""
    job_id = str(uuid.uuid4())

    async def progress_callback(job):
        """更新任务进度到内存存储"""
        workflow_manager.active_jobs[job["id"]] = job

    background_tasks.add_task(
        workflow_manager.run_analysis,
        job_id,
        request.competitor_name,
        request.url,
        progress_callback
    )

    return AnalyzeResponse(
        job_id=job_id,
        status="started",
        message="分析任务已启动"
    )


@app.get("/api/progress/{job_id}", response_model=ProgressResponse)
async def get_progress(job_id: str):
    """获取任务进度"""
    job = workflow_manager.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="任务不存在")

    from app.config import STEP_NAMES
    step_name = STEP_NAMES.get(job["current_step"], job["current_step"])

    # DEBUG: 打印每次轮询时后端的真实状态
    completed_steps = [s["name"] for s in job["steps"] if s["status"] == "completed"]
    processing_steps = [s["name"] for s in job["steps"] if s["status"] == "processing"]
    print(f"[PROGRESS_API] job={job_id[:8]}, status={job['status']}, progress={job['progress']}, "
          f"current_step={job['current_step']}, completed={completed_steps}, processing={processing_steps}")

    return ProgressResponse(
        job_id=job["id"],
        status=job["status"],
        progress=job["progress"],
        current_step=job["current_step"],
        step_name=step_name,
        steps=job["steps"],
        retry_count=job["retry_count"],
        result=job.get("result"),
        error=job.get("error")
    )


@app.get("/api/competitors", response_model=list)
async def list_competitors():
    """获取所有竞品列表"""
    competitors = db.get_all_competitors()
    return competitors


@app.get("/api/competitors/{competitor_name}", response_model=CompetitorDetailResponse)
async def get_competitor_detail(competitor_name: str):
    """获取竞品详情"""
    metadata = db.get_metadata(competitor_name)

    if not metadata:
        raise HTTPException(status_code=404, detail="竞品不存在")

    return CompetitorDetailResponse(
        competitor_name=metadata["competitor_name"],
        url=metadata["url"],
        created_at=metadata["created_at"],
        versions=metadata.get("versions", [])
    )


@app.get("/api/competitors/{competitor_name}/reports/{version}")
async def get_report(competitor_name: str, version: str):
    """获取报告内容"""
    content = db.get_report_content(competitor_name, version)

    if content is None:
        raise HTTPException(status_code=404, detail="报告不存在")

    return {"content": content}


@app.get("/api/competitors/{competitor_name}/reports/{version}/image")
async def get_report_image(competitor_name: str, version: str):
    """获取报告配图"""
    # 从过程数据目录查找截图
    process_dir = BASE_DIR / "data" / "process" / competitor_name
    work_dirs = list(process_dir.glob("work_*")) if process_dir.exists() else []

    if work_dirs:
        # 使用最新的过程数据目录中的截图
        latest_work_dir = sorted(work_dirs)[-1]
        compressed_path = latest_work_dir / "compressed.jpg"
        if compressed_path.exists():
            return FileResponse(str(compressed_path))

    raise HTTPException(status_code=404, detail="图片不存在")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

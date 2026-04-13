import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from app.config import REPORT_DIR


class Database:
    def __init__(self):
        self.report_dir = Path(REPORT_DIR)
        self.report_dir.mkdir(parents=True, exist_ok=True)

    def _get_metadata_path(self, competitor_name: str) -> Path:
        safe_name = self._safe_filename(competitor_name)
        return self.report_dir / safe_name / "metadata.json"

    def _safe_filename(self, name: str) -> str:
        return "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).strip()

    def get_competitor_dir(self, competitor_name: str) -> Path:
        safe_name = self._safe_filename(competitor_name)
        competitor_dir = self.report_dir / safe_name
        competitor_dir.mkdir(parents=True, exist_ok=True)
        return competitor_dir

    def create_competitor(self, competitor_name: str, url: str) -> Dict:
        metadata = {
            "competitor_name": competitor_name,
            "url": url,
            "created_at": datetime.now().isoformat(),
            "versions": []
        }
        self._save_metadata(competitor_name, metadata)
        return metadata

    def add_version(self, competitor_name: str, version: str, timestamp: str,
                    confidence: str, report_path: str, metadata_path: str) -> Dict:
        metadata = self.get_metadata(competitor_name)
        if not metadata:
            return None

        version_info = {
            "version": version,
            "timestamp": timestamp,
            "confidence": confidence,
            "report_path": report_path,
            "metadata_path": metadata_path
        }

        metadata["versions"].insert(0, version_info)
        self._save_metadata(competitor_name, metadata)
        return version_info

    def get_metadata(self, competitor_name: str) -> Optional[Dict]:
        metadata_path = self._get_metadata_path(competitor_name)
        if not metadata_path.exists():
            return None

        try:
            with open(metadata_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None

    def _save_metadata(self, competitor_name: str, metadata: Dict):
        metadata_path = self._get_metadata_path(competitor_name)
        metadata_path.parent.mkdir(parents=True, exist_ok=True)

        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)

    def get_next_version(self, competitor_name: str) -> str:
        metadata = self.get_metadata(competitor_name)
        if not metadata or not metadata.get("versions"):
            return "v1"

        max_version = 0
        for v in metadata["versions"]:
            try:
                num = int(v["version"].replace("v", ""))
                max_version = max(max_version, num)
            except ValueError:
                continue

        return f"v{max_version + 1}"

    def get_all_competitors(self) -> List[Dict]:
        competitors = []

        for competitor_dir in self.report_dir.iterdir():
            if competitor_dir.is_dir():
                metadata_path = competitor_dir / "metadata.json"
                if metadata_path.exists():
                    try:
                        with open(metadata_path, "r", encoding="utf-8") as f:
                            metadata = json.load(f)
                            competitors.append({
                                "name": metadata.get("competitor_name", competitor_dir.name),
                                "url": metadata.get("url", ""),
                                "version_count": len(metadata.get("versions", []))
                            })
                    except Exception:
                        continue

        return competitors

    def get_report_content(self, competitor_name: str, version: str) -> Optional[str]:
        metadata = self.get_metadata(competitor_name)
        if not metadata:
            return None

        for v in metadata.get("versions", []):
            if v["version"] == version:
                report_path = Path(v["report_path"])
                if report_path.exists():
                    try:
                        with open(report_path, "r", encoding="utf-8") as f:
                            return f.read()
                    except Exception:
                        return None

        return None


db = Database()

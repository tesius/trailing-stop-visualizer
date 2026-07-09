"""보유 종목(Holdings) JSON 파일 영속 저장 계층.

단일 사용자 셀프호스팅 환경 기준. 동시성이 낮으므로 임시파일 + os.replace 로
원자적 저장만 보장한다. 저장 위치는 DATA_DIR 환경변수(도커 볼륨)로 지정하며,
없으면 backend/data 로 폴백한다.
"""
import json
import os
import tempfile
from typing import List

from app.models import Holding

_DEFAULT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DATA_DIR = os.environ.get("DATA_DIR", _DEFAULT_DIR)
HOLDINGS_FILE = os.path.join(DATA_DIR, "holdings.json")


def _ensure_dir() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)


def load_holdings() -> List[Holding]:
    if not os.path.exists(HOLDINGS_FILE):
        return []
    try:
        with open(HOLDINGS_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []
    holdings = [Holding(**item) for item in raw]
    holdings.sort(key=lambda h: h.order)
    return holdings


def save_holdings(holdings: List[Holding]) -> None:
    _ensure_dir()
    data = [h.model_dump() for h in holdings]
    # 임시파일에 쓴 뒤 원자적 교체
    fd, tmp_path = tempfile.mkstemp(dir=DATA_DIR, prefix=".holdings-", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, HOLDINGS_FILE)
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise

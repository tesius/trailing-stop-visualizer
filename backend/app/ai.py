"""Gemini Flash 기반 지표 해석.

버튼 클릭 온디맨드 호출. 결과는 (ticker, date, 반올림 지표) 키로 인메모리 캐시.
GEMINI_API_KEY 환경변수가 없으면 예외를 던져 API에서 안내 메시지로 처리한다.
"""
import os
from typing import Optional

from app.models import InterpretRequest, InterpretResponse

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")

# 해석 결과 캐시: {cache_key: interpretation_text}
_CACHE: dict[str, str] = {}

_SYSTEM_PROMPT = """당신은 한국어로 답하는 기술적 분석 보조 도우미입니다.
주어진 종목의 RSI, MACD, ATR 트레일링 스톱/바이 지표 값을 바탕으로 현재 상태를 간결하게 해석합니다.

규칙:
- 반드시 한국어로 답합니다.
- 마크다운을 사용해 3~5개의 짧은 항목으로 요약합니다.
- RSI: 70 이상 과매수, 30 이하 과매도, 그 사이는 중립으로 해석하되 현재 값의 위치를 언급합니다.
- MACD: 히스토그램 부호와 시그널선 대비 위치로 상승/하락 모멘텀을 설명합니다.
- 트레일링 스톱/바이 라인이 있으면 현재가와의 관계(추세 방향, 이탈 여부)를 언급합니다.
- 마지막에 한 줄로 종합적인 톤(예: 상승 모멘텀 우세 / 관망 / 하락 주의)을 제시합니다.
- 확정적 매매 지시는 하지 않으며, 마지막에 "※ 투자 판단의 참고용이며 투자 권유가 아닙니다." 를 덧붙입니다.
- 과장 없이 사실 기반으로 담백하게 씁니다."""


def _cache_key(req: InterpretRequest) -> str:
    rsi = round(req.rsi, 1) if req.rsi is not None else "na"
    hist = round(req.macd_hist, 4) if req.macd_hist is not None else "na"
    price = round(req.price, 2)
    return f"{req.ticker}|{req.date}|{price}|{rsi}|{hist}"


def _build_prompt(req: InterpretRequest) -> str:
    sym = "₩" if req.currency == "KRW" else "$"

    def fmt(v: Optional[float]) -> str:
        return "N/A" if v is None else f"{v:,.4f}".rstrip("0").rstrip(".")

    lines = [
        f"종목: {req.ticker} ({req.currency})",
        f"기준일: {req.date}",
        f"현재가: {sym}{req.price:,.2f}",
        f"RSI(14): {fmt(req.rsi)}",
        f"MACD: {fmt(req.macd)} / 시그널: {fmt(req.macd_signal)} / 히스토그램: {fmt(req.macd_hist)}",
    ]
    if req.stop_price is not None:
        lines.append(f"ATR 트레일링 스톱: {sym}{req.stop_price:,.2f} (현재가 {'상회' if req.price > req.stop_price else '이탈'})")
    if req.buy_price is not None:
        lines.append(f"ATR 트레일링 바이: {sym}{req.buy_price:,.2f}")
    lines.append("\n위 지표를 해석해 주세요.")
    return "\n".join(lines)


def interpret_indicators(req: InterpretRequest) -> InterpretResponse:
    key = _cache_key(req)
    if key in _CACHE:
        return InterpretResponse(ticker=req.ticker, interpretation=_CACHE[key], model=GEMINI_MODEL, cached=True)

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY 환경변수가 설정되지 않았습니다. 서버 환경변수에 키를 추가해 주세요."
        )

    # SDK는 키가 있을 때만 import (미설치/미설정 환경에서 앱 기동 방해 방지)
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=_build_prompt(req),
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM_PROMPT,
            temperature=0.3,
        ),
    )
    text = (response.text or "").strip()
    if not text:
        raise RuntimeError("AI 해석 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요.")

    _CACHE[key] = text
    return InterpretResponse(ticker=req.ticker, interpretation=text, model=GEMINI_MODEL, cached=False)

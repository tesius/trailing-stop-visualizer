"""보유 종목(Holdings) CRUD 라우터."""
import uuid
from typing import List

from fastapi import APIRouter, Body, HTTPException

from app.models import Holding, HoldingCreate, HoldingUpdate
from app.storage import load_holdings, save_holdings

router = APIRouter(prefix="/holdings", tags=["holdings"])


@router.get("", response_model=List[Holding])
async def list_holdings():
    return load_holdings()


@router.post("", response_model=Holding)
async def create_holding(payload: HoldingCreate):
    holdings = load_holdings()
    next_order = (max((h.order for h in holdings), default=-1)) + 1
    holding = Holding(
        id=str(uuid.uuid4()),
        order=next_order,
        **payload.model_dump(),
    )
    holding.ticker = holding.ticker.upper()
    holdings.append(holding)
    save_holdings(holdings)
    return holding


@router.put("/order", response_model=List[Holding])
async def reorder_holdings(ids: List[str] = Body(..., embed=True)):
    holdings = load_holdings()
    order_map = {hid: i for i, hid in enumerate(ids)}
    for h in holdings:
        if h.id in order_map:
            h.order = order_map[h.id]
    holdings.sort(key=lambda h: h.order)
    save_holdings(holdings)
    return holdings


@router.put("/{holding_id}", response_model=Holding)
async def update_holding(holding_id: str, payload: HoldingUpdate):
    holdings = load_holdings()
    target = next((h for h in holdings if h.id == holding_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Holding not found")
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(target, key, value)
    if "ticker" in updates and target.ticker:
        target.ticker = target.ticker.upper()
    save_holdings(holdings)
    return target


@router.delete("/{holding_id}")
async def delete_holding(holding_id: str):
    holdings = load_holdings()
    remaining = [h for h in holdings if h.id != holding_id]
    if len(remaining) == len(holdings):
        raise HTTPException(status_code=404, detail="Holding not found")
    save_holdings(remaining)
    return {"ok": True}

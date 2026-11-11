"""
Admin Dashboard & Operations Routes
Platform analytics, job oversight, user credit adjustments, and audit trail.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from ..db.database import get_db
from ..db.models import User, Wallet, CreditTransaction, PaymentOrder

router = APIRouter(prefix="/api/v1/admin", tags=["Admin Operations"])

class CreditAdjustmentRequest(BaseModel):
    user_id: str
    minutes: int
    description: str = "Admin adjustment"

@router.get("/overview")
def get_admin_overview(db: Session = Depends(get_db)):
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_revenue = db.query(func.sum(PaymentOrder.amount_usd)).filter(PaymentOrder.status == "PAID").scalar() or 0.0
    total_minutes = db.query(func.sum(Wallet.available_minutes)).scalar() or 0
    paid_orders = db.query(func.count(PaymentOrder.id)).filter(PaymentOrder.status == "PAID").scalar() or 0

    recent_orders = db.query(PaymentOrder).order_by(PaymentOrder.created_at.desc()).limit(10).all()
    recent_transactions = db.query(CreditTransaction).order_by(CreditTransaction.created_at.desc()).limit(10).all()

    return {
        "metrics": {
            "total_users": total_users,
            "total_revenue_usd": round(total_revenue, 2),
            "paid_orders_count": paid_orders,
            "total_wallet_minutes_issued": total_minutes
        },
        "recent_orders": recent_orders,
        "recent_transactions": recent_transactions
    }

@router.post("/credits/grant")
def grant_admin_credits(payload: CreditAdjustmentRequest, db: Session = Depends(get_db)):
    wallet = db.query(Wallet).filter(Wallet.user_id == payload.user_id).first()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found for this user")

    wallet.available_minutes += payload.minutes
    tx = CreditTransaction(
        wallet_id=wallet.id,
        amount_minutes=payload.minutes,
        transaction_type="ADMIN_GRANT" if payload.minutes > 0 else "ADMIN_DEDUCT",
        reference_id="ADMIN",
        description=payload.description
    )
    db.add(tx)
    db.commit()

    return {
        "status": "SUCCESS",
        "user_id": payload.user_id,
        "new_balance_minutes": wallet.available_minutes,
        "adjusted_minutes": payload.minutes
    }

@router.get("/transactions")
def list_transactions(db: Session = Depends(get_db), limit: int = 50):
    txs = db.query(CreditTransaction).order_by(CreditTransaction.created_at.desc()).limit(limit).all()
    return {"transactions": txs}


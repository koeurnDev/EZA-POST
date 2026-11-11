import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db.database import get_db, Base, engine
from ..db.models import User, Wallet, CreditTransaction, Plan, PaymentOrder
from ..services.khqr import generate_khqr_payload

# Initialize tables
Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/api/v1/billing", tags=["Billing & Payments"])

# Default plans definition
DEFAULT_PLANS = [
    {
        "id": "free",
        "name": "Free Explorer",
        "price_usd": 0.0,
        "included_minutes": 20,
        "description": "សាកល្បងដោយឥតគិតថ្លៃ 20 នាទី / ខែ"
    },
    {
        "id": "creator",
        "name": "Creator Plan",
        "price_usd": 4.99,
        "included_minutes": 250,
        "description": "សមស្របសម្រាប់ TikToker, Facebook Reels & Vloggers (250 នាទី)"
    },
    {
        "id": "pro",
        "name": "Pro Studio",
        "price_usd": 12.99,
        "included_minutes": 1000,
        "description": "សម្រាប់ Video Editors, Podcasters និងស្ទូឌីយោ (1,000 នាទី)"
    },
    {
        "id": "business",
        "name": "Business / Team",
        "price_usd": 29.99,
        "included_minutes": 3000,
        "description": "ការងារច្រើន កម្រិតស្ទូឌីយោ និង Support ពិសេស (3,000 នាទី)"
    }
]

def ensure_seed_data(db: Session):
    for p in DEFAULT_PLANS:
        existing = db.query(Plan).filter(Plan.id == p["id"]).first()
        if not existing:
            db.add(Plan(
                id=p["id"],
                name=p["name"],
                price_usd=p["price_usd"],
                included_minutes=p["included_minutes"],
                description=p["description"]
            ))
    db.commit()

@router.get("/plans")
def list_plans(db: Session = Depends(get_db)):
    ensure_seed_data(db)
    plans = db.query(Plan).all()
    return {"plans": plans}

@router.get("/wallet")
def get_user_wallet(user_id: str = "demo-creator", db: Session = Depends(get_db)):
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    if not wallet:
        wallet = Wallet(user_id=user_id, available_minutes=30, locked_minutes=0)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
        
    transactions = db.query(CreditTransaction).filter(CreditTransaction.wallet_id == wallet.id).order_by(CreditTransaction.created_at.desc()).limit(10).all()
    
    return {
        "user_id": user_id,
        "available_minutes": wallet.available_minutes,
        "locked_minutes": wallet.locked_minutes,
        "recent_transactions": transactions
    }

@router.post("/checkout/khqr")
def create_khqr_checkout(plan_id: str, user_id: str = "demo-creator", db: Session = Depends(get_db)):
    ensure_seed_data(db)
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    order_id = f"KHMERSUB-{uuid.uuid4().hex[:8].upper()}"
    
    # Generate Bakong KHQR payload
    qr_payload = generate_khqr_payload(
        merchant_id="khmersub_ai@aclb",
        merchant_name="KhmerSub AI Studio",
        amount=plan.price_usd,
        currency="USD",
        order_id=order_id
    )
    
    order = PaymentOrder(
        id=order_id,
        user_id=user_id,
        plan_id=plan.id,
        amount_usd=plan.price_usd,
        currency="USD",
        provider="KHQR",
        qr_payload=qr_payload,
        status="PENDING"
    )
    db.add(order)
    db.commit()
    
    return {
        "order_id": order_id,
        "plan_id": plan.id,
        "plan_name": plan.name,
        "amount_usd": plan.price_usd,
        "included_minutes": plan.included_minutes,
        "qr_payload": qr_payload,
        "status": "PENDING"
    }

@router.get("/order/{order_id}")
def check_order_status(order_id: str, db: Session = Depends(get_db)):
    order = db.query(PaymentOrder).filter(PaymentOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"order_id": order.id, "status": order.status, "amount_usd": order.amount_usd}

@router.post("/khqr/simulate-pay/{order_id}")
def simulate_khqr_payment(order_id: str, db: Session = Depends(get_db)):
    """
    Simulates receiving Bakong Webhook callback to verify and activate user credits.
    """
    order = db.query(PaymentOrder).filter(PaymentOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.status == "PAID":
        return {"status": "ALREADY_PAID", "message": "Order was already processed"}
        
    plan = db.query(Plan).filter(Plan.id == order.plan_id).first()
    wallet = db.query(Wallet).filter(Wallet.user_id == order.user_id).first()
    if not wallet:
        wallet = Wallet(user_id=order.user_id, available_minutes=0, locked_minutes=0)
        db.add(wallet)
        db.flush()
        
    # Credit the ledger
    wallet.available_minutes += plan.included_minutes
    tx = CreditTransaction(
        wallet_id=wallet.id,
        amount_minutes=plan.included_minutes,
        transaction_type="PURCHASE",
        reference_id=order.id,
        description=f"បានទិញ {plan.name} (+{plan.included_minutes} នាទី)"
    )
    db.add(tx)
    
    order.status = "PAID"
    db.commit()
    
    return {
        "status": "SUCCESS",
        "order_id": order.id,
        "new_balance_minutes": wallet.available_minutes,
        "message": f"ការទូទាត់ជោគជ័យ! បានបន្ថែម {plan.included_minutes} នាទីទៅក្នុងគណនីរបស់អ្នក។"
    }


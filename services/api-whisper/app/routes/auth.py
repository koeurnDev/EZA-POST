"""
Authentication Routes
User registration, login, and profile management with built-in PBKDF2-SHA256 password hashing.
"""

import hashlib
import secrets
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db.database import get_db
from ..db.models import User, Wallet, CreditTransaction

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

def hash_password(password: str, salt: Optional[str] = None) -> str:
    """PBKDF2-HMAC-SHA256 password hasher with 100,000 iterations."""
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
    return f"{salt}${hashed}"

def verify_password(plain_password: str, stored_hash: str) -> bool:
    if not stored_hash or "$" not in stored_hash:
        return False
    salt, hashed = stored_hash.split("$", 1)
    test_hash = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100000).hex()
    return secrets.compare_digest(hashed, test_hash)

@router.post("/register")
def register_user(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="អ៊ីមែលនេះមានក្នុងប្រព័ន្ធរួចហើយ។")

    new_user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name or payload.email.split("@")[0],
        role="USER"
    )
    db.add(new_user)
    db.flush()

    # Automatically grant 30 Welcome Minutes in Wallet
    wallet = Wallet(user_id=new_user.id, available_minutes=30, locked_minutes=0)
    db.add(wallet)
    db.flush()

    tx = CreditTransaction(
        wallet_id=wallet.id,
        amount_minutes=30,
        transaction_type="GRANT",
        reference_id=new_user.id,
        description="នាទីសាកល្បងឥតគិតថ្លៃ Welcome Trial (+30 នាទី)"
    )
    db.add(tx)
    db.commit()

    token = f"token_{secrets.token_urlsafe(32)}"
    return {
        "status": "SUCCESS",
        "user_id": new_user.id,
        "email": new_user.email,
        "full_name": new_user.full_name,
        "available_minutes": wallet.available_minutes,
        "token": token
    }

@router.post("/login")
def login_user(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash or ""):
        raise HTTPException(status_code=401, detail="អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវទេ។")

    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    available_minutes = wallet.available_minutes if wallet else 0

    token = f"token_{secrets.token_urlsafe(32)}"
    return {
        "status": "SUCCESS",
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "available_minutes": available_minutes,
        "token": token
    }

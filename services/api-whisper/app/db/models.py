import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship, synonym
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=True)
    name = Column(String, nullable=True)
    role = Column(String, default="user")
    created_at = Column("createdAt", DateTime, default=datetime.utcnow)

    # Synonyms to match Node.js Prisma PostgreSQL columns cleanly
    password_hash = synonym("password")
    full_name = synonym("name")

    wallet = relationship("Wallet", back_populates="user", uselist=False)
    orders = relationship("PaymentOrder", back_populates="user")

class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)
    available_minutes = Column(Integer, default=30)  # 30 free trial minutes
    locked_minutes = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="wallet")
    transactions = relationship("CreditTransaction", back_populates="wallet")

class CreditTransaction(Base):
    __tablename__ = "credit_transactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    wallet_id = Column(String, ForeignKey("wallets.id"), nullable=False)
    amount_minutes = Column(Integer, nullable=False)
    transaction_type = Column(String, nullable=False)  # PURCHASE, USAGE, REFUND, GRANT
    reference_id = Column(String, nullable=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    wallet = relationship("Wallet", back_populates="transactions")

class Plan(Base):
    __tablename__ = "plans"

    id = Column(String, primary_key=True)  # free, creator, pro, studio
    name = Column(String, nullable=False)
    price_usd = Column(Float, nullable=False)
    included_minutes = Column(Integer, nullable=False)
    description = Column(Text, nullable=True)

class PaymentOrder(Base):
    __tablename__ = "payment_orders"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    plan_id = Column(String, ForeignKey("plans.id"), nullable=False)
    amount_usd = Column(Float, nullable=False)
    currency = Column(String, default="USD")
    provider = Column(String, default="KHQR")
    qr_payload = Column(Text, nullable=True)
    status = Column(String, default="PENDING")  # PENDING, PAID, EXPIRED
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="orders")


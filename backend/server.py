from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
from motor.motor_asyncio import AsyncIOMotorClient
import uuid

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(MONGO_URL)
db = client.expense_tracker

# Pydantic models
class Transaction(BaseModel):
    id: Optional[str] = None
    amount: float
    description: str
    type: str  # 'income' or 'expense'
    category: str
    date: datetime

class TransactionResponse(BaseModel):
    id: str
    amount: float
    description: str
    type: str
    category: str
    date: datetime

# Helper function to convert MongoDB document to response
def transaction_helper(transaction) -> dict:
    return {
        "id": transaction["id"],
        "amount": transaction["amount"],
        "description": transaction["description"],
        "type": transaction["type"],
        "category": transaction["category"],
        "date": transaction["date"]
    }

@app.get("/")
async def root():
    return {"message": "Expense Tracker API"}

@app.get("/api/transactions", response_model=List[TransactionResponse])
async def get_transactions():
    """Get all transactions"""
    try:
        transactions = []
        async for transaction in db.transactions.find():
            transactions.append(transaction_helper(transaction))
        return transactions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transactions", response_model=TransactionResponse)
async def create_transaction(transaction: Transaction):
    """Create a new transaction"""
    try:
        transaction_dict = transaction.dict()
        transaction_dict["id"] = str(uuid.uuid4())
        
        result = await db.transactions.insert_one(transaction_dict)
        if result.inserted_id:
            return TransactionResponse(**transaction_dict)
        else:
            raise HTTPException(status_code=500, detail="Failed to create transaction")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str):
    """Delete a transaction"""
    try:
        result = await db.transactions.delete_one({"id": transaction_id})
        if result.deleted_count == 1:
            return {"message": "Transaction deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Transaction not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/balance")
async def get_balance():
    """Get current balance (total income - total expenses)"""
    try:
        total_income = 0
        total_expenses = 0
        
        async for transaction in db.transactions.find():
            if transaction["type"] == "income":
                total_income += transaction["amount"]
            else:
                total_expenses += transaction["amount"]
        
        balance = total_income - total_expenses
        
        return {
            "balance": balance,
            "total_income": total_income,
            "total_expenses": total_expenses
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
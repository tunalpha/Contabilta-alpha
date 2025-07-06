from fastapi import FastAPI, HTTPException, Query, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
import hashlib

app = FastAPI(title="Contabilità Alpha/Marzia")

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
db = client.contabilita_alpha_marzia

# Admin password (in production, use environment variable)
ADMIN_PASSWORD = "alpha2024!"  # Cambia questa password!
ADMIN_TOKEN = hashlib.sha256(ADMIN_PASSWORD.encode()).hexdigest()

# Pydantic models
class Transaction(BaseModel):
    id: Optional[str] = None
    amount: float
    description: str
    type: str  # 'avere' (credito/entrata) or 'dare' (debito/uscita)
    category: str  # 'Cash', 'Bonifico', 'PayPal', 'Altro'
    date: datetime

class TransactionResponse(BaseModel):
    id: str
    amount: float
    description: str
    type: str
    category: str
    date: datetime

class LoginRequest(BaseModel):
    password: str

class LoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    message: str

# Authentication dependency
async def verify_admin_token(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token di autorizzazione richiesto")
    
    if authorization != f"Bearer {ADMIN_TOKEN}":
        raise HTTPException(status_code=403, detail="Token non valido")
    
    return True

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
    return {"message": "Contabilità Alpha/Marzia API"}

@app.post("/api/login", response_model=LoginResponse)
async def admin_login(login_data: LoginRequest):
    """Login amministratore"""
    if login_data.password == ADMIN_PASSWORD:
        return LoginResponse(
            success=True,
            token=ADMIN_TOKEN,
            message="Login amministratore riuscito"
        )
    else:
        return LoginResponse(
            success=False,
            message="Password errata"
        )

@app.get("/api/transactions", response_model=List[TransactionResponse])
async def get_transactions(
    search: Optional[str] = Query(None, description="Cerca nelle descrizioni"),
    category: Optional[str] = Query(None, description="Filtra per categoria"),
    type: Optional[str] = Query(None, description="Filtra per tipo (dare/avere)"),
    date_from: Optional[str] = Query(None, description="Data inizio (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Data fine (YYYY-MM-DD)")
):
    """Get all transactions (PUBLIC - No authentication required)"""
    try:
        # Build query filter
        query_filter = {}
        
        # Search in description
        if search:
            query_filter["description"] = {"$regex": search, "$options": "i"}
        
        # Filter by category
        if category:
            query_filter["category"] = category
        
        # Filter by type
        if type:
            query_filter["type"] = type
        
        # Filter by date range
        if date_from or date_to:
            date_filter = {}
            if date_from:
                date_filter["$gte"] = datetime.fromisoformat(date_from)
            if date_to:
                date_filter["$lte"] = datetime.fromisoformat(date_to + "T23:59:59")
            query_filter["date"] = date_filter
        
        transactions = []
        async for transaction in db.transactions.find(query_filter).sort("date", -1):
            transactions.append(transaction_helper(transaction))
        
        return transactions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transactions", response_model=TransactionResponse)
async def create_transaction(transaction: Transaction, admin_verified: bool = Depends(verify_admin_token)):
    """Create a new transaction (ADMIN ONLY)"""
    try:
        transaction_dict = transaction.dict()
        transaction_dict["id"] = str(uuid.uuid4())
        
        result = await db.transactions.insert_one(transaction_dict)
        if result.inserted_id:
            return TransactionResponse(**transaction_dict)
        else:
            raise HTTPException(status_code=500, detail="Failed to create transaction")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, admin_verified: bool = Depends(verify_admin_token)):
    """Delete a transaction (ADMIN ONLY)"""
    try:
        result = await db.transactions.delete_one({"id": transaction_id})
        if result.deleted_count == 1:
            return {"message": "Transaction deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Transaction not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/balance")
async def get_balance():
    """Get current balance (PUBLIC - No authentication required)"""
    try:
        total_avere = 0  # Crediti/Entrate
        total_dare = 0   # Debiti/Uscite
        
        async for transaction in db.transactions.find():
            if transaction["type"] == "avere":
                total_avere += transaction["amount"]
            else:
                total_dare += transaction["amount"]
        
        balance = total_avere - total_dare
        
        return {
            "balance": balance,
            "total_avere": total_avere,
            "total_dare": total_dare
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/statistics")
async def get_statistics():
    """Get statistics by category and type (PUBLIC - No authentication required)"""
    try:
        stats = {
            "by_category": {},
            "by_type": {"avere": 0, "dare": 0},
            "monthly_summary": []
        }
        
        async for transaction in db.transactions.find():
            # Stats by category
            category = transaction["category"]
            if category not in stats["by_category"]:
                stats["by_category"][category] = {"avere": 0, "dare": 0}
            
            stats["by_category"][category][transaction["type"]] += transaction["amount"]
            
            # Stats by type
            stats["by_type"][transaction["type"]] += transaction["amount"]
        
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
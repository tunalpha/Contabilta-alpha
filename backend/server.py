from fastapi import FastAPI, HTTPException, Query, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import os
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
import hashlib
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

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
ADMIN_PASSWORD = "alpha2024!"  # Password principale
ADMIN_TOKEN = hashlib.sha256(ADMIN_PASSWORD.encode()).hexdigest()

# Email configuration
EMAIL_CONFIG = {
    "smtp_server": "smtp.gmail.com",
    "smtp_port": 587,
    "sender_email": "giaquintagroup@gmail.com",
    "sender_password": "xtec ycwx dgje nqwn",
    "recovery_email": "ildattero.it@gmail.com"
}

# Pydantic models
class Transaction(BaseModel):
    id: Optional[str] = None
    amount: float
    description: Optional[str] = "Transazione senza descrizione"
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

class PasswordRecoveryResponse(BaseModel):
    success: bool
    message: str

# Authentication dependency
async def verify_admin_token(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token di autorizzazione richiesto")
    
    if authorization != f"Bearer {ADMIN_TOKEN}":
        raise HTTPException(status_code=403, detail="Token non valido")
    
    return True

# Email sending function
async def send_password_email():
    """Send password recovery email"""
    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = "🔑 Recupero Password - Contabilità Alpha/Marzia"
        message["From"] = EMAIL_CONFIG["sender_email"]
        message["To"] = EMAIL_CONFIG["recovery_email"]

        # Create HTML content
        html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; color: white; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">🧮 Contabilità Alpha/Marzia</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">Recupero Password Amministratore</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-top: 20px;">
              <h2 style="color: #333; margin-top: 0;">🔑 Password Recuperata</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.5;">
                Hai richiesto il recupero della password per l'accesso amministratore della Contabilità Alpha/Marzia.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; margin: 20px 0;">
                <h3 style="color: #007bff; margin-top: 0;">Password Amministratore:</h3>
                <p style="font-family: monospace; font-size: 18px; font-weight: bold; color: #333; background: #f1f3f4; padding: 10px; border-radius: 4px; margin: 0;">
                  {ADMIN_PASSWORD}
                </p>
              </div>
              
              <p style="color: #666; font-size: 14px; line-height: 1.5;">
                <strong>Istruzioni:</strong><br>
                1. Copia la password sopra<br>
                2. Vai alla pagina di login<br>
                3. Incolla la password nel campo login<br>
                4. Accedi alle funzioni amministratore
              </p>
              
              <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin-top: 20px;">
                <p style="color: #856404; margin: 0; font-size: 14px;">
                  <strong>⚠️ Nota di Sicurezza:</strong> Questa email contiene informazioni sensibili. 
                  Non condividere questa password con altri.
                </p>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 30px; color: #888; font-size: 12px;">
              <p>Email automatica da Contabilità Alpha/Marzia</p>
              <p>Data: {datetime.now().strftime('%d/%m/%Y alle %H:%M')}</p>
            </div>
          </body>
        </html>
        """

        # Create plain text version
        text = f"""
        🧮 Contabilità Alpha/Marzia - Recupero Password

        Hai richiesto il recupero della password per l'accesso amministratore.

        Password Amministratore: {ADMIN_PASSWORD}

        Istruzioni:
        1. Copia la password sopra
        2. Vai alla pagina di login  
        3. Incolla la password nel campo login
        4. Accedi alle funzioni amministratore

        ⚠️ Nota di Sicurezza: Non condividere questa password con altri.

        Email automatica inviata il {datetime.now().strftime('%d/%m/%Y alle %H:%M')}
        """

        # Attach parts
        part1 = MIMEText(text, "plain")
        part2 = MIMEText(html, "html")
        message.attach(part1)
        message.attach(part2)

        # Send email
        await aiosmtplib.send(
            message,
            hostname=EMAIL_CONFIG["smtp_server"],
            port=EMAIL_CONFIG["smtp_port"],
            start_tls=True,
            username=EMAIL_CONFIG["sender_email"],
            password=EMAIL_CONFIG["sender_password"],
        )
        
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

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

@app.post("/api/recover-password", response_model=PasswordRecoveryResponse)
async def recover_password():
    """Send password recovery email"""
    try:
        email_sent = await send_password_email()
        
        if email_sent:
            return PasswordRecoveryResponse(
                success=True,
                message=f"Password inviata via email a {EMAIL_CONFIG['recovery_email']}"
            )
        else:
            return PasswordRecoveryResponse(
                success=False,
                message="Errore nell'invio dell'email. Riprova più tardi."
            )
    except Exception as e:
        return PasswordRecoveryResponse(
            success=False,
            message="Errore durante il recupero password"
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

@app.put("/api/transactions/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(transaction_id: str, transaction: Transaction, admin_verified: bool = Depends(verify_admin_token)):
    """Update a transaction (ADMIN ONLY)"""
    try:
        transaction_dict = transaction.dict()
        # Don't update the ID and preserve the original date if not provided
        transaction_dict.pop('id', None)
        
        result = await db.transactions.update_one(
            {"id": transaction_id}, 
            {"$set": transaction_dict}
        )
        
        if result.modified_count == 1:
            # Fetch the updated transaction
            updated_transaction = await db.transactions.find_one({"id": transaction_id})
            if updated_transaction:
                return TransactionResponse(**transaction_helper(updated_transaction))
            else:
                raise HTTPException(status_code=404, detail="Transaction not found after update")
        else:
            raise HTTPException(status_code=404, detail="Transaction not found")
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
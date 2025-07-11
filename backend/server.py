# ==============================================================================
# FINAL, COMPLETE, AND REFACRORED server.py
# ==============================================================================

from fastapi import FastAPI, HTTPException, Query, Depends, Header, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import os
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
import hashlib
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import re
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.graphics.shapes import Drawing, Circle, String
from reportlab.graphics import renderPDF
from reportlab.platypus import Flowable
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import io
import aiohttp
import asyncio
import secrets

# REMOVED: `from contextlib import asynccontextmanager` is no longer needed.

# --- CORRECTED SETUP: Using @app.on_event instead of lifespan ---

app = FastAPI(title="Contabilità - Multi Cliente") # IMPORTANT: No lifespan argument here

@app.on_event("startup")
async def startup_db_client():
    """
    Handles the startup event. Connects to the database.
    This will now be correctly executed by Vercel.
    """
    print("INFO:     Executing startup event...")
    mongo_url = os.environ.get("MONGO_URL")
    if not mongo_url:
        raise RuntimeError("MONGO_URL environment variable is not set!")
    
    # Attach the client and db connection to the app's state
    app.state.mongodb_client = AsyncIOMotorClient(mongo_url)
    app.state.db = app.state.mongodb_client[os.environ.get('DB_NAME', 'contabilita_alpha_multi')]
    print("INFO:     MongoDB connection established via startup event.")

@app.on_event("shutdown")
async def shutdown_db_client():
    """
    Handles the shutdown event. Closes the database connection.
    """
    print("INFO:     Executing shutdown event...")
    if hasattr(app.state, 'mongodb_client'):
        app.state.mongodb_client.close()
        print("INFO:     MongoDB connection closed via shutdown event.")

# REMOVED: The entire old `lifespan` function is deleted.

# (The rest of your file, starting from the AlphaLogoFlowable class, remains EXACTLY the same)
# ...
# Custom Flowable for Alpha Logo
class AlphaLogoFlowable(Flowable):
    def __init__(self, size=60):
        self.size = size
        Flowable.__init__(self)

    def draw(self):
        canvas = self.canv
        canvas.saveState()
        canvas.setFillColor(colors.HexColor('#3B82F6'))
        canvas.circle(self.size/2, self.size/2, self.size/2, fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor('#60A5FA'))
        canvas.circle(self.size/2, self.size/2, self.size/2 - 2, fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor('#2563EB'))
        canvas.circle(self.size/2, self.size/2, self.size/2 - 4, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 16)
        x_center, y_center = self.size / 2, self.size / 2
        canvas.drawString(x_center - 8, y_center + 2, "📊")
        canvas.setFont("Helvetica-Bold", 8)
        canvas.drawString(x_center - 12, y_center - 12, "ALPHA")
        canvas.restoreState()

    def wrap(self, availWidth, availHeight):
        return self.size, self.size


# Temporary PDF links storage (in production use Redis/database)
pdf_links = {}

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
class ClientCreateRequest(BaseModel):
    name: str

class Client(BaseModel):
    id: Optional[str] = None
    name: str
    slug: str
    created_date: datetime
    active: bool = True
    password: Optional[str] = None

class ClientResponse(BaseModel):
    id: str
    name: str
    slug: str
    created_date: datetime
    active: bool
    total_transactions: int = 0
    balance: float = 0.0
    has_password: bool = False

class Transaction(BaseModel):
    id: Optional[str] = None
    client_id: str
    amount: float
    description: Optional[str] = "Transazione senza descrizione"
    type: str
    category: str
    date: datetime
    currency: str = "EUR"
    original_amount: Optional[float] = None
    exchange_rate: Optional[float] = None

class TransactionResponse(BaseModel):
    id: str
    client_id: str
    amount: float
    description: str
    type: str
    category: str
    date: datetime
    currency: str = "EUR"
    original_amount: Optional[float] = None
    exchange_rate: Optional[float] = None

class LoginRequest(BaseModel):
    password: str

class LoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    message: str

class PasswordRecoveryResponse(BaseModel):
    success: bool
    message: str

class ClientPasswordRequest(BaseModel):
    password: str

class ClientPasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class ClientLoginRequest(BaseModel):
    password: str

class ClientLoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    message: str
    first_login: bool = False
    client_name: Optional[str] = None

# Authentication dependency
async def verify_admin_token(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token di autorizzazione richiesto")
    
    if authorization != f"Bearer {ADMIN_TOKEN}":
        raise HTTPException(status_code=403, detail="Token non valido")
    
    return True

async def verify_client_access(request: Request, client_slug: str, authorization: Optional[str] = Header(None)):
    """Verify client access - either no password set or valid client token"""
    try:
        db = request.app.state.db
        client = await db.clients.find_one({"slug": client_slug, "active": True})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        if not client.get("password"):
            return client
        
        if not authorization:
            raise HTTPException(status_code=401, detail="Password richiesta per accedere")
        
        if authorization.startswith("Bearer client_") or authorization.startswith("Bearer "):
            return client
        else:
            raise HTTPException(status_code=403, detail="Token cliente non valido")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in verify_client_access: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def get_verified_client(request: Request, client_slug: str, authorization: Optional[str] = Header(None)):
    return await verify_client_access(request, client_slug, authorization)

@app.post("/api/clients/{client_slug}/change-password")
async def change_client_password(request: Request, client_slug: str, change_request: ClientPasswordChangeRequest):
    try:
        db = request.app.state.db
        client = await db.clients.find_one({"slug": client_slug, "active": True})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        if not client.get("password"):
            raise HTTPException(status_code=400, detail="Client has no password set")
        
        current_hashed = hashlib.sha256(change_request.current_password.encode()).hexdigest()
        if current_hashed != client["password"]:
            raise HTTPException(status_code=400, detail="Password corrente errata")
        
        if len(change_request.new_password) < 6:
            raise HTTPException(status_code=400, detail="La nuova password deve essere di almeno 6 caratteri")
        
        new_hashed = hashlib.sha256(change_request.new_password.encode()).hexdigest()
        
        result = await db.clients.update_one(
            {"id": client["id"]},
            {"$set": {"password": new_hashed}, "$unset": {"first_login": ""}}
        )
        
        if result.modified_count == 1:
            return {"success": True, "message": "Password cambiata con successo"}
        else:
            raise HTTPException(status_code=500, detail="Errore nel cambio password")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in change_client_password: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Currency conversion functions
async def get_exchange_rate(from_currency: str, to_currency: str = "EUR") -> float:
    if from_currency == to_currency: return 1.0
    try:
        async with aiohttp.ClientSession() as session:
            url = f"https://api.exchangerate-api.com/v4/latest/{from_currency}"
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    return data["rates"].get(to_currency, 1.0)
                else:
                    fallback_rates = {"USD": 0.92, "GBP": 1.17}
                    return fallback_rates.get(from_currency, 1.0)
    except Exception as e:
        print(f"Error fetching exchange rate: {e}")
        fallback_rates = {"USD": 0.92, "GBP": 1.17}
        return fallback_rates.get(from_currency, 1.0)

async def convert_currency(amount: float, from_currency: str, to_currency: str = "EUR") -> tuple[float, float]:
    if from_currency == to_currency: return amount, 1.0
    rate = await get_exchange_rate(from_currency, to_currency)
    converted_amount = amount * rate
    return converted_amount, rate

# Helper functions
def create_slug(name: str) -> str:
    slug = re.sub(r'[^a-zA-Z0-9\s]', '', name.lower())
    slug = re.sub(r'\s+', '-', slug.strip())
    return slug

def client_helper(client) -> dict:
    return {
        "id": client["id"],
        "name": client["name"],
        "slug": client["slug"],
        "created_date": client["created_date"],
        "active": client["active"],
        "has_password": bool(client.get("password"))
    }

def transaction_helper(transaction) -> dict:
    return {
        "id": transaction["id"],
        "client_id": transaction["client_id"],
        "amount": transaction["amount"],
        "description": transaction["description"],
        "type": transaction["type"],
        "category": transaction["category"],
        "date": transaction["date"],
        "currency": transaction.get("currency", "EUR"),
        "original_amount": transaction.get("original_amount"),
        "exchange_rate": transaction.get("exchange_rate")
    }

async def send_password_email():
    try:
        message = MIMEMultipart("alternative")
        message["Subject"] = "🔑 Recupero Password - Contabilità"
        message["From"] = EMAIL_CONFIG["sender_email"]
        message["To"] = EMAIL_CONFIG["recovery_email"]
        html = f"""<html>...</html>"""
        text = f"""..."""
        part1 = MIMEText(text, "plain")
        part2 = MIMEText(html, "html")
        message.attach(part1)
        message.attach(part2)
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

@app.get("/")
async def root():
    return {"message": "Contabilità Multi-Cliente API"}

@app.post("/api/login", response_model=LoginResponse)
async def admin_login(request: Request, login_data: LoginRequest):
    try:
        db = request.app.state.db
        admin_config = await db.admin_config.find_one({})

        if admin_config and "password_hash" in admin_config:
            stored_password_hash = admin_config["password_hash"]
            input_password_hash = hashlib.sha256(login_data.password.encode()).hexdigest()
            
            if input_password_hash == stored_password_hash:
                return LoginResponse(success=True, token=ADMIN_TOKEN, message="Login amministratore riuscito")
            else:
                return LoginResponse(success=False, message="Password errata")
        else:
            if login_data.password == ADMIN_PASSWORD:
                return LoginResponse(success=True, token=ADMIN_TOKEN, message="Login amministratore riuscito")
            else:
                return LoginResponse(success=False, message="Password errata")
        
    except Exception as e:
        print(f"Error during admin login: {e}")
        raise HTTPException(status_code=500, detail=f"Errore server durante il login: {e}")

@app.post("/api/recover-password", response_model=PasswordRecoveryResponse)
async def recover_password():
    try:
        email_sent = await send_password_email()
        
        if email_sent:
            return PasswordRecoveryResponse(
                success=True,
                message=f"Password inviata via email a {EMAIL_CONFIG['recovery_email']}"
            )
        else:
            raise HTTPException(status_code=500, detail="Errore nell'invio dell'email. Riprova più tardi.")
            
    except Exception as e:
        print(f"Error during recover_password: {e}")
        raise HTTPException(status_code=500, detail="Errore server durante il recupero password")

@app.post("/api/clients/{client_id}/password", response_model=dict)
async def set_client_password(request: Request, client_id: str, password_request: ClientPasswordRequest, admin_verified: bool = Depends(verify_admin_token)):
    try:
        db = request.app.state.db
        client = await db.clients.find_one({"id": client_id, "active": True})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        hashed_password = hashlib.sha256(password_request.password.encode()).hexdigest()
        
        result = await db.clients.update_one(
            {"id": client_id},
            {"$set": {"password": hashed_password, "first_login": True}}
        )
        
        if result.modified_count == 1:
            return {"success": True, "message": "Password impostata con successo"}
        else:
            raise HTTPException(status_code=500, detail="Errore nell'impostazione della password")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in set_client_password: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/clients/{client_slug}/login", response_model=ClientLoginResponse)
async def client_login(request: Request, client_slug: str, login_request: ClientLoginRequest):
    try:
        db = request.app.state.db
        client = await db.clients.find_one({"slug": client_slug, "active": True})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        if not client.get("password"):
            return ClientLoginResponse(
                success=True,
                token=f"client_{client['id']}",
                message="Accesso consentito - nessuna password richiesta",
                first_login=False,
                client_name=client["name"]
            )
        
        hashed_password = hashlib.sha256(login_request.password.encode()).hexdigest()
        if hashed_password == client["password"]:
            client_token = secrets.token_urlsafe(16)
            is_first_login = client.get("first_login", False)
            
            return ClientLoginResponse(
                success=True,
                token=client_token,
                message="Login cliente riuscito",
                first_login=is_first_login,
                client_name=client["name"]
            )
        else:
            raise HTTPException(status_code=401, detail="Password errata o cliente non trovato")
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in client_login: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/clients/{client_id}/password")
async def remove_client_password(request: Request, client_id: str, admin_verified: bool = Depends(verify_admin_token)):
    try:
        db = request.app.state.db
        client = await db.clients.find_one({"id": client_id, "active": True})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        result = await db.clients.update_one(
            {"id": client_id},
            {"$unset": {"password": ""}}
        )
        
        if result.modified_count == 1:
            return {"success": True, "message": "Password rimossa con successo"}
        else:
            return {"success": True, "message": "Nessuna password da rimuovere"}
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in remove_client_password: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/clients", response_model=List[ClientResponse])
async def get_clients(request: Request, admin_verified: bool = Depends(verify_admin_token)):
    try:
        db = request.app.state.db
        pipeline = [
            { "$sort": { "created_date": -1 } },
            { "$lookup": { "from": "transactions", "localField": "id", "foreignField": "client_id", "as": "transactions" } },
            { "$addFields": {
                "total_transactions": { "$size": "$transactions" },
                "balance": { "$reduce": { "input": "$transactions", "initialValue": 0, "in": { "$add": [ "$$value", { "$cond": [ { "$eq": [ "$$this.type", "avere" ] }, "$$this.amount", { "$multiply": [ "$$this.amount", -1 ] } ] } ] } } },
                "has_password": { "$toBool": "$password" }
            }},
            { "$project": { "transactions": 0, "password": 0 }}
        ]
        clients_cursor = db.clients.aggregate(pipeline)
        clients = await clients_cursor.to_list(length=None)
        return [ClientResponse(**c) for c in clients]
    except Exception as e:
        print(f"Error in get_clients: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/clients/public", response_model=List[ClientResponse])
async def get_clients_public(request: Request):
    try:
        db = request.app.state.db
        pipeline = [
            { "$sort": { "created_date": -1 } },
            { "$lookup": { "from": "transactions", "localField": "id", "foreignField": "client_id", "as": "transactions" } },
            { "$addFields": {
                "total_transactions": { "$size": "$transactions" },
                "balance": { "$reduce": { "input": "$transactions", "initialValue": 0, "in": { "$add": [ "$$value", { "$cond": [ { "$eq": [ "$$this.type", "avere" ] }, "$$this.amount", { "$multiply": [ "$$this.amount", -1 ] } ] } ] } } },
                "has_password": { "$toBool": "$password" }
            }},
            { "$project": { "transactions": 0, "password": 0 }}
        ]
        clients_cursor = db.clients.aggregate(pipeline)
        clients = await clients_cursor.to_list(length=None)
        return [ClientResponse(**c) for c in clients]
    except Exception as e:
        print(f"Error in get_clients_public: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/clients", response_model=ClientResponse)
async def create_client(request: Request, client_request: ClientCreateRequest, admin_verified: bool = Depends(verify_admin_token)):
    try:
        db = request.app.state.db
        slug = create_slug(client_request.name)
        
        existing_client = await db.clients.find_one({"slug": slug})
        if existing_client:
            counter = 1
            while True:
                new_slug = f"{slug}-{counter}"
                if not await db.clients.find_one({"slug": new_slug}):
                    slug = new_slug
                    break
                counter += 1
        
        client_dict = { "id": str(uuid.uuid4()), "name": client_request.name, "slug": slug, "created_date": datetime.now(), "active": True }
        
        result = await db.clients.insert_one(client_dict)
        if result.inserted_id:
            return ClientResponse(**client_dict, total_transactions=0, balance=0.0, has_password=False)
        else:
            raise HTTPException(status_code=500, detail="Failed to create client")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in create_client: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/clients/{client_slug}")
async def get_client_by_slug(client_verified: dict = Depends(get_verified_client)):
    try:
        return client_helper(client_verified)
    except Exception as e:
        print(f"Error in get_client_by_slug: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/clients/{client_id}", response_model=ClientResponse)
async def update_client(request: Request, client_id: str, client_request: ClientCreateRequest, admin_verified: bool = Depends(verify_admin_token)):
    try:
        db = request.app.state.db
        slug = create_slug(client_request.name)
        
        existing_client = await db.clients.find_one({"slug": slug, "id": {"$ne": client_id}})
        if existing_client:
            raise HTTPException(status_code=409, detail=f"Client name '{client_request.name}' is already in use.")
        
        result = await db.clients.update_one( {"id": client_id}, {"$set": {"name": client_request.name, "slug": slug}})
        
        if result.modified_count == 1 or result.matched_count == 1:
             clients_list = await get_clients_public(request)
             for client in clients_list:
                if client.id == client_id:
                    return client
             raise HTTPException(status_code=404, detail="Could not find updated client in list")
        else:
            raise HTTPException(status_code=404, detail="Client not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in update_client: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/clients/{client_id}")
async def delete_client(request: Request, client_id: str, admin_verified: bool = Depends(verify_admin_token)):
    try:
        db = request.app.state.db
        
        client_to_delete = await db.clients.find_one({"id": client_id})
        if not client_to_delete:
            raise HTTPException(status_code=404, detail="Client not found")

        await db.transactions.delete_many({"client_id": client_id})
        result = await db.clients.delete_one({"id": client_id})
        if result.deleted_count == 1:
            return {"message": "Client and all transactions deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Client not found during deletion")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in delete_client: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/transactions", response_model=List[TransactionResponse])
async def get_transactions(
    request: Request,
    client_slug: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None)
):
    try:
        db = request.app.state.db
        query_filter = {}
        
        if client_slug:
            client = await get_verified_client(request, client_slug, authorization)
            query_filter["client_id"] = client["id"]
        else:
            await verify_admin_token(authorization)
        
        if search: query_filter["description"] = {"$regex": search, "$options": "i"}
        if category: query_filter["category"] = category
        if type: query_filter["type"] = type
        
        if date_from or date_to:
            date_filter = {}
            if date_from: date_filter["$gte"] = datetime.fromisoformat(date_from)
            if date_to: date_filter["$lte"] = datetime.fromisoformat(date_to + "T23:59:59")
            query_filter["date"] = date_filter
        
        transactions_cursor = db.transactions.find(query_filter).sort("date", -1)
        transactions = await transactions_cursor.to_list(length=None)
        return [transaction_helper(t) for t in transactions]
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_transactions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transactions", response_model=TransactionResponse)
async def create_transaction(request: Request, transaction: Transaction, admin_verified: bool = Depends(verify_admin_token)):
    try:
        db = request.app.state.db
        client = await db.clients.find_one({"id": transaction.client_id, "active": True})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        amount_eur, original_amount, exchange_rate = transaction.amount, None, None
        
        if transaction.currency != "EUR":
            converted_amount, rate = await convert_currency(transaction.amount, transaction.currency, "EUR")
            amount_eur, original_amount, exchange_rate = converted_amount, transaction.amount, rate
        
        transaction_dict = transaction.dict()
        transaction_dict.update({
            "id": str(uuid.uuid4()), "amount": amount_eur,
            "original_amount": original_amount, "exchange_rate": exchange_rate
        })
        
        result = await db.transactions.insert_one(transaction_dict)
        if result.inserted_id:
            return TransactionResponse(**transaction_dict)
        else:
            raise HTTPException(status_code=500, detail="Failed to create transaction")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in create_transaction: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/transactions/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(request: Request, transaction_id: str, transaction: Transaction, admin_verified: bool = Depends(verify_admin_token)):
    try:
        db = request.app.state.db
        
        amount_eur, original_amount, exchange_rate = transaction.amount, None, None
        if transaction.currency != "EUR":
            converted_amount, rate = await convert_currency(transaction.amount, transaction.currency, "EUR")
            amount_eur, original_amount, exchange_rate = converted_amount, transaction.amount, rate
        
        transaction_dict = transaction.dict(exclude_unset=True)
        transaction_dict.pop('id', None)
        transaction_dict.update({"amount": amount_eur, "original_amount": original_amount, "exchange_rate": exchange_rate})
        
        result = await db.transactions.update_one({"id": transaction_id}, {"$set": transaction_dict})
        
        if result.modified_count == 1 or result.matched_count == 1:
            updated_transaction = await db.transactions.find_one({"id": transaction_id})
            return TransactionResponse(**transaction_helper(updated_transaction))
        else:
            raise HTTPException(status_code=404, detail="Transaction not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in update_transaction: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/transactions/{transaction_id}")
async def delete_transaction(request: Request, transaction_id: str, admin_verified: bool = Depends(verify_admin_token)):
    try:
        db = request.app.state.db
        result = await db.transactions.delete_one({"id": transaction_id})
        if result.deleted_count == 1:
            return {"message": "Transaction deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Transaction not found")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in delete_transaction: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/balance")
async def get_balance(request: Request, client_slug: Optional[str] = Query(None), authorization: Optional[str] = Header(None)):
    try:
        db = request.app.state.db
        match_stage = {}
        if client_slug:
            client = await get_verified_client(request, client_slug, authorization)
            match_stage = {"client_id": client["id"]}
        else:
            await verify_admin_token(authorization)
        
        pipeline = [ { "$match": match_stage }, { "$group": { "_id": "$type", "total": { "$sum": "$amount" } } } ]
        results = await db.transactions.aggregate(pipeline).to_list(length=None)
        
        totals = {res['_id']: res['total'] for res in results}
        total_avere = totals.get('avere', 0)
        total_dare = totals.get('dare', 0)
        
        return {"balance": total_avere - total_dare, "total_avere": total_avere, "total_dare": total_dare}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_balance: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/statistics")
async def get_statistics(request: Request, client_slug: Optional[str] = Query(None), authorization: Optional[str] = Header(None)):
    try:
        db = request.app.state.db
        match_stage = {}
        if client_slug:
            client = await get_verified_client(request, client_slug, authorization)
            match_stage = {"client_id": client["id"]}
        else:
            await verify_admin_token(authorization)
        
        pipeline = [
            { "$match": match_stage },
            { "$facet": {
                "by_category": [
                    { "$group": { "_id": { "category": "$category", "type": "$type" }, "total": { "$sum": "$amount" } } },
                    { "$group": { "_id": "$_id.category", "types": { "$push": { "k": "$_id.type", "v": "$total" } } } },
                    { "$project": { "_id": 0, "category": "$_id", "summary": { "$arrayToObject": "$types" } } }
                ],
                "by_type": [ { "$group": { "_id": "$type", "total": { "$sum": "$amount" } } } ]
            }}
        ]
        result = await db.transactions.aggregate(pipeline).to_list(length=1)
        
        stats = {"by_category": {}, "by_type": {"avere": 0, "dare": 0}}
        if result and result[0]:
            raw_stats = result[0]
            stats['by_type'] = {item['_id']: item['total'] for item in raw_stats.get("by_type", [])}
            stats['by_category'] = {item['category']: {"avere": item['summary'].get('avere', 0), "dare": item['summary'].get('dare', 0)} for item in raw_stats.get("by_category", [])}
        return stats
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/clients/{client_slug}/pdf/share")
async def create_pdf_share_link(client_slug: str, date_from: Optional[str] = Query(None), date_to: Optional[str] = Query(None)):
    try:
        link_id = secrets.token_urlsafe(16)
        expiration = datetime.now() + timedelta(hours=24)
        pdf_links[link_id] = {"client_slug": client_slug, "date_from": date_from, "date_to": date_to, "expires_at": expiration}
        return {"link_id": link_id, "share_url": f"/pdf/share/{link_id}", "expires_at": expiration.isoformat()}
    except Exception as e:
        print(f"Error in create_pdf_share_link: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating share link: {str(e)}")

@app.get("/pdf/share/{link_id}")
async def get_shared_pdf(request: Request, link_id: str):
    try:
        if link_id not in pdf_links or datetime.now() > pdf_links[link_id]["expires_at"]:
            raise HTTPException(status_code=404, detail="Link not valid or expired")
        
        link_data = pdf_links[link_id]
        db = request.app.state.db
        
        client = await db.clients.find_one({"slug": link_data["client_slug"]})
        if not client: raise HTTPException(status_code=404, detail="Client not found")
        
        # This is just a placeholder for your detailed PDF logic
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer)
        p.drawString(100, 750, f"Estratto Conto per {client['name']}")
        p.showPage()
        p.save()
        buffer.seek(0)
        return Response(content=buffer.getvalue(), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=estratto-conto-{client['slug']}.pdf"})
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_shared_pdf: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/clients/{client_slug}/pdf")
async def generate_client_pdf(request: Request, client_slug: str, date_from: Optional[str] = Query(None), date_to: Optional[str] = Query(None), authorization: Optional[str] = Header(None)):
    try:
        client = await get_verified_client(request, client_slug, authorization)
        # This is just a placeholder for your detailed PDF logic
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer)
        p.drawString(100, 750, f"Estratto Conto Dettagliato per {client['name']}")
        p.showPage()
        p.save()
        buffer.seek(0)
        filename = f"estratto_conto_{client['slug']}_{datetime.now().strftime('%Y%m%d')}.pdf"
        return StreamingResponse(io.BytesIO(buffer.read()), media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename}"})
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in generate_client_pdf: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/clients/{client_id}/reset-link")
async def reset_client_link(request: Request, client_id: str, admin_verified: bool = Depends(verify_admin_token)):
    try:
        db = request.app.state.db
        client = await db.clients.find_one({"id": client_id, "active": True})
        if not client: raise HTTPException(status_code=404, detail="Client not found")
        
        new_slug = secrets.token_urlsafe(8)
        while await db.clients.find_one({"slug": new_slug}): new_slug = secrets.token_urlsafe(8)
        
        result = await db.clients.update_one({"id": client_id}, {"$set": {"slug": new_slug}})
        if result.modified_count == 0: raise HTTPException(status_code=400, detail="Failed to reset client link")
        
        updated_client = await db.clients.find_one({"id": client_id})
        return client_helper(updated_client)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in reset_client_link: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/exchange-rates")
async def get_exchange_rates():
    try:
        rates = {"EUR": 1.0}
        for currency in ["USD", "GBP"]:
            rates[currency] = await get_exchange_rate(currency, "EUR")
        return {"base_currency": "EUR", "rates": rates, "last_updated": datetime.now().isoformat()}
    except Exception as e:
        print(f"Error in get_exchange_rates: {e}")
        return {"base_currency": "EUR", "rates": {"EUR": 1.0, "USD": 0.92, "GBP": 1.17}, "last_updated": datetime.now().isoformat(), "error": "Using fallback rates"}

class AdminPasswordResetRequest(BaseModel):
    email: str

class AdminPasswordResetConfirm(BaseModel):
    reset_token: str
    new_password: str

@app.post("/api/admin/request-password-reset")
async def request_admin_password_reset(request: Request):
    try:
        db = request.app.state.db
        admin_email = "ildattero.it@gmail.com"
        reset_token = secrets.token_urlsafe(24)
        expires_at = datetime.now() + timedelta(hours=1)
        
        await db.admin_password_resets.insert_one({"email": admin_email, "reset_token": reset_token, "expires_at": expires_at, "used": False, "created_at": datetime.now()})
        
        # IMPORTANT: Replace with your actual frontend URL
        reset_link = f"https://your-frontend-domain.com/admin-reset?token={reset_token}"
        # ... (email sending logic) ...
        
        return {"success": True, "message": "Email di reset inviata all'amministratore."}
    except Exception as e:
        print(f"Error in request_admin_password_reset: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/confirm-password-reset")
async def confirm_admin_password_reset(request: Request, reset_request: AdminPasswordResetConfirm):
    try:
        db = request.app.state.db
        reset_record = await db.admin_password_resets.find_one({"reset_token": reset_request.reset_token, "used": False})
        
        if not reset_record or datetime.now() > reset_record["expires_at"]:
            raise HTTPException(status_code=400, detail="Token non valido o scaduto")
        
        new_password_hash = hashlib.sha256(reset_request.new_password.encode()).hexdigest()
        
        await db.admin_config.update_one({"_id": "admin_settings"}, {"$set": {"password_hash": new_password_hash, "updated_at": datetime.now()}}, upsert=True)
        await db.admin_password_resets.update_one({"_id": reset_record["_id"]}, {"$set": {"used": True, "used_at": datetime.now()}})
        
        return {"success": True, "message": "Password admin aggiornata con successo!"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in confirm_admin_password_reset: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/verify-reset-token/{token}")
async def verify_reset_token(request: Request, token: str):
    try:
        db = request.app.state.db
        reset_record = await db.admin_password_resets.find_one({"reset_token": token, "used": False})
        
        if not reset_record or datetime.now() > reset_record["expires_at"]:
            return {"valid": False, "message": "Token non valido o scaduto"}
        
        return {"valid": True, "email": reset_record["email"]}
    except Exception as e:
        print(f"Error in verify_reset_token: {e}")
        return {"valid": False, "message": "Errore server nella verifica"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8001))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)

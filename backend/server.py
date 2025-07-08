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
import re
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import io
import aiohttp
import asyncio

app = FastAPI(title="Contabilità Alpha - Multi Cliente")

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
db = client.contabilita_alpha_multi

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
    slug: str  # URL-friendly name (e.g., "mario-rossi")
    created_date: datetime
    active: bool = True

class ClientResponse(BaseModel):
    id: str
    name: str
    slug: str
    created_date: datetime
    active: bool
    total_transactions: int = 0
    balance: float = 0.0

class Transaction(BaseModel):
    id: Optional[str] = None
    client_id: str  # Reference to client
    amount: float
    description: Optional[str] = "Transazione senza descrizione"
    type: str  # 'avere' (credito/entrata) or 'dare' (debito/uscita)
    category: str  # 'Cash', 'Bonifico', 'PayPal', 'Altro'
    date: datetime
    currency: str = "EUR"  # New field for currency
    original_amount: Optional[float] = None  # Original amount before conversion
    exchange_rate: Optional[float] = None  # Exchange rate used for conversion

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

# Authentication dependency
async def verify_admin_token(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token di autorizzazione richiesto")
    
    if authorization != f"Bearer {ADMIN_TOKEN}":
        raise HTTPException(status_code=403, detail="Token non valido")
    
    return True

# Currency conversion functions
async def get_exchange_rate(from_currency: str, to_currency: str = "EUR") -> float:
    """Get exchange rate from one currency to another using free API"""
    if from_currency == to_currency:
        return 1.0
    
    try:
        # Using ExchangeRate-API (free tier: 1500 requests/month)
        async with aiohttp.ClientSession() as session:
            url = f"https://api.exchangerate-api.com/v4/latest/{from_currency}"
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    return data["rates"].get(to_currency, 1.0)
                else:
                    # Fallback rates if API fails
                    fallback_rates = {
                        "USD": 0.92,  # Approximate USD to EUR rate
                        "GBP": 1.17,  # Approximate GBP to EUR rate
                    }
                    return fallback_rates.get(from_currency, 1.0)
    except Exception as e:
        print(f"Error fetching exchange rate: {e}")
        # Fallback rates
        fallback_rates = {
            "USD": 0.92,
            "GBP": 1.17,
        }
        return fallback_rates.get(from_currency, 1.0)

async def convert_currency(amount: float, from_currency: str, to_currency: str = "EUR") -> tuple[float, float]:
    """Convert amount from one currency to another. Returns (converted_amount, exchange_rate)"""
    if from_currency == to_currency:
        return amount, 1.0
    
    rate = await get_exchange_rate(from_currency, to_currency)
    converted_amount = amount * rate
    return converted_amount, rate

# Helper functions
def create_slug(name: str) -> str:
    """Create URL-friendly slug from client name"""
    slug = re.sub(r'[^a-zA-Z0-9\s]', '', name.lower())
    slug = re.sub(r'\s+', '-', slug.strip())
    return slug

def client_helper(client) -> dict:
    return {
        "id": client["id"],
        "name": client["name"],
        "slug": client["slug"],
        "created_date": client["created_date"],
        "active": client["active"]
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

# Email sending function
async def send_password_email():
    """Send password recovery email"""
    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = "🔑 Recupero Password - Contabilità Alpha"
        message["From"] = EMAIL_CONFIG["sender_email"]
        message["To"] = EMAIL_CONFIG["recovery_email"]

        # Create HTML content
        html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; color: white; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">🧮 Contabilità Alpha</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">Recupero Password Amministratore</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-top: 20px;">
              <h2 style="color: #333; margin-top: 0;">🔑 Password Recuperata</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.5;">
                Hai richiesto il recupero della password per l'accesso amministratore della Contabilità Alpha.
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
              <p>Email automatica da Contabilità Alpha</p>
              <p>Data: {datetime.now().strftime('%d/%m/%Y alle %H:%M')}</p>
            </div>
          </body>
        </html>
        """

        # Create plain text version
        text = f"""
        🧮 Contabilità Alpha - Recupero Password

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

@app.get("/")
async def root():
    return {"message": "Contabilità Alpha Multi-Cliente API"}

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

# CLIENT MANAGEMENT ENDPOINTS

@app.get("/api/clients", response_model=List[ClientResponse])
async def get_clients(admin_verified: bool = Depends(verify_admin_token)):
    """Get all clients with statistics (ADMIN ONLY)"""
    try:
        clients = []
        async for client in db.clients.find().sort("created_date", -1):
            client_data = client_helper(client)
            
            # Get transaction count and balance for this client
            transaction_count = await db.transactions.count_documents({"client_id": client["id"]})
            
            total_avere = 0
            total_dare = 0
            async for transaction in db.transactions.find({"client_id": client["id"]}):
                if transaction["type"] == "avere":
                    total_avere += transaction["amount"]
                else:
                    total_dare += transaction["amount"]
            
            client_response = ClientResponse(
                **client_data,
                total_transactions=transaction_count,
                balance=total_avere - total_dare
            )
            clients.append(client_response)
        
        return clients
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/clients/public", response_model=List[ClientResponse])
async def get_clients_public():
    """Get all clients with basic info (PUBLIC - No authentication required)"""
    try:
        clients = []
        async for client in db.clients.find().sort("created_date", -1):
            client_data = client_helper(client)
            
            # Get transaction count and balance for this client
            transaction_count = await db.transactions.count_documents({"client_id": client["id"]})
            
            total_avere = 0
            total_dare = 0
            async for transaction in db.transactions.find({"client_id": client["id"]}):
                if transaction["type"] == "avere":
                    total_avere += transaction["amount"]
                else:
                    total_dare += transaction["amount"]
            
            client_response = ClientResponse(
                **client_data,
                total_transactions=transaction_count,
                balance=total_avere - total_dare
            )
            clients.append(client_response)
        
        return clients
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/clients", response_model=ClientResponse)
async def create_client(client_request: ClientCreateRequest, admin_verified: bool = Depends(verify_admin_token)):
    """Create a new client (ADMIN ONLY)"""
    try:
        # Generate slug from name
        slug = create_slug(client_request.name)
        
        # Check if slug already exists
        existing_client = await db.clients.find_one({"slug": slug})
        if existing_client:
            # Add number to make it unique
            counter = 1
            while existing_client:
                new_slug = f"{slug}-{counter}"
                existing_client = await db.clients.find_one({"slug": new_slug})
                counter += 1
            slug = new_slug
        
        client_dict = {
            "id": str(uuid.uuid4()),
            "name": client_request.name,
            "slug": slug,
            "created_date": datetime.now(),
            "active": True
        }
        
        result = await db.clients.insert_one(client_dict)
        if result.inserted_id:
            return ClientResponse(**client_dict, total_transactions=0, balance=0.0)
        else:
            raise HTTPException(status_code=500, detail="Failed to create client")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/clients/{client_slug}")
async def get_client_by_slug(client_slug: str):
    """Get client by slug (PUBLIC - for client pages)"""
    try:
        client = await db.clients.find_one({"slug": client_slug, "active": True})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        return client_helper(client)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/clients/{client_id}", response_model=ClientResponse)
async def update_client(client_id: str, client_request: ClientCreateRequest, admin_verified: bool = Depends(verify_admin_token)):
    """Update a client (ADMIN ONLY)"""
    try:
        # Generate new slug from new name
        slug = create_slug(client_request.name)
        
        # Check if slug already exists (excluding current client)
        existing_client = await db.clients.find_one({"slug": slug, "id": {"$ne": client_id}})
        if existing_client:
            # Add number to make it unique
            counter = 1
            while existing_client:
                new_slug = f"{slug}-{counter}"
                existing_client = await db.clients.find_one({"slug": new_slug, "id": {"$ne": client_id}})
                counter += 1
            slug = new_slug
        
        # Update client
        result = await db.clients.update_one(
            {"id": client_id},
            {"$set": {"name": client_request.name, "slug": slug}}
        )
        
        if result.modified_count == 1:
            # Get updated client with statistics
            updated_client = await db.clients.find_one({"id": client_id})
            if updated_client:
                client_data = client_helper(updated_client)
                
                # Get transaction count and balance
                transaction_count = await db.transactions.count_documents({"client_id": client_id})
                
                total_avere = 0
                total_dare = 0
                async for transaction in db.transactions.find({"client_id": client_id}):
                    if transaction["type"] == "avere":
                        total_avere += transaction["amount"]
                    else:
                        total_dare += transaction["amount"]
                
                return ClientResponse(
                    **client_data,
                    total_transactions=transaction_count,
                    balance=total_avere - total_dare
                )
            else:
                raise HTTPException(status_code=404, detail="Client not found after update")
        else:
            raise HTTPException(status_code=404, detail="Client not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/clients/{client_id}")
async def delete_client(client_id: str, admin_verified: bool = Depends(verify_admin_token)):
    """Delete a client and all their transactions (ADMIN ONLY)"""
    try:
        # Delete all transactions for this client
        await db.transactions.delete_many({"client_id": client_id})
        
        # Delete the client
        result = await db.clients.delete_one({"id": client_id})
        if result.deleted_count == 1:
            return {"message": "Client and all transactions deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Client not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# TRANSACTION ENDPOINTS (Modified for multi-client)

@app.get("/api/transactions", response_model=List[TransactionResponse])
async def get_transactions(
    client_slug: Optional[str] = Query(None, description="Client slug filter"),
    search: Optional[str] = Query(None, description="Cerca nelle descrizioni"),
    category: Optional[str] = Query(None, description="Filtra per categoria"),
    type: Optional[str] = Query(None, description="Filtra per tipo (dare/avere)"),
    date_from: Optional[str] = Query(None, description="Data inizio (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Data fine (YYYY-MM-DD)")
):
    """Get transactions (PUBLIC for specific client, ADMIN for all)"""
    try:
        # Build query filter
        query_filter = {}
        
        # If client_slug is provided, filter by client
        if client_slug:
            client = await db.clients.find_one({"slug": client_slug, "active": True})
            if not client:
                raise HTTPException(status_code=404, detail="Client not found")
            query_filter["client_id"] = client["id"]
        
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transactions", response_model=TransactionResponse)
async def create_transaction(transaction: Transaction, admin_verified: bool = Depends(verify_admin_token)):
    """Create a new transaction (ADMIN ONLY)"""
    try:
        # Verify client exists
        client = await db.clients.find_one({"id": transaction.client_id, "active": True})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        # Handle currency conversion if needed
        amount_eur = transaction.amount
        original_amount = None
        exchange_rate = None
        
        if transaction.currency != "EUR":
            # Convert to EUR
            converted_amount, rate = await convert_currency(
                transaction.amount, 
                transaction.currency, 
                "EUR"
            )
            amount_eur = converted_amount
            original_amount = transaction.amount
            exchange_rate = rate
        
        # Create transaction document
        transaction_dict = transaction.dict()
        transaction_dict["id"] = str(uuid.uuid4())
        transaction_dict["amount"] = amount_eur  # Always store in EUR
        transaction_dict["original_amount"] = original_amount
        transaction_dict["exchange_rate"] = exchange_rate
        
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
        # Handle currency conversion if needed
        amount_eur = transaction.amount
        original_amount = None
        exchange_rate = None
        
        if transaction.currency != "EUR":
            # Convert to EUR
            converted_amount, rate = await convert_currency(
                transaction.amount, 
                transaction.currency, 
                "EUR"
            )
            amount_eur = converted_amount
            original_amount = transaction.amount
            exchange_rate = rate
        
        # Create updated transaction document
        transaction_dict = transaction.dict()
        transaction_dict.pop('id', None)  # Don't update the ID
        
        # Override with converted values
        transaction_dict["amount"] = amount_eur  # Always store in EUR
        transaction_dict["original_amount"] = original_amount
        transaction_dict["exchange_rate"] = exchange_rate
        
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
async def get_balance(client_slug: Optional[str] = Query(None, description="Client slug filter")):
    """Get balance (PUBLIC for specific client, ADMIN for all)"""
    try:
        query_filter = {}
        
        # If client_slug is provided, filter by client
        if client_slug:
            client = await db.clients.find_one({"slug": client_slug, "active": True})
            if not client:
                raise HTTPException(status_code=404, detail="Client not found")
            query_filter["client_id"] = client["id"]
        
        total_avere = 0  # Crediti/Entrate
        total_dare = 0   # Debiti/Uscite
        
        async for transaction in db.transactions.find(query_filter):
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/statistics")
async def get_statistics(client_slug: Optional[str] = Query(None, description="Client slug filter")):
    """Get statistics (PUBLIC for specific client, ADMIN for all)"""
    try:
        query_filter = {}
        
        # If client_slug is provided, filter by client
        if client_slug:
            client = await db.clients.find_one({"slug": client_slug, "active": True})
            if not client:
                raise HTTPException(status_code=404, detail="Client not found")
            query_filter["client_id"] = client["id"]
        
        stats = {
            "by_category": {},
            "by_type": {"avere": 0, "dare": 0},
            "monthly_summary": []
        }
        
        async for transaction in db.transactions.find(query_filter):
            # Stats by category
            category = transaction["category"]
            if category not in stats["by_category"]:
                stats["by_category"][category] = {"avere": 0, "dare": 0}
            
            stats["by_category"][category][transaction["type"]] += transaction["amount"]
            
            # Stats by type
            stats["by_type"][transaction["type"]] += transaction["amount"]
        
        return stats
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/clients/{client_slug}/pdf")
async def generate_client_pdf(
    client_slug: str,
    date_from: Optional[str] = Query(None, description="Data inizio (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Data fine (YYYY-MM-DD)")
):
    """Generate PDF report for a specific client (PUBLIC)"""
    try:
        # Get client data
        client = await db.clients.find_one({"slug": client_slug, "active": True})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        # Build query filter for transactions
        query_filter = {"client_id": client["id"]}
        
        # Add date filtering if provided
        if date_from or date_to:
            date_filter = {}
            if date_from:
                date_filter["$gte"] = datetime.fromisoformat(date_from)
            if date_to:
                date_filter["$lte"] = datetime.fromisoformat(date_to + "T23:59:59")
            query_filter["date"] = date_filter
        
        # Get transactions for this client (with optional date filtering)
        transactions = []
        async for transaction in db.transactions.find(query_filter).sort("date", -1):
            transactions.append(transaction_helper(transaction))
        
        # Calculate balance for filtered transactions
        total_avere = 0
        total_dare = 0
        for transaction in transactions:
            if transaction["type"] == "avere":
                total_avere += transaction["amount"]
            else:
                total_dare += transaction["amount"]
        
        balance = total_avere - total_dare
        
        # Create PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        story = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=TA_CENTER,
            textColor=colors.navy
        )
        
        subtitle_style = ParagraphStyle(
            'CustomSubtitle',
            parent=styles['Heading2'],
            fontSize=16,
            spaceAfter=20,
            alignment=TA_CENTER,
            textColor=colors.darkblue
        )
        
        # Title
        story.append(Paragraph("🧮 Contabilità Alpha", title_style))
        story.append(Paragraph("Estratto Conto", subtitle_style))
        story.append(Spacer(1, 20))
        
        # Client info and period
        client_info = f"<b>Cliente:</b> {client['name']}<br/>"
        client_info += f"<b>Data generazione:</b> {datetime.now().strftime('%d/%m/%Y alle %H:%M')}<br/>"
        
        if date_from or date_to:
            period_text = "Periodo: "
            if date_from:
                period_text += f"dal {datetime.fromisoformat(date_from).strftime('%d/%m/%Y')} "
            if date_to:
                period_text += f"al {datetime.fromisoformat(date_to).strftime('%d/%m/%Y')}"
            client_info += f"<b>{period_text}</b>"
        else:
            client_info += f"<b>Periodo:</b> Tutte le transazioni"
            
        story.append(Paragraph(client_info, styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Balance summary
        balance_data = [
            ['Categoria', 'Importo'],
            ['Totale Avere (Crediti)', f"€ {total_avere:,.2f}"],
            ['Totale Dare (Debiti)', f"€ {total_dare:,.2f}"],
            ['Saldo Netto', f"€ {balance:,.2f}"],
        ]
        
        balance_table = Table(balance_data, colWidths=[3*inch, 2*inch])
        balance_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.navy),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTNAME', (0, 3), (-1, 3), 'Helvetica-Bold'),
            ('BACKGROUND', (0, 3), (-1, 3), colors.lightgreen if balance >= 0 else colors.lightcoral),
        ]))
        
        story.append(balance_table)
        story.append(Spacer(1, 30))
        
        # Transactions header
        story.append(Paragraph("📋 Dettaglio Transazioni", styles['Heading2']))
        story.append(Spacer(1, 10))
        
        if transactions:
            # Transaction table
            transaction_data = [['Data', 'Descrizione', 'Tipo', 'Categoria', 'Importo']]
            
            for transaction in transactions:
                # Handle both datetime objects and strings
                if isinstance(transaction['date'], str):
                    date_obj = datetime.fromisoformat(transaction['date'].replace('Z', '+00:00'))
                else:
                    date_obj = transaction['date']
                
                date_str = date_obj.strftime('%d/%m/%Y %H:%M')
                amount_str = f"€ {transaction['amount']:,.2f}"
                if transaction['type'] == 'avere':
                    amount_str = f"+{amount_str}"
                else:
                    amount_str = f"-{amount_str}"
                
                # Truncate description if too long
                description = transaction['description']
                if len(description) > 40:
                    description = description[:37] + '...'
                
                transaction_data.append([
                    date_str,
                    description,
                    'Avere' if transaction['type'] == 'avere' else 'Dare',
                    transaction['category'],
                    amount_str
                ])
            
            transaction_table = Table(transaction_data, colWidths=[1.2*inch, 2.3*inch, 0.8*inch, 1*inch, 1.2*inch])
            transaction_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.navy),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('FONTSIZE', (0, 1), (-1, -1), 7),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            
            # Color code the amounts and rows
            for i, transaction in enumerate(transactions, 1):
                if transaction['type'] == 'avere':
                    transaction_table.setStyle(TableStyle([
                        ('TEXTCOLOR', (4, i), (4, i), colors.green),
                        ('BACKGROUND', (0, i), (-1, i), colors.lightgreen),
                    ]))
                else:
                    transaction_table.setStyle(TableStyle([
                        ('TEXTCOLOR', (4, i), (4, i), colors.red),
                        ('BACKGROUND', (0, i), (-1, i), colors.mistyrose),
                    ]))
            
            story.append(transaction_table)
        else:
            no_transactions_msg = "Nessuna transazione trovata"
            if date_from or date_to:
                no_transactions_msg += " per il periodo selezionato"
            no_transactions_msg += "."
            story.append(Paragraph(no_transactions_msg, styles['Normal']))
        
        # Footer
        story.append(Spacer(1, 30))
        footer_text = f"Totale transazioni: {len(transactions)}"
        if date_from or date_to:
            footer_text += f" (filtrate per periodo)"
        story.append(Paragraph(footer_text, styles['Normal']))
        
        # Build PDF
        doc.build(story)
        
        # Return PDF as response
        buffer.seek(0)
        date_suffix = ""
        if date_from and date_to:
            date_suffix = f"_{date_from}_{date_to}"
        elif date_from:
            date_suffix = f"_dal_{date_from}"
        elif date_to:
            date_suffix = f"_al_{date_to}"
        
        filename = f"estratto_conto_{client['slug']}{date_suffix}_{datetime.now().strftime('%Y%m%d')}.pdf"
        
        return StreamingResponse(
            io.BytesIO(buffer.read()),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")

@app.patch("/api/clients/{client_id}/reset-link")
async def reset_client_link(client_id: str, token: str = Depends(verify_admin_token)):
    """Reset client link by generating new slug (ADMIN ONLY)"""
    try:
        # Check if client exists
        client = await db.clients.find_one({"id": client_id, "active": True})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        # Generate new secure slug
        import secrets
        import string
        alphabet = string.ascii_lowercase + string.digits
        new_slug = ''.join(secrets.choice(alphabet) for _ in range(12))
        
        # Ensure uniqueness
        while await db.clients.find_one({"slug": new_slug, "active": True}):
            new_slug = ''.join(secrets.choice(alphabet) for _ in range(12))
        
        # Update client with new slug
        result = await db.clients.update_one(
            {"id": client_id},
            {"$set": {"slug": new_slug}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Failed to reset client link")
        
        # Return updated client
        updated_client = await db.clients.find_one({"id": client_id})
        return client_helper(updated_client)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error resetting client link: {str(e)}")

@app.get("/api/exchange-rates")
async def get_exchange_rates():
    """Get current exchange rates for supported currencies"""
    try:
        rates = {}
        supported_currencies = ["USD", "GBP"]
        
        for currency in supported_currencies:
            rate = await get_exchange_rate(currency, "EUR")
            rates[currency] = rate
        
        rates["EUR"] = 1.0  # Base currency
        
        return {
            "base_currency": "EUR",
            "rates": rates,
            "last_updated": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "base_currency": "EUR", 
            "rates": {"EUR": 1.0, "USD": 0.92, "GBP": 1.17},
            "last_updated": datetime.now().isoformat(),
            "error": "Using fallback rates"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
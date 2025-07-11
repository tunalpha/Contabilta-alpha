from fastapi import FastAPI, HTTPException, Query, Depends, Header, Response
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
from dotenv import load_dotenv
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
from datetime import datetime, timedelta
import dns.resolver

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
        x_center = self.size / 2
        y_center = self.size / 2
        canvas.drawString(x_center - 8, y_center + 2, "📊")
        canvas.setFont("Helvetica-Bold", 8)
        canvas.drawString(x_center - 12, y_center - 12, "ALPHA")
        canvas.restoreState()

    def wrap(self, availWidth, availHeight):
        return self.size, self.size

pdf_links = {}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://contabilta-alpha-qt0a10q4y-tunalphas-projects.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)

MONGO_URL = "mongodb+srv://ildatteroit:uIMlqfpnghUHytke@cluster.mzgatfa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster"
DB_NAME = "contabilita_alpha_multi"

mongo_client = None
db = None

async def get_mongo_client():
    global mongo_client, db
    if mongo_client is None:
        for attempt in range(3):
            try:
                logger.info(f"Attempting MongoDB connection (attempt {attempt + 1})")
                mongo_client = AsyncIOMotorClient(
                    MONGO_URL,
                    maxPoolSize=10,
                    minPoolSize=1,
                    serverSelectionTimeoutMS=10000,  # Increased timeout
                    connectTimeoutMS=10000,
                    socketTimeoutMS=10000,
                    retryWrites=True,
                    retryReads=True,
                    w='majority',
                    tls=True,
                    tlsAllowInvalidCertificates=False,
                )
                # Test connection
                await mongo_client.admin.command('ping')
                db = mongo_client[DB_NAME]
                logger.info("MongoDB connection successful")
                return mongo_client, db
            except Exception as e:
                logger.error(f"Connection attempt {attempt + 1} failed: {str(e)}")
                if attempt == 2:
                    raise HTTPException(status_code=500, detail=f"Failed to connect to MongoDB after retries: {str(e)}")
                await asyncio.sleep(1)
    return mongo_client, db

@app.on_event("startup")
async def startup_event():
    global mongo_client, db
    mongo_client, db = await get_mongo_client()

@app.on_event("shutdown")
async def shutdown_event():
    global mongo_client
    if mongo_client is not None:
        logger.info("Closing MongoDB connection")
        mongo_client.close()
        mongo_client = None

class ClientResponse(BaseModel):
    id: str
    name: str
    slug: str
    created_date: datetime
    active: bool
    total_transactions: int = 0
    balance: float = 0.0
    has_password: bool = False

def client_helper(client) -> dict:
    try:
        return {
            "id": client.get("id", ""),
            "name": client.get("name", "Unknown"),
            "slug": client.get("slug", ""),
            "created_date": client.get("created_date", datetime.now()),
            "active": client.get("active", True),
            "has_password": bool(client.get("password"))
        }
    except Exception as e:
        logger.error(f"Error in client_helper: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process client data: {str(e)}")
ADMIN_PASSWORD = "alpha2024!"
ADMIN_TOKEN = hashlib.sha256(ADMIN_PASSWORD.encode()).hexdigest()

EMAIL_CONFIG = {
    "smtp_server": "smtp.gmail.com",
    "smtp_port": 587,
    "sender_email": "giaquintagroup@gmail.com",
    "sender_password": "xtec ycwx dgje nqwn",
    "recovery_email": "ildattero.it@gmail.com"
}

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

class AdminPasswordResetRequest(BaseModel):
    email: str

class AdminPasswordResetConfirm(BaseModel):
    reset_token: str
    new_password: str

async def verify_admin_token(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token di autorizzazione richiesto")
    
    if authorization != f"Bearer {ADMIN_TOKEN}":
        raise HTTPException(status_code=403, detail="Token non valido")
    
    return True

async def verify_client_access(client_slug: str, authorization: Optional[str] = Header(None)):
    try:
        _, db = await get_mongo_client()
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
        raise HTTPException(status_code=500, detail=str(e))

async def get_exchange_rate(from_currency: str, to_currency: str = "EUR") -> float:
    if from_currency == to_currency:
        return 1.0
    
    try:
        async with aiohttp.ClientSession() as session:
            url = f"https://api.exchangerate-api.com/v4/latest/{from_currency}"
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    return data["rates"].get(to_currency, 1.0)
                else:
                    fallback_rates = {
                        "USD": 0.92,
                        "GBP": 1.17,
                    }
                    return fallback_rates.get(from_currency, 1.0)
    except Exception as e:
        print(f"Error fetching exchange rate: {e}")
        fallback_rates = {
            "USD": 0.92,
            "GBP": 1.17,
        }
        return fallback_rates.get(from_currency, 1.0)

async def convert_currency(amount: float, from_currency: str, to_currency: str = "EUR") -> tuple[float, float]:
    if from_currency == to_currency:
        return amount, 1.0
    
    rate = await get_exchange_rate(from_currency, to_currency)
    converted_amount = amount * rate
    return converted_amount, rate

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

        html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; color: white; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">🧮 Contabilità</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">Recupero Password Amministratore</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-top: 20px;">
              <h2 style="color: #333; margin-top: 0;">🔑 Password Recuperata</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.5;">
                Hai richiesto il recupero della password per l'accesso amministratore della Contabilità.
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
              <p>Email automatica da Contabilità</p>
              <p>Data: {datetime.now().strftime('%d/%m/%Y alle %H:%M')}</p>
            </div>
          </body>
        </html>
        """

        text = f"""
        🧮 Contabilità - Recupero Password

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
async def admin_login(login_data: LoginRequest):
    try:
        mongo_client, db = await get_mongo_client()
        admin_config = await db.admin_config.find_one()
        
        if admin_config and "password_hash" in admin_config:
            stored_password_hash = admin_config["password_hash"]
            input_password_hash = hashlib.sha256(login_data.password.encode()).hexdigest()
            
            if input_password_hash == stored_password_hash:
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
        else:
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
    except Exception as e:
        print(f"Error during admin login: {str(e)}")
        return LoginResponse(
            success=False,
            message=f"Errore durante il login: {str(e)}"
        )

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
            return PasswordRecoveryResponse(
                success=False,
                message="Errore nell'invio dell'email. Riprova più tardi."
            )
    except Exception as e:
        return PasswordRecoveryResponse(
            success=False,
            message="Errore durante il recupero password"
        )

@app.post("/api/clients/{client_id}/password", response_model=dict)
async def set_client_password(client_id: str, password_request: ClientPasswordRequest, admin_verified: bool = Depends(verify_admin_token)):
    try:
        _, db = await get_mongo_client()
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
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/clients/{client_slug}/login", response_model=ClientLoginResponse)
async def client_login(client_slug: str, login_request: ClientLoginRequest):
    try:
        _, db = await get_mongo_client()
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
            client_token = hashlib.sha256(f"{client['id']}_{client['slug']}_{datetime.now().isoformat()}".encode()).hexdigest()
            is_first_login = client.get("first_login", False)
            
            return ClientLoginResponse(
                success=True,
                token=client_token,
                message="Login cliente riuscito",
                first_login=is_first_login,
                client_name=client["name"]
            )
        else:
            return ClientLoginResponse(
                success=False,
                message="Password errata",
                first_login=False
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/clients/{client_id}/password")
async def remove_client_password(client_id: str, admin_verified: bool = Depends(verify_admin_token)):
    try:
        _, db = await get_mongo_client()
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
            raise HTTPException(status_code=500, detail="Errore nella rimozione della password")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/clients/{client_slug}/change-password")
async def change_client_password(client_slug: str, change_request: ClientPasswordChangeRequest):
    try:
        _, db = await get_mongo_client()
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
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/clients", response_model=List[ClientResponse])
async def get_clients(admin_verified: bool = Depends(verify_admin_token)):
    try:
        _, db = await get_mongo_client()
        clients_cursor = db.clients.find().sort("created_date", -1)
        all_clients = await clients_cursor.to_list(length=None)
        clients = []
        
        for client in all_clients:
            client_data = client_helper(client)
            
            transaction_count = await db.transactions.count_documents({"client_id": client["id"]})
            
            transactions = await db.transactions.find({"client_id": client["id"]}).to_list(length=None)
            total_avere = sum(t["amount"] for t in transactions if t["type"] == "avere")
            total_dare = sum(t["amount"] for t in transactions if t["type"] == "dare")
            
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
    try:
        logger.info("Fetching clients from MongoDB")
        _, db = await get_mongo_client()
        clients_cursor = db.clients.find().sort("created_date", -1)
        all_clients = await clients_cursor.to_list(length=None)
        clients = []
        
        for client in all_clients:
            try:
                client_data = client_helper(client)
                transaction_count = await db.transactions.count_documents({"client_id": client.get("id", "")})
                
                transactions = await db.transactions.find({"client_id": client.get("id", "")}).to_list(length=None)
                total_avere = sum(t.get("amount", 0.0) for t in transactions if t.get("type") == "avere")
                total_dare = sum(t.get("amount", 0.0) for t in transactions if t.get("type") == "dare")
                
                client_response = ClientResponse(
                    **client_data,
                    total_transactions=transaction_count,
                    balance=total_avere - total_dare
                )
                clients.append(client_response)
            except Exception as e:
                logger.error(f"Error processing client {client.get('id', 'unknown')}: {str(e)}")
                continue  # Skip problematic clients to avoid crashing the endpoint
        
        logger.info(f"Returning {len(clients)} clients")
        return clients
    except Exception as e:
        logger.error(f"Error in get_clients_public: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch clients: {str(e)}")

@app.post("/api/clients", response_model=ClientResponse)
async def create_client(client_request: ClientCreateRequest, admin_verified: bool = Depends(verify_admin_token)):
    try:
        _, db = await get_mongo_client()
        slug = create_slug(client_request.name)
        
        existing_client = await db.clients.find_one({"slug": slug})
        if existing_client:
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
            return ClientResponse(**client_dict, total_transactions=0, balance=0.0, has_password=False)
        else:
            raise HTTPException(status_code=500, detail="Failed to create client")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/clients/{client_slug}")
async def get_client_by_slug(client_slug: str, client_verified: dict = Depends(verify_client_access)):
    try:
        return client_helper(client_verified)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/clients/{client_id}", response_model=ClientResponse)
async def update_client(client_id: str, client_request: ClientCreateRequest, admin_verified: bool = Depends(verify_admin_token)):
    try:
        _, db = await get_mongo_client()
        slug = create_slug(client_request.name)
        
        existing_client = await db.clients.find_one({"slug": slug, "id": {"$ne": client_id}})
        if existing_client:
            counter = 1
            while existing_client:
                new_slug = f"{slug}-{counter}"
                existing_client = await db.clients.find_one({"slug": new_slug, "id": {"$ne": client_id}})
                counter += 1
            slug = new_slug
        
        result = await db.clients.update_one(
            {"id": client_id},
            {"$set": {"name": client_request.name, "slug": slug}}
        )
        
        if result.modified_count == 1:
            updated_client = await db.clients.find_one({"id": client_id})
            if updated_client:
                client_data = client_helper(updated_client)
                
                transaction_count = await db.transactions.count_documents({"client_id": client_id})
                
                transactions = await db.transactions.find({"client_id": client_id}).to_list(length=None)
                total_avere = sum(t["amount"] for t in transactions if t["type"] == "avere")
                total_dare = sum(t["amount"] for t in transactions if t["type"] == "dare")
                
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
    try:
        _, db = await get_mongo_client()
        await db.transactions.delete_many({"client_id": client_id})
        
        result = await db.clients.delete_one({"id": client_id})
        if result.deleted_count == 1:
            return {"message": "Client and all transactions deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Client not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/transactions", response_model=List[TransactionResponse])
async def get_transactions(
    client_slug: Optional[str] = Query(None, description="Client slug filter"),
    search: Optional[str] = Query(None, description="Cerca nelle descrizioni"),
    category: Optional[str] = Query(None, description="Filtra per categoria"),
    type: Optional[str] = Query(None, description="Filtra per tipo (dare/avere)"),
    date_from: Optional[str] = Query(None, description="Data inizio (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Data fine (YYYY-MM-DD)"),
    authorization: Optional[str] = Header(None)
):
    try:
        _, db = await get_mongo_client()
        query_filter = {}
        
        if client_slug:
            client = await verify_client_access(client_slug, authorization)
            query_filter["client_id"] = client["id"]
        
        if search:
            query_filter["description"] = {"$regex": search, "$options": "i"}
        
        if category:
            query_filter["category"] = category
        
        if type:
            query_filter["type"] = type
        
        if date_from or date_to:
            date_filter = {}
            if date_from:
                date_filter["$gte"] = datetime.fromisoformat(date_from)
            if date_to:
                date_filter["$lte"] = datetime.fromisoformat(date_to + "T23:59:59")
            query_filter["date"] = date_filter
        
        transactions_cursor = db.transactions.find(query_filter).sort("date", -1)
        transactions = await transactions_cursor.to_list(length=None)
        return [transaction_helper(t) for t in transactions]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transactions", response_model=TransactionResponse)
async def create_transaction(transaction: Transaction, admin_verified: bool = Depends(verify_admin_token)):
    try:
        _, db = await get_mongo_client()
        client = await db.clients.find_one({"id": transaction.client_id, "active": True})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        amount_eur = transaction.amount
        original_amount = None
        exchange_rate = None
        
        if transaction.currency != "EUR":
            converted_amount, rate = await convert_currency(
                transaction.amount, 
                transaction.currency, 
                "EUR"
            )
            amount_eur = converted_amount
            original_amount = transaction.amount
            exchange_rate = rate
        
        transaction_dict = transaction.dict()
        transaction_dict["id"] = str(uuid.uuid4())
        transaction_dict["amount"] = amount_eur
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
    try:
        _, db = await get_mongo_client()
        amount_eur = transaction.amount
        original_amount = None
        exchange_rate = None
        
        if transaction.currency != "EUR":
            converted_amount, rate = await convert_currency(
                transaction.amount, 
                transaction.currency, 
                "EUR"
            )
            amount_eur = converted_amount
            original_amount = transaction.amount
            exchange_rate = rate
        
        transaction_dict = transaction.dict()
        transaction_dict.pop('id', None)
        transaction_dict["amount"] = amount_eur
        transaction_dict["original_amount"] = original_amount
        transaction_dict["exchange_rate"] = exchange_rate
        
        result = await db.transactions.update_one(
            {"id": transaction_id}, 
            {"$set": transaction_dict}
        )
        
        if result.modified_count == 1:
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
    try:
        _, db = await get_mongo_client()
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
async def get_balance(
    client_slug: Optional[str] = Query(None, description="Client slug filter"),
    authorization: Optional[str] = Header(None)
):
    try:
        _, db = await get_mongo_client()
        query_filter = {}
        
        if client_slug:
            client = await verify_client_access(client_slug, authorization)
            query_filter["client_id"] = client["id"]
        
        transactions = await db.transactions.find(query_filter).to_list(length=None)
        total_avere = sum(t["amount"] for t in transactions if t["type"] == "avere")
        total_dare = sum(t["amount"] for t in transactions if t["type"] == "dare")
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
async def get_statistics(
    client_slug: Optional[str] = Query(None, description="Client slug filter"),
    authorization: Optional[str] = Header(None)
):
    try:
        _, db = await get_mongo_client()
        query_filter = {}
        
        if client_slug:
            client = await verify_client_access(client_slug, authorization)
            query_filter["client_id"] = client["id"]
        
        stats = {
            "by_category": {},
            "by_type": {"avere": 0, "dare": 0},
            "monthly_summary": []
        }
        
        transactions = await db.transactions.find(query_filter).to_list(length=None)
        for transaction in transactions:
            category = transaction["category"]
            if category not in stats["by_category"]:
                stats["by_category"][category] = {"avere": 0, "dare": 0}
            
            stats["by_category"][category][transaction["type"]] += transaction["amount"]
            stats["by_type"][transaction["type"]] += transaction["amount"]
        
        return stats
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/clients/{client_slug}/pdf/share")
async def create_pdf_share_link(client_slug: str, date_from: str = "", date_to: str = ""):
    try:
        link_id = secrets.token_urlsafe(16)
        expiration = datetime.now() + timedelta(hours=24)
        pdf_links[link_id] = {
            "client_slug": client_slug,
            "date_from": date_from,
            "date_to": date_to,
            "expires_at": expiration,
            "created_at": datetime.now()
        }
        
        return {
            "link_id": link_id,
            "share_url": f"/pdf/share/{link_id}",
            "expires_at": expiration.isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating share link: {str(e)}")

@app.get("/pdf/share/{link_id}")
async def get_shared_pdf(link_id: str):
    try:
        if link_id not in pdf_links:
            raise HTTPException(status_code=404, detail="Link not found")
        
        link_data = pdf_links[link_id]
        
        if datetime.now() > link_data["expires_at"]:
            del pdf_links[link_id]
            raise HTTPException(status_code=410, detail="Link expired")
        
        _, db = await get_mongo_client()
        client_slug = link_data["client_slug"]
        date_from = link_data["date_from"] or None
        date_to = link_data["date_to"] or None
        
        client = await db.clients.find_one({"slug": client_slug})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        query_filter = {"client_id": client["id"]}
        
        if date_from:
            query_filter["date"] = {"$gte": datetime.fromisoformat(date_from)}
        if date_to:
            if "date" in query_filter:
                query_filter["date"]["$lte"] = datetime.fromisoformat(date_to + "T23:59:59")
            else:
                query_filter["date"] = {"$lte": datetime.fromisoformat(date_to + "T23:59:59")}
        
        transactions = await db.transactions.find(query_filter).to_list(length=None)
        transactions = [transaction_helper(t) for t in transactions]
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
        
        styles = getSampleStyleSheet()
        story = []
        
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=TA_CENTER,
            textColor=colors.navy
        )
        
        story.append(Spacer(1, 20))
        story.append(Paragraph("📊 ALPHA - Contabilità", title_style))
        story.append(Paragraph("Estratto Conto", styles['Heading2']))
        story.append(Spacer(1, 20))
        
        story.append(Paragraph(f"<b>Cliente:</b> {client['name']}", styles['Normal']))
        story.append(Paragraph(f"<b>Data generazione:</b> {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        if transactions:
            table_data = [['Data', 'Descrizione', 'Tipo', 'Importo']]
            for transaction in transactions:
                table_data.append([
                    transaction['date'].strftime('%d/%m/%Y'),
                    transaction['description'][:40],
                    transaction['type'].upper(),
                    f"€ {transaction['amount']:.2f}"
                ])
            
            table = Table(table_data)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(table)
        else:
            story.append(Paragraph("Nessuna transazione trovata per il periodo selezionato", styles['Normal']))
        
        doc.build(story)
        buffer.seek(0)
        
        return Response(
            content=buffer.getvalue(),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=estratto-conto-{client['name']}.pdf"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error accessing shared PDF: {str(e)}")

@app.get("/api/clients/{client_slug}/pdf")
async def generate_client_pdf(
    client_slug: str,
    date_from: Optional[str] = Query(None, description="Data inizio (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Data fine (YYYY-MM-DD)"),
    authorization: Optional[str] = Header(None)
):
    try:
        client = await verify_client_access(client_slug, authorization)
        _, db = await get_mongo_client()
        
        query_filter = {"client_id": client["id"]}
        
        if date_from or date_to:
            date_filter = {}
            if date_from:
                date_filter["$gte"] = datetime.fromisoformat(date_from)
            if date_to:
                date_filter["$lte"] = datetime.fromisoformat(date_to + "T23:59:59")
            query_filter["date"] = date_filter
        
        transactions = await db.transactions.find(query_filter).to_list(length=None)
        transactions = [transaction_helper(t) for t in transactions]
        
        total_avere = sum(t["amount"] for t in transactions if t["type"] == "avere")
        total_dare = sum(t["amount"] for t in transactions if t["type"] == "dare")
        balance = total_avere - total_dare
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        story = []
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=TA_CENTER,
            textColor=colors.navy
        )
        
        logo_style = ParagraphStyle(
            'LogoStyle',
            parent=styles['Normal'],
            fontSize=36,
            spaceAfter=10,
            alignment=TA_CENTER,
            textColor=colors.darkblue
        )
        
        subtitle_style = ParagraphStyle(
            'CustomSubtitle',
            parent=styles['Heading2'],
            fontSize=16,
            spaceAfter=20,
            alignment=TA_CENTER,
            textColor=colors.darkblue
        )
        
        story.append(Spacer(1, 20))
        logo = AlphaLogoFlowable(size=80)
        logo.hAlign = 'CENTER'
        story.append(logo)
        story.append(Spacer(1, 10))
        story.append(Paragraph("Contabilità", title_style))
        story.append(Paragraph("Estratto Conto", subtitle_style))
        story.append(Spacer(1, 20))
        
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
        
        story.append(Paragraph("📋 Dettaglio Transazioni", styles['Heading2']))
        story.append(Spacer(1, 10))
        
        if transactions:
            transaction_data = [['Data', 'Descrizione', 'Tipo', 'Categoria', 'Importo']]
            
            for transaction in transactions:
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
        
        story.append(Spacer(1, 30))
        footer_style = ParagraphStyle(
            'FooterStyle',
            parent=styles['Normal'],
            fontSize=10,
            alignment=TA_CENTER,
            textColor=colors.grey,
            spaceAfter=5
        )
        
        story.append(Paragraph("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", footer_style))
        story.append(Paragraph("📊 ALPHA - Contabilità Professionale", footer_style))
        story.append(Paragraph("Sistema multi-cliente con AI insights", footer_style))
        
        doc.build(story)
        
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
    try:
        _, db = await get_mongo_client()
        client = await db.clients.find_one({"id": client_id, "active": True})
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        import secrets
        import string
        alphabet = string.ascii_lowercase + string.digits
        new_slug = ''.join(secrets.choice(alphabet) for _ in range(12))
        
        while await db.clients.find_one({"slug": new_slug, "active": True}):
            new_slug = ''.join(secrets.choice(alphabet) for _ in range(12))
        
        result = await db.clients.update_one(
            {"id": client_id},
            {"$set": {"slug": new_slug}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=400, detail="Failed to reset client link")
        
        updated_client = await db.clients.find_one({"id": client_id})
        return client_helper(updated_client)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error resetting client link: {str(e)}")

@app.get("/api/exchange-rates")
async def get_exchange_rates():
    try:
        rates = {}
        supported_currencies = ["USD", "GBP"]
        
        for currency in supported_currencies:
            rate = await get_exchange_rate(currency, "EUR")
            rates[currency] = rate
        
        rates["EUR"] = 1.0
        
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

@app.post("/api/admin/request-password-reset")
async def request_admin_password_reset():
    try:
        admin_email = "ildattero.it@gmail.com"
        reset_token = str(uuid.uuid4())
        expires_at = datetime.now() + timedelta(hours=1)
        
        _, db = await get_mongo_client()
        await db.admin_password_resets.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "reset_token": reset_token,
            "expires_at": expires_at,
            "used": False,
            "created_at": datetime.now()
        })
        
        reset_link = f"https://expense-master-88.preview.emergentagent.com/admin-reset?token={reset_token}"
        
        email_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
                <h2 style="color: #333;">🔐 Reset Password Admin - Contabilità Alpha</h2>
                <p>È stato richiesto il reset della password amministratore.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_link}" style="background-color: #3B82F6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        🔓 Resetta Password
                    </a>
                </div>
                <p><strong>IMPORTANTE:</strong></p>
                <ul>
                    <li>Questo link scade tra 1 ora</li>
                    <li>Clicca il link per impostare una nuova password</li>
                    <li>Se non hai richiesto questo reset, ignora questa email</li>
                </ul>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
                <p style="color: #6c757d; font-size: 12px;">
                    Richiesta inviata il: {datetime.now().strftime('%d/%m/%Y alle %H:%M')}<br>
                    Token: {reset_token}
                </p>
            </div>
        </body>
        </html>
        """
        
        message = MIMEMultipart("alternative")
        message["Subject"] = "🔐 Reset Password Admin - Contabilità Alpha"
        message["From"] = admin_email
        message["To"] = admin_email
        
        html_part = MIMEText(email_body, "html")
        message.attach(html_part)
        
        try:
            smtp_user = os.getenv("SMTP_USERNAME")
            smtp_pass = os.getenv("SMTP_PASSWORD")
            
            await aiosmtplib.send(
                message,
                hostname="smtp.gmail.com",
                port=587,
                start_tls=True,
                username=smtp_user,
                password=smtp_pass.replace(" ", "") if smtp_pass else "",
            )
            
        except Exception as email_error:
            print(f"❌ Email send failed: {email_error}")
            raise HTTPException(status_code=500, detail=f"Errore nell'invio email: {str(email_error)}")
        
        return {
            "success": True,
            "message": "Email di reset inviata all'amministratore.",
            "reset_link": reset_link,
            "token": reset_token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nel reset password: {str(e)}")

@app.post("/api/admin/confirm-password-reset")
async def confirm_admin_password_reset(request: AdminPasswordResetConfirm):
    try:
        _, db = await get_mongo_client()
        reset_record = await db.admin_password_resets.find_one({
            "reset_token": request.reset_token,
            "used": False
        })
        
        if not reset_record:
            raise HTTPException(status_code=400, detail="Token non valido o già utilizzato")
        
        if datetime.now() > reset_record["expires_at"]:
            raise HTTPException(status_code=400, detail="Token scaduto")
        
        new_password_hash = hashlib.sha256(request.new_password.encode()).hexdigest()
        
        admin_config = await db.admin_config.find_one() or {}
        admin_config["password_hash"] = new_password_hash
        admin_config["updated_at"] = datetime.now()
        
        await db.admin_config.replace_one({}, admin_config, upsert=True)
        
        await db.admin_password_resets.update_one(
            {"reset_token": request.reset_token},
            {"$set": {"used": True, "used_at": datetime.now()}}
        )
        
        return {
            "success": True,
            "message": "Password admin aggiornata con successo!"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nel confermare reset: {str(e)}")

@app.get("/api/admin/verify-reset-token/{token}")
async def verify_reset_token(token: str):
    try:
        _, db = await get_mongo_client()
        reset_record = await db.admin_password_resets.find_one({
            "reset_token": token,
            "used": False
        })
        
        if not reset_record:
            return {"valid": False, "message": "Token non valido"}
        
        if datetime.now() > reset_record["expires_at"]:
            return {"valid": False, "message": "Token scaduto"}
        
        return {"valid": True, "email": reset_record["email"]}
        
    except Exception as e:
        return {"valid": False, "message": "Errore nella verifica"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

# 🧮 Contabilità Alpha

**Sistema di Contabilità Multi-Cliente con AI Insights**

## 🌟 Caratteristiche Principali

### 💡 **Funzionalità Innovative**
- 🧠 **Insights Intelligenti AI** - Analisi automatica e suggerimenti smart
- 📊 **Analytics Avanzati** - Grafici trend mensili e categorie
- 💬 **Assistenza WhatsApp** - Supporto diretto per clienti
- 💰 **Multi-valuta** - USD/GBP/EUR con conversioni automatiche
- 📅 **Gestione Date Avanzata** - Transazioni retroattive
- 🔐 **Sistema Multi-Cliente** - Isolamento dati e sicurezza

### 🎯 **Funzionalità Contabili**
- ✅ Gestione transazioni CRUD completa
- ✅ Terminologia professionale (Dare/Avere)
- ✅ Categorie: Cash, Bonifico, PayPal, Carte, Altro
- ✅ Filtri avanzati (descrizione, categoria, date, tipo)
- ✅ Calcolo automatico bilanci
- ✅ Export PDF professionale
- ✅ Recupero password via email

## 🚀 Deploy URL

**🌐 App Live:** `https://contabilita-alpha.vercel.app`

### 👥 **Accessi Demo:**
- **Admin Dashboard:** `/`
- **Cliente Sovanza:** `/cliente/sovanza` 
- **Cliente Bill:** `/cliente/bill`
- **Cliente Marzia:** `/cliente/marzia`

**🔑 Password Admin:** `alpha2024!`

## 🛠️ Tecnologie Utilizzate

### **Frontend**
- ⚛️ **React 18** - Framework UI moderno
- 🎨 **Tailwind CSS** - Styling responsive
- 📊 **Chart.js** - Grafici interattivi
- 🌍 **i18next** - Multilingua (IT/EN)

### **Backend**  
- ⚡ **FastAPI** - API moderne e veloci
- 🍃 **MongoDB** - Database NoSQL
- 📧 **SMTP Email** - Recupero password
- 📄 **ReportLab** - Generazione PDF
- 💱 **Exchange API** - Tassi di cambio

### **Deploy & Infrastructure**
- 🌐 **Vercel** - Hosting globale
- 🔒 **SSL automatico** - Sicurezza totale
- 📱 **PWA Ready** - Progressive Web App

## 🎯 Architettura AI Insights

### **🧠 Analisi Intelligenti**
1. **Performance Analysis** - Migliore mese, trend crescita
2. **Spending Patterns** - Categorie principali, abitudini
3. **Cash Flow Prediction** - Previsioni basate su pattern
4. **Financial Health Score** - Punteggio 1-10 personalizzato
5. **Smart Alerts** - Notifiche proattive e suggerimenti

### **📊 Analytics Dashboard**
- **Trend Mensile** - Entrate vs Uscite (6 mesi)
- **Spese per Categoria** - Distribuzione percentuale
- **Responsive Charts** - Ottimizzati per mobile/desktop

## 📱 Integrazione WhatsApp

**Numero Assistenza:** `+39 377 241 1743`

### **🔧 Configurazione**
```javascript
// Messaggio pre-compilato automatico
const whatsappURL = `https://wa.me/393772411743?text=
Ciao! Ho bisogno di assistenza per la mia contabilità.
Cliente: ${clientName}
Problema: `;
```

## 🔧 Installazione Locale

### **Prerequisiti**
- Node.js 18+
- Python 3.9+
- MongoDB

### **Setup**
```bash
# Clone repository
git clone [repository-url]
cd contabilita-alpha

# Install dependencies
yarn install-deps

# Setup environment variables
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env

# Start development
yarn dev
```

### **Environment Variables**

**Frontend (.env):**
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

**Backend (.env):**
```
MONGO_URL=mongodb://localhost:27017/contabilita
ADMIN_PASSWORD=alpha2024!
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

## 🔐 Sicurezza

- 🔒 **Autenticazione Token** - JWT per admin
- 🛡️ **Isolamento Dati** - Clienti separati
- 📧 **Recupero Password** - Via email sicura
- 🔐 **Validazione Input** - Pydantic models
- 🌐 **CORS Configurato** - Domini autorizzati

## 📊 Database Schema

### **Collections**
```javascript
// Clients
{
  _id: ObjectId,
  name: String,
  slug: String (unique),
  created_at: DateTime
}

// Transactions  
{
  _id: ObjectId,
  client_id: String,
  amount: Float,
  description: String,
  type: "dare" | "avere",
  category: String,
  currency: String,
  original_amount: Float,
  exchange_rate: Float,
  date: DateTime,
  created_at: DateTime
}
```

## 🎨 Guida UI/UX

### **🎨 Color Palette**
- **Primary:** Blue (`#3B82F6`)
- **Success:** Green (`#10B981`) 
- **Warning:** Yellow (`#F59E0B`)
- **Danger:** Red (`#EF4444`)
- **Background:** Gradient Blue (`from-blue-50 to-indigo-100`)

### **📱 Responsive Design**
- Mobile First approach
- Tailwind breakpoints
- Touch-friendly interfaces
- Optimized charts for small screens

## 🔄 API Documentation

### **Auth Endpoints**
```
POST /api/admin/login
POST /api/admin/password-recovery
```

### **Client Endpoints**
```
GET    /api/clients
POST   /api/clients
PUT    /api/clients/{client_id}
DELETE /api/clients/{client_id}
```

### **Transaction Endpoints**
```
GET    /api/transactions?client_slug={slug}
POST   /api/transactions
PUT    /api/transactions/{transaction_id}
DELETE /api/transactions/{transaction_id}
```

### **Utility Endpoints**
```
GET /api/balance?client_slug={slug}
GET /api/exchange-rates
GET /api/pdf-report?client_slug={slug}&from={date}&to={date}
```

## 🧪 Testing

### **Features Testate**
- ✅ CRUD Transazioni completo
- ✅ Autenticazione e autorizzazione
- ✅ Multi-valuta USD/EUR/GBP
- ✅ Filtri e ricerca avanzata
- ✅ Generazione PDF report
- ✅ AI Insights e analytics
- ✅ Integrazione WhatsApp
- ✅ Responsive design

## 🚀 Roadmap Future

### **🔮 Prossime Features**
- 📱 **App Mobile Nativa** - iOS/Android
- 🤖 **Chatbot AI** - Assistente conversazionale
- 📧 **Report Automatici** - Email settimanali/mensili
- 🔗 **Bank Integration** - Import automatico transazioni
- 📸 **OCR Fatture** - Scan automatico documenti
- 🔔 **Push Notifications** - Alert real-time

### **🛠️ Tech Improvements**
- ⚡ **Performance Optimization** - Lazy loading, caching
- 🔒 **Enhanced Security** - 2FA, audit logs
- 🌐 **Internationalization** - Più lingue
- 📊 **Advanced Analytics** - Machine learning predictions

## 👨‍💻 Supporto & Manutenzione

### **📞 Contatti**
- **WhatsApp:** +39 377 241 1743
- **Email:** support@contabilita-alpha.com

### **🔧 Manutenzione**
- 🔄 **Auto-updates** via Vercel
- 📊 **Monitoring** - Performance e uptime
- 💾 **Backup automatici** - Database MongoDB
- 📈 **Analytics usage** - Google Analytics

---

## 📄 License

MIT License - Vedere `LICENSE` file per dettagli.

---

**🌟 Sviluppato con ❤️ per la gestione contabile professionale**

*"La tecnologia al servizio della contabilità moderna"*
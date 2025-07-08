# 📖 Guida Utente - Contabilità Alpha

**Guida completa per utilizzare il sistema senza essere un programmatore**

## 🎯 Come Accedere all'App

### **🌐 URL Principale**
L'app è disponibile all'indirizzo: `https://contabilita-alpha.vercel.app`

### **🔑 Credenziali di Accesso**
- **Password Admin:** `alpha2024!`
- **Cambia questa password** nella sezione amministratore per sicurezza

---

## 👥 Gestione Clienti

### **📋 Dashboard Amministratore**
1. Vai su `https://contabilita-alpha.vercel.app`
2. Inserisci la password admin
3. Vedrai la lista di tutti i clienti con i loro bilanci

### **➕ Aggiungere un Nuovo Cliente**
1. Clicca su **"Nuovo Cliente"**
2. Inserisci il nome (es: "Mario Rossi")
3. Il sistema creerà automaticamente un link unico (es: `/cliente/mario-rossi`)
4. Condividi questo link con il cliente

### **✏️ Modificare un Cliente**
1. Clicca sull'icona **✏️** accanto al nome del cliente
2. Modifica il nome
3. Salva le modifiche

### **🗑️ Eliminare un Cliente**
1. Clicca sull'icona **🗑️** rossa
2. Conferma l'eliminazione
3. ⚠️ **Attenzione:** Tutti i dati del cliente verranno persi!

---

## 💰 Gestione Transazioni

### **📊 Terminologia Contabile**
- **AVERE (💚)** = Entrate (soldi che entrano)
- **DARE (❌)** = Uscite (soldi che escono)
- **Saldo Netto** = Totale Avere - Totale Dare

### **➕ Aggiungere una Transazione**
1. Dalla dashboard admin o dalla pagina cliente
2. Clicca **"Nuova Transazione"**
3. Compila i campi:
   - **Importo:** Cifra in euro (es: 150.50)
   - **Descrizione:** Cosa rappresenta (es: "Fattura n. 123")
   - **Tipo:** AVERE (entrata) o DARE (uscita)
   - **Categoria:** Cash, Bonifico, PayPal, Carte, Altro
   - **Valuta:** EUR, USD, GBP (con conversione automatica)
   - **Data:** Giorno della transazione
4. Clicca **"Aggiungi Transazione"**

### **✏️ Modificare una Transazione**
1. Clicca sull'icona **✏️** nella lista transazioni
2. Modifica i campi necessari
3. La data può essere cambiata per transazioni retroattive
4. Salva le modifiche

### **🗑️ Eliminare una Transazione**
1. Clicca sull'icona **🗑️** rossa
2. Conferma l'eliminazione

---

## 🔍 Filtri e Ricerca

### **📋 Filtri Disponibili**
1. **Ricerca:** Cerca per descrizione (es: "fattura")
2. **Categoria:** Filtra per tipo di pagamento
3. **Tipo:** Solo entrate, solo uscite, o entrambe
4. **Date:** Periodo specifico (da/a)

### **💡 Come Usare i Filtri**
1. Clicca su **"Filtri"** nella pagina cliente
2. Compila i campi desiderati
3. I risultati si aggiornano automaticamente
4. Clicca **"Nascondi Filtri"** per chiudere

---

## 📊 Analytics e Insights

### **🧠 Insights Intelligenti**
L'app analizza automaticamente i dati e mostra:
- **Miglior mese:** Il periodo con più guadagni
- **Tendenze spese:** Se stanno aumentando o diminuendo
- **Categoria principale:** Dove si spende di più
- **Previsioni:** Stime per fine mese
- **Punteggio finanziario:** Valutazione da 1 a 10

### **📈 Grafici Analytics**
- **Trend Mensile:** Entrate vs Uscite degli ultimi 6 mesi
- **Spese per Categoria:** Distribuzione percentuale delle uscite

---

## 📄 Report PDF

### **📥 Generare un Report**
1. Dalla pagina cliente, clicca **"Scarica PDF"**
2. Seleziona il periodo (da/a)
3. Clicca **"Genera PDF"**
4. Il file si scaricherà automaticamente

### **📋 Contenuto del Report**
- Intestazione con logo e periodo
- Lista completa delle transazioni
- Totali per categoria
- Bilancio finale

---

## 💬 Assistenza WhatsApp

### **📱 Come Funziona**
- Ogni pagina cliente ha un **pulsante WhatsApp verde** in basso a destra
- Clicca per aprire una chat con te
- Il messaggio include automaticamente il nome del cliente
- **Numero:** +39 377 241 1743

### **✏️ Modificare il Numero**
Se vuoi cambiare il numero WhatsApp, contatta il tuo sviluppatore con il nuovo numero.

---

## 💱 Multi-Valuta

### **🌍 Valute Supportate**
- **EUR** (Euro) - Valuta principale
- **USD** (Dollaro americano)
- **GBP** (Sterlina inglese)

### **💰 Come Funziona**
1. Quando inserisci una transazione in USD o GBP
2. L'app converte automaticamente in EUR per il bilancio
3. Ma mostra sempre l'importo originale nella lista
4. Es: Transazione di $100 → Si vede "$100" ma conta come €92 nel totale

---

## 🔐 Sicurezza

### **🔑 Password Admin**
- Cambia la password predefinita `alpha2024!`
- Usa una password forte (lettere, numeri, simboli)
- Non condividerla con nessuno

### **🔗 Link Clienti**
- Ogni cliente ha un link unico e sicuro
- Non contengono informazioni sensibili
- Possono essere condivisi liberamente

### **💾 Backup Dati**
- Tutti i dati sono salvati automaticamente nel cloud
- Non rischi di perdere informazioni
- Backup giornalieri automatici

---

## 🆘 Risoluzione Problemi

### **❌ Problemi Comuni**

#### **"Non riesco ad accedere"**
- Verifica di aver inserito la password corretta
- Controlla di essere su `https://contabilita-alpha.vercel.app`
- Prova a ricaricare la pagina

#### **"Il saldo non è corretto"**
- Controlla che tutte le transazioni siano del tipo giusto (AVERE/DARE)
- Verifica le date delle transazioni
- Le transazioni USD/GBP vengono convertite automaticamente

#### **"Non vedo le transazioni"**
- Controlla i filtri attivi
- Verifica di essere nella pagina del cliente giusto
- Prova a ricaricare la pagina

#### **"Il PDF non si scarica"**
- Verifica che il browser consenta i download
- Prova con un browser diverso
- Controlla la connessione internet

### **📞 Supporto Diretto**
- **WhatsApp:** +39 377 241 1743
- **Email:** support@contabilita-alpha.com

---

## 📱 Utilizzo da Mobile

### **📲 App Mobile**
- L'app funziona perfettamente su smartphone e tablet
- Non serve installare nulla, usa il browser
- Tutti i grafici e funzionalità sono ottimizzati per mobile

### **🔖 Aggiungere alla Home**
Su smartphone:
1. Apri l'app nel browser
2. Menu → "Aggiungi alla schermata Home"
3. Avrà un'icona come una vera app

---

## 🔄 Aggiornamenti

### **🆕 Nuove Funzionalità**
L'app si aggiorna automaticamente con nuove features:
- Riceverai notifiche per le novità importanti
- Non devi fare nulla, tutto avviene in automatico
- La cronologia e i dati rimangono sempre al sicuro

### **📋 Roadmap Future**
Prossime funzionalità in arrivo:
- App mobile nativa iOS/Android
- Chatbot AI per assistenza automatica
- Report automatici via email
- Collegamento diretto con le banche
- Scan automatico fatture con foto

---

## 💡 Consigli d'Uso

### **🎯 Best Practices**

#### **📝 Descrizioni Chiare**
- Usa descrizioni dettagliate: "Fattura #123 - Fornitore ABC"
- Evita: "Pagamento" (troppo generico)

#### **🗂️ Categorie Coerenti**
- Usa sempre la stessa categoria per lo stesso tipo di pagamento
- Es: Sempre "Bonifico" per i pagamenti bancari

#### **📅 Date Accurate**
- Inserisci sempre la data reale della transazione
- Puoi modificare date passate se necessario

#### **💰 Controlli Periodici**
- Verifica il saldo almeno una volta a settimana
- Controlla gli insights per tendenze interessanti
- Scarica PDF mensili per backup

---

**🌟 Buon lavoro con la tua Contabilità Alpha!**

*"La tecnologia al servizio della contabilità moderna"*
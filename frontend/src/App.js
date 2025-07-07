import React, { useState, useEffect } from 'react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [currentView, setCurrentView] = useState('admin'); // 'admin' or 'client'
  const [currentClientSlug, setCurrentClientSlug] = useState('');
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [balance, setBalance] = useState({
    balance: 0,
    total_avere: 0,
    total_dare: 0
  });
  const [showLogin, setShowLogin] = useState(false);
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);
  const [showEditClientForm, setShowEditClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken') || '');
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    type: 'dare',
    category: 'Cash',
    client_id: ''
  });
  const [editFormData, setEditFormData] = useState({
    amount: '',
    description: '',
    type: 'dare',
    category: 'Cash',
    client_id: ''
  });
  const [clientFormData, setClientFormData] = useState({
    name: ''
  });
  const [editClientFormData, setEditClientFormData] = useState({
    name: ''
  });
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    type: '',
    dateFrom: '',
    dateTo: ''
  });
  const [loginPassword, setLoginPassword] = useState('');

  const categories = ['Cash', 'Carte', 'Bonifico', 'PayPal', 'Altro'];

  // Helper function to get current week dates (Monday to Sunday)
  const getCurrentWeekDates = (date = new Date()) => {
    const today = new Date(date);
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Calculate Monday of current week
    const monday = new Date(today);
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days
    monday.setDate(today.getDate() + daysToMonday);
    
    // Calculate Sunday of current week
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return {
      monday: monday.toLocaleDateString('it-IT'),
      sunday: sunday.toLocaleDateString('it-IT'),
      mondayISO: monday.toISOString()
    };
  };

  // Helper function to get next week dates
  const getNextWeekDates = (lastDate) => {
    const lastWeek = new Date(lastDate);
    const nextMonday = new Date(lastWeek);
    nextMonday.setDate(lastWeek.getDate() + 7); // Add 7 days to get next Monday
    
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    
    return {
      monday: nextMonday.toLocaleDateString('it-IT'),
      sunday: nextSunday.toLocaleDateString('it-IT'),
      mondayISO: nextMonday.toISOString()
    };
  };

  // Special function for Bill's weekly card income
  const handleBillWeeklyTransaction = () => {
    if (selectedClient?.name === 'Bill' && formData.type === 'avere') {
      // Get the last transaction date for Bill to calculate next week
      const billTransactions = transactions.filter(t => t.client_id === selectedClient.id);
      
      let weekDates;
      if (billTransactions.length > 0) {
        // Get the most recent transaction date and calculate next week
        const lastTransaction = billTransactions[0]; // Already sorted by date desc
        const lastDate = new Date(lastTransaction.date);
        weekDates = getNextWeekDates(lastDate);
      } else {
        // If no transactions, use current week
        weekDates = getCurrentWeekDates();
      }
      
      setFormData({
        ...formData,
        description: `Incasso carte settimanale dal ${weekDates.monday} al ${weekDates.sunday}`,
        category: 'Cash'
      });
    }
  };

  // Effect to auto-fill Bill's weekly transaction when type changes to 'avere'
  useEffect(() => {
    if (selectedClient?.name === 'Bill' && formData.type === 'avere' && !formData.description) {
      handleBillWeeklyTransaction();
    }
  }, [formData.type, selectedClient]);

  useEffect(() => {
    // Check URL for client slug
    const path = window.location.pathname;
    const clientMatch = path.match(/\/cliente\/(.+)/);
    
    if (clientMatch) {
      const slug = clientMatch[1];
      setCurrentClientSlug(slug);
      setCurrentView('client');
      fetchClientData(slug);
    } else {
      setCurrentView('admin');
      // Always try to fetch clients for public view
      fetchClientsPublic();
      if (adminToken) {
        setIsAdmin(true);
        fetchClients();
      }
    }
  }, [adminToken]);

  useEffect(() => {
    if (currentView === 'admin' && isAdmin) {
      fetchClients();
    }
  }, [currentView, isAdmin]);

  useEffect(() => {
    if (currentView === 'admin' && selectedClient) {
      fetchTransactions();
      fetchBalance();
    } else if (currentView === 'client' && currentClientSlug) {
      fetchTransactions(currentClientSlug);
      fetchBalance(currentClientSlug);
    }
  }, [currentView, currentClientSlug, selectedClient, adminToken]);

  useEffect(() => {
    applyFilters();
  }, [transactions, filters]);

  const fetchClientData = async (slug) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/clients/${slug}`);
      if (response.ok) {
        const clientData = await response.json();
        setSelectedClient(clientData);
        fetchTransactions(slug);
        fetchBalance(slug);
      } else {
        setCurrentView('admin');
      }
    } catch (error) {
      console.error('Error fetching client:', error);
      setCurrentView('admin');
    }
  };

  const fetchClients = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/clients`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchClientsPublic = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/clients/public`);
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error fetching public clients:', error);
    }
  };

  const fetchTransactions = async (clientSlug = null) => {
    try {
      let url = `${BACKEND_URL}/api/transactions`;
      if (clientSlug) {
        url += `?client_slug=${clientSlug}`;
      } else if (selectedClient) {
        // For admin view, get transactions for selected client
        url += `?client_slug=${selectedClient.slug}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      setTransactions(data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const fetchBalance = async (clientSlug = null) => {
    try {
      let url = `${BACKEND_URL}/api/balance`;
      if (clientSlug) {
        url += `?client_slug=${clientSlug}`;
      } else if (selectedClient) {
        // For admin view, get balance for selected client
        url += `?client_slug=${selectedClient.slug}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      setBalance(data);
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const handleLogin = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: loginPassword }),
      });

      const data = await response.json();
      
      if (data.success) {
        setAdminToken(data.token);
        localStorage.setItem('adminToken', data.token);
        setIsAdmin(true);
        setShowLogin(false);
        setLoginPassword('');
        alert('Login amministratore riuscito!');
        fetchClients();
      } else {
        alert('Password errata. Solo l\'amministratore può inserire dati.');
      }
    } catch (error) {
      console.error('Error during login:', error);
      alert('Errore durante il login');
    }
  };

  const handlePasswordRecovery = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/recover-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`✅ ${data.message}\n\nControlla la tua email ildattero.it@gmail.com per la password.`);
        setShowPasswordRecovery(false);
      } else {
        alert(`❌ ${data.message}`);
      }
    } catch (error) {
      console.error('Error during password recovery:', error);
      alert('Errore durante il recupero password');
    }
  };

  const openPasswordRecovery = () => {
    setShowLogin(false);
    setShowPasswordRecovery(true);
  };

  const handleLogout = () => {
    setAdminToken('');
    localStorage.removeItem('adminToken');
    setIsAdmin(false);
    setShowForm(false);
    setCurrentView('admin');
    alert('Logout effettuato. Ora sei in modalità solo lettura.');
  };

  const applyFilters = () => {
    let filtered = [...transactions];

    if (filters.search) {
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    if (filters.category) {
      filtered = filtered.filter(t => t.category === filters.category);
    }

    if (filters.type) {
      filtered = filtered.filter(t => t.type === filters.type);
    }

    if (filters.dateFrom) {
      filtered = filtered.filter(t => 
        new Date(t.date) >= new Date(filters.dateFrom)
      );
    }

    if (filters.dateTo) {
      filtered = filtered.filter(t => 
        new Date(t.date) <= new Date(filters.dateTo + 'T23:59:59')
      );
    }

    setFilteredTransactions(filtered);
  };

  const MAX_CLIENTS = 30; // Limite massimo clienti (Piano Gratuito)

  const handleClientSubmit = async (e) => {
    e.preventDefault();
    
    if (!clientFormData.name) {
      alert('Per favore inserisci il nome del cliente');
      return;
    }

    // Check client limit
    if (clients.length >= MAX_CLIENTS) {
      alert(`❌ Limite raggiunto!\n\nPuoi avere massimo ${MAX_CLIENTS} clienti.\nElimina un cliente esistente per aggiungerne uno nuovo.`);
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: clientFormData.name
        }),
      });

      if (response.ok) {
        const newClient = await response.json();
        setClientFormData({ name: '' });
        setShowClientForm(false);
        fetchClients();
        alert(`✅ Cliente "${newClient.name}" creato con successo!\n\nLink condivisibile: ${window.location.origin}/cliente/${newClient.slug}\n\nClienti: ${clients.length + 1}/${MAX_CLIENTS}`);
      } else {
        const errorData = await response.json();
        alert(`Errore: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Error creating client:', error);
      alert('Errore nel creare il cliente');
    }
  };

  const handleEditClient = (client) => {
    if (!isAdmin) {
      alert('Solo l\'amministratore può modificare clienti');
      return;
    }

    setEditingClient(client);
    setEditClientFormData({
      name: client.name
    });
    setShowEditClientForm(true);
  };

  const handleEditClientSubmit = async (e) => {
    e.preventDefault();
    
    if (!editClientFormData.name) {
      alert('Per favore inserisci il nome del cliente');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/clients/${editingClient.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          name: editClientFormData.name
        }),
      });

      if (response.ok) {
        const updatedClient = await response.json();
        setEditClientFormData({ name: '' });
        setShowEditClientForm(false);
        setEditingClient(null);
        fetchClients();
        alert(`✅ Cliente rinominato in "${updatedClient.name}" con successo!\n\nNuovo link: ${window.location.origin}/cliente/${updatedClient.slug}`);
      } else {
        const errorData = await response.json();
        alert(`Errore: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Error updating client:', error);
      alert('Errore nel modificare il cliente');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isAdmin) {
      alert('Solo l\'amministratore può inserire transazioni');
      return;
    }

    if (!formData.amount) {
      alert('Per favore inserisci l\'importo');
      return;
    }

    if (!formData.client_id) {
      alert('Per favore seleziona un cliente');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          client_id: formData.client_id,
          amount: parseFloat(formData.amount),
          description: formData.description || 'Transazione senza descrizione',
          type: formData.type,
          category: formData.category,
          date: new Date().toISOString()
        }),
      });

      if (response.ok) {
        setFormData({
          amount: '',
          description: '',
          type: 'dare',
          category: 'Cash',
          client_id: ''
        });
        setShowForm(false);
        fetchTransactions();
        fetchBalance();
        alert('✅ Transazione creata con successo!');
      } else {
        const errorData = await response.json();
        alert(`Errore: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Error creating transaction:', error);
      alert('Errore nel salvare la transazione');
    }
  };

  const handleEdit = (transaction) => {
    if (!isAdmin) {
      alert('Solo l\'amministratore può modificare transazioni');
      return;
    }

    setEditingTransaction(transaction);
    setEditFormData({
      amount: transaction.amount.toString(),
      description: transaction.description,
      type: transaction.type,
      category: transaction.category,
      client_id: transaction.client_id
    });
    setShowEditForm(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    
    if (!editFormData.amount) {
      alert('Per favore inserisci l\'importo');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/transactions/${editingTransaction.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          client_id: editFormData.client_id,
          amount: parseFloat(editFormData.amount),
          description: editFormData.description || 'Transazione senza descrizione',
          type: editFormData.type,
          category: editFormData.category,
          date: editingTransaction.date
        }),
      });

      if (response.ok) {
        setShowEditForm(false);
        setEditingTransaction(null);
        setEditFormData({
          amount: '',
          description: '',
          type: 'dare',
          category: 'Cash',
          client_id: ''
        });
        fetchTransactions();
        fetchBalance();
        alert('✅ Transazione modificata con successo!');
      } else {
        const errorData = await response.json();
        alert(`Errore: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Errore nel modificare la transazione');
    }
  };

  const handleDelete = async (transaction) => {
    if (!isAdmin) {
      alert('Solo l\'amministratore può eliminare transazioni');
      return;
    }

    if (window.confirm(`Sei sicuro di voler eliminare questa transazione?\n\n"${transaction.description}" - ${formatCurrency(transaction.amount)}`)) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/transactions/${transaction.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${adminToken}`
          }
        });

        if (response.ok) {
          fetchTransactions();
          fetchBalance();
          alert('✅ Transazione eliminata con successo!');
        } else {
          const errorData = await response.json();
          alert(`Errore: ${errorData.detail}`);
        }
      } catch (error) {
        console.error('Error deleting transaction:', error);
        alert('Errore nell\'eliminare la transazione');
      }
    }
  };

  const handleDeleteClient = async (client) => {
    if (window.confirm(`Sei sicuro di voler eliminare il cliente "${client.name}" e tutte le sue transazioni?\n\nQuesta azione è irreversibile!`)) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/clients/${client.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${adminToken}`
          }
        });

        if (response.ok) {
          fetchClients();
          alert('✅ Cliente eliminato con successo!');
        } else {
          const errorData = await response.json();
          alert(`Errore: ${errorData.detail}`);
        }
      } catch (error) {
        console.error('Error deleting client:', error);
        alert('Errore nell\'eliminare il cliente');
      }
    }
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      category: '',
      type: '',
      dateFrom: '',
      dateTo: ''
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getTypeIcon = (type) => {
    return type === 'avere' ? '💰' : '💸';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Cash': '💵',
      'Bonifico': '🏦',
      'PayPal': '📱',
      'Altro': '📋'
    };
    return icons[category] || '📋';
  };

  const [showPDFModal, setShowPDFModal] = useState(false);
  const [pdfDateFilters, setPdfDateFilters] = useState({
    dateFrom: '',
    dateTo: ''
  });
  const [language, setLanguage] = useState('it'); // 'it' or 'en'

  // Translations
  const translations = {
    it: {
      // Header
      title: "Contabilità Alpha",
      subtitle: "Sistema Multi-Cliente Professionale",
      adminMode: "🔐 Modalità Amministratore",
      readOnlyMode: "👁️ Modalità Solo Lettura",
      viewOnly: "Visualizzazione solo lettura",
      
      // Buttons
      logout: "Logout",
      loginAdmin: "Login Admin",
      newClient: "Nuovo Cliente",
      newTransaction: "Nuova Transazione",
      filters: "🔍 Cronologia e Filtri",
      hideFilters: "Nascondi Filtri",
      downloadPDF: "📄 Scarica PDF",
      copyLink: "🔗 Copia Link",
      view: "👁️ Visualizza",
      edit: "✏️ Modifica",
      delete: "🗑️ Elimina",
      save: "Salva",
      cancel: "Annulla",
      
      // Forms
      clientName: "Nome Cliente",
      amount: "Importo (€)",
      description: "Descrizione (opzionale)",
      type: "Tipo Operazione",
      category: "Metodo di Pagamento",
      dateFrom: "Data inizio",
      dateTo: "Data fine",
      
      // Transaction types
      dare: "Dare (Uscita/Debito)",
      avere: "Avere (Entrata/Credito)",
      
      // Categories
      cash: "Cash",
      carte: "Carte", 
      bonifico: "Bonifico",
      paypal: "PayPal",
      altro: "Altro",
      
      // Balance
      totalAvere: "Totale Avere (Crediti)",
      totalDare: "Totale Dare (Debiti)",
      netBalance: "Saldo Netto",
      
      // PDF
      pdfTitle: "📄 Scarica Estratto Conto PDF",
      pdfSubtitle: "Seleziona il periodo per l'estratto conto (lascia vuoto per tutte le transazioni)",
      
      // Messages
      loginSuccess: "Login amministratore riuscito!",
      wrongPassword: "Password errata. Solo l'amministratore può inserire dati.",
      logoutMessage: "Logout effettuato. Ora sei in modalità solo lettura.",
      pdfSuccess: "✅ PDF scaricato con successo!",
      pdfError: "❌ Errore nel download del PDF. Riprova più tardi.",
      
      // Transactions
      transactionHistory: "Registro Transazioni",
      noTransactions: "Nessuna transazione trovata",
      noTransactionsFiltered: "Nessuna transazione trovata con i filtri selezionati",
      totalTransactions: "Totale transazioni",
      clientManagement: "👥 Gestione Clienti"
    },
    en: {
      // Header
      title: "Alpha Accounting",
      subtitle: "Professional Multi-Client System",
      adminMode: "🔐 Administrator Mode",
      readOnlyMode: "👁️ Read-Only Mode", 
      viewOnly: "Read-only view",
      
      // Buttons
      logout: "Logout",
      loginAdmin: "Admin Login",
      newClient: "New Client",
      newTransaction: "New Transaction",
      filters: "🔍 History & Filters",
      hideFilters: "Hide Filters",
      downloadPDF: "📄 Download PDF",
      copyLink: "🔗 Copy Link",
      view: "👁️ View",
      edit: "✏️ Edit",
      delete: "🗑️ Delete",
      save: "Save",
      cancel: "Cancel",
      
      // Forms
      clientName: "Client Name",
      amount: "Amount (€)",
      description: "Description (optional)",
      type: "Operation Type",
      category: "Payment Method",
      dateFrom: "Start date",
      dateTo: "End date",
      
      // Transaction types
      dare: "Debit (Expense/Debt)",
      avere: "Credit (Income/Asset)",
      
      // Categories  
      cash: "Cash",
      carte: "Cards",
      bonifico: "Bank Transfer", 
      paypal: "PayPal",
      altro: "Other",
      
      // Balance
      totalAvere: "Total Credit (Assets)",
      totalDare: "Total Debit (Expenses)",
      netBalance: "Net Balance",
      
      // PDF
      pdfTitle: "📄 Download Account Statement PDF",
      pdfSubtitle: "Select period for the statement (leave empty for all transactions)",
      
      // Messages
      loginSuccess: "Administrator login successful!",
      wrongPassword: "Wrong password. Only administrator can enter data.",
      logoutMessage: "Logout completed. You are now in read-only mode.",
      pdfSuccess: "✅ PDF downloaded successfully!",
      pdfError: "❌ Error downloading PDF. Please try again later.",
      
      // Transactions
      transactionHistory: "Transaction Register",
      noTransactions: "No transactions found",
      noTransactionsFiltered: "No transactions found with selected filters",
      totalTransactions: "Total transactions",
      clientManagement: "👥 Client Management"
    }
  };

  const t = (key) => translations[language][key] || key;

  // Smart translation for transaction descriptions and categories
  const translateText = (text) => {
    if (language === 'it' || !text) return text;
    
    let translated = text;
    
    // Common transaction terms - case insensitive
    const termTranslations = {
      'Bonifico': 'Bank Transfer',
      'bonifico': 'Bank Transfer',
      'Incasso carte settimanale': 'Weekly card income',
      'incasso carte settimanale': 'Weekly card income',
      'Riporto Capitolo': 'Chapter Report',
      'riporto capitolo': 'Chapter Report',
      'dal': 'from',
      'al': 'to',
      'Avere': 'Credit',
      'avere': 'Credit', 
      'Dare': 'Debit',
      'dare': 'Debit',
      'Cash': 'Cash',
      'cash': 'Cash',
      'Carte': 'Cards',
      'carte': 'Cards',
      'PayPal': 'PayPal',
      'paypal': 'PayPal',
      'Altro': 'Other',
      'altro': 'Other'
    };
    
    // Replace each term
    Object.entries(termTranslations).forEach(([italian, english]) => {
      // Use global flag and word boundaries
      translated = translated.replace(new RegExp(italian, 'g'), english);
    });
    
    return translated;
  };

  const downloadClientPDF = async (clientSlug, dateFrom = '', dateTo = '') => {
    try {
      let url = `${BACKEND_URL}/api/clients/${clientSlug}/pdf`;
      const params = new URLSearchParams();
      
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        
        let filename = `estratto_conto_${clientSlug}`;
        if (dateFrom && dateTo) {
          filename += `_${dateFrom}_${dateTo}`;
        } else if (dateFrom) {
          filename += `_dal_${dateFrom}`;
        } else if (dateTo) {
          filename += `_al_${dateTo}`;
        }
        filename += `_${new Date().toISOString().split('T')[0]}.pdf`;
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
        alert(t('pdfSuccess'));
      } else {
        throw new Error('Errore nel download');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert(t('pdfError'));
    }
  };

  const downloadPDF = async (dateFrom = '', dateTo = '') => {
    try {
      let url = `${BACKEND_URL}/api/clients/${currentClientSlug}/pdf`;
      const params = new URLSearchParams();
      
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        
        let filename = `estratto_conto_${currentClientSlug}`;
        if (dateFrom && dateTo) {
          filename += `_${dateFrom}_${dateTo}`;
        } else if (dateFrom) {
          filename += `_dal_${dateFrom}`;
        } else if (dateTo) {
          filename += `_al_${dateTo}`;
        }
        filename += `_${new Date().toISOString().split('T')[0]}.pdf`;
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
        alert(t('pdfSuccess'));
      } else {
        throw new Error('Errore nel download');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert(t('pdfError'));
    }
  };

  const handlePDFDownload = (clientSlug = null) => {
    setShowPDFModal(true);
    // Se non specificato, usa il client corrente
    if (!clientSlug && currentView === 'client') {
      clientSlug = currentClientSlug;
    } else if (!clientSlug && selectedClient) {
      clientSlug = selectedClient.slug;
    }
    // Memorizza il client slug per il download
    setPdfDateFilters(prev => ({...prev, targetClientSlug: clientSlug}));
  };

  const handlePDFDownloadConfirm = () => {
    const clientSlug = pdfDateFilters.targetClientSlug || currentClientSlug || selectedClient?.slug;
    downloadClientPDF(clientSlug, pdfDateFilters.dateFrom, pdfDateFilters.dateTo);
    setShowPDFModal(false);
    setPdfDateFilters({ dateFrom: '', dateTo: '', targetClientSlug: '' });
  };

  const handleResetClientLink = async (client) => {
    if (window.confirm(`Sei sicuro di voler resettare il link di accesso per ${client.name}?\n\nIl vecchio link diventerà inaccessibile e ne verrà generato uno nuovo.`)) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/clients/${client.id}/reset-link`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token: adminToken })
        });

        if (response.ok) {
          const updatedClient = await response.json();
          
          // Update the client in the local state
          setClients(prevClients => 
            prevClients.map(c => 
              c.id === client.id 
                ? { ...c, slug: updatedClient.slug }
                : c
            )
          );
          
          // Show new link
          const newLink = `${window.location.origin}/cliente/${updatedClient.slug}`;
          alert(`✅ Link resettato con successo!\n\nNuovo link:\n${newLink}\n\nIl vecchio link non è più accessibile.`);
          
        } else {
          throw new Error('Errore nel reset del link');
        }
      } catch (error) {
        console.error('Error resetting client link:', error);
        alert('❌ Errore nel reset del link. Riprova più tardi.');
      }
    }
  };

  const copyClientLink = (client) => {
    const link = `${window.location.origin}/cliente/${client.slug}`;
    navigator.clipboard.writeText(link);
    alert(`🔗 Link copiato negli appunti!\n\n${link}`);
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Cliente sconosciuto';
  };

  // ADMIN DASHBOARD VIEW
  if (currentView === 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mb-4">
              <div className="mx-auto h-24 w-24 flex items-center justify-center">
                <svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="alphaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#9855FF"/>
                      <stop offset="50%" stopColor="#8333EA"/>
                      <stop offset="100%" stopColor="#D946EF"/>
                    </linearGradient>
                    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.2"/>
                    </filter>
                  </defs>
                  
                  {/* Calculator base */}
                  <rect x="12" y="12" width="72" height="72" rx="12" ry="12" 
                        fill="url(#alphaGradient)" filter="url(#shadow)"/>
                  
                  {/* Calculator screen */}
                  <rect x="18" y="18" width="60" height="16" rx="4" ry="4" 
                        fill="#ffffff" opacity="0.9"/>
                  
                  {/* Calculator buttons grid */}
                  <circle cx="26" cy="46" r="3" fill="#ffffff" opacity="0.3"/>
                  <circle cx="38" cy="46" r="3" fill="#ffffff" opacity="0.3"/>
                  <circle cx="50" cy="46" r="3" fill="#ffffff" opacity="0.3"/>
                  <circle cx="62" cy="46" r="3" fill="#ffffff" opacity="0.3"/>
                  <circle cx="70" cy="46" r="3" fill="#ffffff" opacity="0.3"/>
                  
                  <circle cx="26" cy="58" r="3" fill="#ffffff" opacity="0.3"/>
                  <circle cx="38" cy="58" r="3" fill="#ffffff" opacity="0.3"/>
                  <circle cx="50" cy="58" r="3" fill="#ffffff" opacity="0.3"/>
                  <circle cx="62" cy="58" r="3" fill="#ffffff" opacity="0.3"/>
                  <circle cx="70" cy="58" r="3" fill="#ffffff" opacity="0.3"/>
                  
                  <circle cx="26" cy="70" r="3" fill="#ffffff" opacity="0.3"/>
                  <circle cx="38" cy="70" r="3" fill="#ffffff" opacity="0.3"/>
                  <circle cx="50" cy="70" r="3" fill="#ffffff" opacity="0.3"/>
                  <circle cx="62" cy="70" r="3" fill="#ffffff" opacity="0.3"/>
                  <circle cx="70" cy="70" r="3" fill="#ffffff" opacity="0.3"/>
                  
                  {/* Letter A overlay */}
                  <path d="M48 20 L35 68 L41 68 L44 58 L52 58 L55 68 L61 68 L48 20 Z M46 50 L50 50 L48 42 Z" 
                        fill="#ffffff" opacity="0.95" stroke="none"/>
                  
                  {/* Accent elements */}
                  <circle cx="22" cy="25" r="2" fill="#ffffff" opacity="0.6"/>
                  <circle cx="74" cy="25" r="2" fill="#ffffff" opacity="0.6"/>
                </svg>
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              {t('title')}
            </h1>
            <p className="text-gray-600">{t('subtitle')}</p>
            
            {/* Language Toggle */}
            <div className="mt-4">
              <button
                onClick={() => setLanguage(language === 'it' ? 'en' : 'it')}
                className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200"
              >
                {language === 'it' ? '🇬🇧 English' : '🇮🇹 Italiano'}
              </button>
            </div>
            
            {/* Admin Status */}
            <div className="mt-4">
              {isAdmin ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                    {t('adminMode')}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200"
                  >
                    {t('logout')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                    {t('readOnlyMode')}
                  </span>
                  <button
                    onClick={() => setShowLogin(true)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200"
                  >
                    {t('loginAdmin')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Login Modal */}
          {showLogin && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-xl p-6 w-96">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Login Amministratore</h2>
                <p className="text-gray-600 mb-4">
                  Inserisci la password per accedere alle funzioni di gestione
                </p>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                  placeholder="Password amministratore"
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                />
                <div className="flex gap-4 mb-4">
                  <button
                    onClick={handleLogin}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => {setShowLogin(false); setLoginPassword('');}}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    Annulla
                  </button>
                </div>
                <div className="text-center">
                  <button
                    onClick={openPasswordRecovery}
                    className="text-blue-600 hover:text-blue-800 text-sm underline"
                  >
                    🔑 Hai dimenticato la password?
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Password Recovery Modal */}
          {showPasswordRecovery && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl shadow-xl p-6 w-96">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">📧 Recupera Password</h2>
                <p className="text-gray-600 mb-6">
                  Clicca il pulsante per ricevere la password via email all'indirizzo:
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                  <p className="text-blue-800 font-medium text-center">
                    📧 ildattero.it@gmail.com
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={handlePasswordRecovery}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    📧 Invia Password via Email
                  </button>
                  <button
                    onClick={() => {
                      setShowPasswordRecovery(false);
                      setShowLogin(true);
                    }}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    Indietro
                  </button>
                </div>
              </div>
            </div>
          )}

          {isAdmin && (
            <>
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4 justify-center mb-8">
                <button
                  onClick={() => setShowClientForm(!showClientForm)}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-full transition-colors duration-200 shadow-lg"
                >
                  {showClientForm ? t('cancel') : `+ ${t('newClient')}`}
                </button>
                <button
                  onClick={() => setShowForm(!showForm)}
                  className={`${selectedClient ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'} text-white font-bold py-3 px-6 rounded-full transition-colors duration-200 shadow-lg`}
                  disabled={!selectedClient}
                >
                  {showForm ? t('cancel') : `+ ${t('newTransaction')}`}
                  {!selectedClient && ` (${t('view')} ${t('clientName')})`}
                </button>
              </div>

              {/* Client Form */}
              {showClientForm && (
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border-2 border-green-200">
                  <h2 className="text-2xl font-bold text-green-800 mb-4">👥 Nuovo Cliente</h2>
                  <form onSubmit={handleClientSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome Cliente
                      </label>
                      <input
                        type="text"
                        value={clientFormData.name}
                        onChange={(e) => setClientFormData({...clientFormData, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Es: Mario Rossi, Azienda ABC, etc."
                      />
                    </div>
                    <div className="flex gap-4">
                      <button
                        type="submit"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                      >
                        👥 Crea Cliente
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowClientForm(false)}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                      >
                        Annulla
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Transaction Form */}
              {showForm && selectedClient && (
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">
                    💰 Nuova Transazione per {selectedClient.name}
                  </h2>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tipo Operazione
                        </label>
                        <select
                          value={formData.type}
                          onChange={(e) => setFormData({...formData, type: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="dare">Dare (Uscita/Debito)</option>
                          <option value="avere">Avere (Entrata/Credito)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Importo (€)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.amount}
                          onChange={(e) => setFormData({...formData, amount: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descrizione (opzionale)
                      </label>
                      <input
                        type="text"
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Descrizione della transazione (opzionale)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Metodo di Pagamento
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {getCategoryIcon(category)} {category}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-4">
                      <button
                        type="submit"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                        onClick={() => setFormData({...formData, client_id: selectedClient.id})}
                      >
                        💰 Salva Transazione
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                      >
                        Annulla
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Edit Transaction Form */}
              {showEditForm && isAdmin && editingTransaction && (
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border-2 border-orange-200">
                  <h2 className="text-2xl font-bold text-orange-800 mb-4">✏️ Modifica Transazione</h2>
                  <div className="bg-orange-50 p-3 rounded-lg mb-4">
                    <p className="text-orange-700 text-sm">
                      <strong>Cliente:</strong> {getClientName(editingTransaction.client_id)} | 
                      <strong> Originale:</strong> {editingTransaction.description} - {formatCurrency(editingTransaction.amount)}
                    </p>
                  </div>
                  <form onSubmit={handleEditSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tipo Operazione
                        </label>
                        <select
                          value={editFormData.type}
                          onChange={(e) => setEditFormData({...editFormData, type: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="dare">Dare (Uscita/Debito)</option>
                          <option value="avere">Avere (Entrata/Credito)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Importo (€)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editFormData.amount}
                          onChange={(e) => setEditFormData({...editFormData, amount: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descrizione (opzionale)
                      </label>
                      <input
                        type="text"
                        value={editFormData.description}
                        onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="Descrizione della transazione (opzionale)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Metodo di Pagamento
                      </label>
                      <select
                        value={editFormData.category}
                        onChange={(e) => setEditFormData({...editFormData, category: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {getCategoryIcon(category)} {category}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-4">
                      <button
                        type="submit"
                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                      >
                        ✏️ Salva Modifiche
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditForm(false);
                          setEditingTransaction(null);
                          setEditFormData({ amount: '', description: '', type: 'dare', category: 'Cash', client_id: '' });
                        }}
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                      >
                        Annulla
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}

          {/* Clients List */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{t('clientManagement')}</h2>
            {clients.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-lg">Nessun cliente trovato</div>
                <div className="text-gray-500 text-sm mt-2">
                  {isAdmin ? 'Inizia creando il tuo primo cliente!' : 'L\'amministratore non ha ancora creato clienti'}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clients.map((client) => (
                  <div
                    key={client.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                      selectedClient?.id === client.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                    onClick={() => setSelectedClient(client)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg text-gray-800">{client.name}</h3>
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClient(client);
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Elimina cliente"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>💰 Saldo: <span className={`font-bold ${client.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(client.balance)}
                      </span></div>
                      <div>📊 Transazioni: {client.total_transactions}</div>
                      <div>📅 Creato: {formatDate(client.created_date)}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyClientLink(client);
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded transition-colors duration-200"
                      >
                        {t('copyLink').replace('🔗 ', '')}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/cliente/${client.slug}`, '_blank');
                        }}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-1 px-2 rounded transition-colors duration-200"
                      >
                        {t('view').replace('👁️ ', '')}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadClientPDF(client.slug);
                        }}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-1 px-2 rounded transition-colors duration-200"
                      >
                        📄 PDF
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleResetClientLink(client);
                        }}
                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-xs py-1 px-2 rounded transition-colors duration-200"
                        title="Reset link di accesso"
                      >
                        🔄 Reset
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Client Transactions */}
          {selectedClient && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                📊 Transazioni - {selectedClient.name}
              </h2>
              
              {/* Balance for selected client */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-600">
                      {formatCurrency(balance.total_avere)}
                    </div>
                    <div className="text-sm text-gray-500">Totale Avere</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-red-600">
                      {formatCurrency(balance.total_dare)}
                    </div>
                    <div className="text-sm text-gray-500">Totale Dare</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${balance.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(balance.balance)}
                    </div>
                    <div className="text-sm text-gray-500">Saldo Netto</div>
                  </div>
                </div>
              </div>

              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-lg">Nessuna transazione per questo cliente</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.slice(0, 10).map((transaction) => (
                    <div
                      key={transaction.id}
                      className={`p-3 rounded-lg border-l-4 ${
                        transaction.type === 'avere' 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-red-500 bg-red-50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {getTypeIcon(transaction.type)}
                          </span>
                          <span>
                            {getCategoryIcon(transaction.category)}
                          </span>
                          <div>
                            <div className="font-medium text-sm">
                              {translateText(transaction.description)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {translateText(transaction.category)} • {formatDate(transaction.date)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`font-bold ${
                            transaction.type === 'avere' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'avere' ? '+' : '-'}{formatCurrency(transaction.amount)}
                          </div>
                          {isAdmin && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleEdit(transaction)}
                                className="text-blue-500 hover:text-blue-700 p-1 text-xs"
                                title="Modifica transazione"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDelete(transaction)}
                                className="text-red-500 hover:text-red-700 p-1 text-xs"
                                title="Elimina transazione"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {transactions.length > 10 && (
                    <div className="text-center text-gray-500 text-sm">
                      ... e altre {transactions.length - 10} transazioni
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* PDF Date Selection Modal - Admin View */}
        {showPDFModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-96">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">{t('pdfTitle')}</h2>
              <p className="text-gray-600 mb-4">
                {t('pdfSubtitle')}
              </p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('dateFrom')}
                  </label>
                  <input
                    type="date"
                    value={pdfDateFilters.dateFrom}
                    onChange={(e) => setPdfDateFilters({...pdfDateFilters, dateFrom: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('dateTo')}
                  </label>
                  <input
                    type="date"
                    value={pdfDateFilters.dateTo}
                    onChange={(e) => setPdfDateFilters({...pdfDateFilters, dateTo: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={handlePDFDownloadConfirm}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  {t('downloadPDF')}
                </button>
                <button
                  onClick={() => {
                    setShowPDFModal(false);
                    setPdfDateFilters({ dateFrom: '', dateTo: '', targetClientSlug: '' });
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // CLIENT VIEW
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <div className="mx-auto h-24 w-24 flex items-center justify-center">
              <img 
                src="data:image/png;base64,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" 
                alt="Alpha Logo" 
                className="h-20 w-20"
              />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            {t('title')}
          </h1>
          {selectedClient && (
            <p className="text-xl text-blue-600 font-medium">📊 {selectedClient.name}</p>
          )}
          <p className="text-gray-600">{t('viewOnly')}</p>
          
          {/* Language Toggle */}
          <div className="mt-4">
            <button
              onClick={() => setLanguage(language === 'it' ? 'en' : 'it')}
              className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200"
            >
              {language === 'it' ? '🇬🇧 English' : '🇮🇹 Italiano'}
            </button>
          </div>
        </div>

        {/* Balance Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(balance.total_avere)}
              </div>
              <div className="text-sm text-gray-500">{t('totalAvere')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(balance.total_dare)}
              </div>
              <div className="text-sm text-gray-500">{t('totalDare')}</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${balance.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(balance.balance)}
              </div>
              <div className="text-sm text-gray-500">{t('netBalance')}</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 justify-center mb-8">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full transition-colors duration-200 shadow-lg"
          >
            {showFilters ? t('hideFilters') : t('filters')}
          </button>
          <button
            onClick={() => handlePDFDownload()}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-full transition-colors duration-200 shadow-lg"
          >
            {t('downloadPDF')}
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Cronologia e Filtri</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cerca nella descrizione
                </label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Cerca..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filtra per metodo
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({...filters, category: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Tutti i metodi</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {getCategoryIcon(category)} {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filtra per tipo
                </label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({...filters, type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Tutti i tipi</option>
                  <option value="avere">Avere (Crediti)</option>
                  <option value="dare">Dare (Debiti)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data da
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data a
                </label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <button
                onClick={clearFilters}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                Cancella Filtri
              </button>
              <div className="text-sm text-gray-500 flex items-center">
                Trovate {filteredTransactions.length} transazioni
              </div>
            </div>
          </div>
        )}

        {/* Transactions List */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            {t('transactionHistory')}
            {showFilters && (
              <span className="text-sm text-gray-500 ml-2">
                ({filteredTransactions.length} di {transactions.length})
              </span>
            )}
          </h2>
          {(showFilters ? filteredTransactions : transactions).length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-lg">
                {showFilters && (filters.search || filters.category || filters.type || filters.dateFrom || filters.dateTo)
                  ? 'Nessuna transazione trovata con i filtri selezionati'
                  : 'Nessuna transazione trovata'
                }
              </div>
              <div className="text-gray-500 text-sm mt-2">
                {showFilters && (filters.search || filters.category || filters.type || filters.dateFrom || filters.dateTo)
                  ? 'Prova a modificare i filtri di ricerca'
                  : 'L\'amministratore non ha ancora inserito transazioni'
                }
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {(showFilters ? filteredTransactions : transactions).map((transaction) => (
                <div
                  key={transaction.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    transaction.type === 'avere' 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-red-500 bg-red-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {getTypeIcon(transaction.type)}
                        </span>
                        <span className="text-lg">
                          {getCategoryIcon(transaction.category)}
                        </span>
                        <div>
                          <div className="font-semibold text-gray-800">
                            {translateText(transaction.description)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {translateText(transaction.category)} • {translateText(transaction.type === 'avere' ? 'Avere' : 'Dare')} • {formatDate(transaction.date)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`text-xl font-bold ${
                        transaction.type === 'avere' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'avere' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PDF Date Selection Modal */}
        {showPDFModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-96">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">{t('pdfTitle')}</h2>
              <p className="text-gray-600 mb-4">
                {t('pdfSubtitle')}
              </p>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('dateFrom')}
                  </label>
                  <input
                    type="date"
                    value={pdfDateFilters.dateFrom}
                    onChange={(e) => setPdfDateFilters({...pdfDateFilters, dateFrom: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('dateTo')}
                  </label>
                  <input
                    type="date"
                    value={pdfDateFilters.dateTo}
                    onChange={(e) => setPdfDateFilters({...pdfDateFilters, dateTo: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={handlePDFDownloadConfirm}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  {t('downloadPDF')}
                </button>
                <button
                  onClick={() => {
                    setShowPDFModal(false);
                    setPdfDateFilters({ dateFrom: '', dateTo: '', targetClientSlug: '' });
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
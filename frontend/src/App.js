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
              <div className="mx-auto h-24 w-24 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-xl border-4 border-white flex items-center justify-center">
                <svg className="h-14 w-14 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 2h10c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2zm0 2v3h10V4H7zm0 5v2h2V9H7zm4 0v2h2V9h-2zm4 0v2h2V9h-2zm-8 4v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm-8 4v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2z"/>
                </svg>
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Contabilità Alpha
            </h1>
            <p className="text-gray-600">Sistema Multi-Cliente Professionale</p>
            
            {/* Admin Status */}
            <div className="mt-4">
              {isAdmin ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                    🔐 Modalità Amministratore
                  </span>
                  <button
                    onClick={handleLogout}
                    className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                    👁️ Modalità Solo Lettura
                  </span>
                  <button
                    onClick={() => setShowLogin(true)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200"
                  >
                    Login Admin
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
                  {showClientForm ? 'Chiudi Form' : '+ Nuovo Cliente'}
                </button>
                <button
                  onClick={() => setShowForm(!showForm)}
                  className={`${selectedClient ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'} text-white font-bold py-3 px-6 rounded-full transition-colors duration-200 shadow-lg`}
                  disabled={!selectedClient}
                >
                  {showForm ? 'Chiudi Form' : '+ Nuova Transazione'}
                  {!selectedClient && ' (Seleziona Cliente)'}
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
            <h2 className="text-2xl font-bold text-gray-800 mb-4">👥 Gestione Clienti</h2>
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
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyClientLink(client);
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded transition-colors duration-200"
                      >
                        🔗 Copia Link
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/cliente/${client.slug}`, '_blank');
                        }}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-1 px-2 rounded transition-colors duration-200"
                      >
                        👁️ Visualizza
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
                              {transaction.description}
                            </div>
                            <div className="text-xs text-gray-500">
                              {transaction.category} • {formatDate(transaction.date)}
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
      </div>
    );
  }

  // CLIENT VIEW (when accessing /cliente/slug)
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <div className="mx-auto h-24 w-24 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-xl border-4 border-white flex items-center justify-center">
              <svg className="h-14 w-14 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 2h10c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2zm0 2v3h10V4H7zm0 5v2h2V9H7zm4 0v2h2V9h-2zm4 0v2h2V9h-2zm-8 4v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2zm-8 4v2h2v-2H7zm4 0v2h2v-2h-2zm4 0v2h2v-2h-2z"/>
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Contabilità Alpha
          </h1>
          {selectedClient && (
            <p className="text-xl text-blue-600 font-medium">📊 {selectedClient.name}</p>
          )}
          <p className="text-gray-600">Visualizzazione solo lettura</p>
        </div>

        {/* Balance Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(balance.total_avere)}
              </div>
              <div className="text-sm text-gray-500">Totale Avere (Crediti)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(balance.total_dare)}
              </div>
              <div className="text-sm text-gray-500">Totale Dare (Debiti)</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${balance.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(balance.balance)}
              </div>
              <div className="text-sm text-gray-500">Saldo Netto</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 justify-center mb-8">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full transition-colors duration-200 shadow-lg"
          >
            {showFilters ? 'Nascondi Filtri' : '🔍 Cronologia e Filtri'}
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
            Registro Transazioni
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
                            {transaction.description}
                          </div>
                          <div className="text-sm text-gray-500">
                            {transaction.category} • {transaction.type === 'avere' ? 'Avere' : 'Dare'} • {formatDate(transaction.date)}
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
      </div>
    </div>
  );
}

export default App;
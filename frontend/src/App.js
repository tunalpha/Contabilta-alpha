import React, { useState, useEffect } from 'react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken') || '');
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    type: 'dare',
    category: 'Cash'
  });
  const [editFormData, setEditFormData] = useState({
    amount: '',
    description: '',
    type: 'dare',
    category: 'Cash'
  });
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    type: '',
    dateFrom: '',
    dateTo: ''
  });
  const [loginPassword, setLoginPassword] = useState('');

  const categories = ['Cash', 'Bonifico', 'PayPal', 'Altro'];

  useEffect(() => {
    // Check if user is already logged in
    if (adminToken) {
      setIsAdmin(true);
    }
    fetchTransactions();
    fetchBalance();
  }, [adminToken]);

  useEffect(() => {
    applyFilters();
  }, [transactions, filters]);

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
    alert('Logout effettuato. Ora sei in modalità solo lettura.');
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/transactions`);
      const data = await response.json();
      setTransactions(data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const fetchBalance = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/balance`);
      const data = await response.json();
      setBalance(data);
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...transactions];

    // Search filter
    if (filters.search) {
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // Category filter
    if (filters.category) {
      filtered = filtered.filter(t => t.category === filters.category);
    }

    // Type filter
    if (filters.type) {
      filtered = filtered.filter(t => t.type === filters.type);
    }

    // Date filters
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isAdmin) {
      alert('Solo l\'amministratore può inserire transazioni');
      return;
    }

    if (!formData.amount || !formData.description) {
      alert('Per favore compila tutti i campi');
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
          amount: parseFloat(formData.amount),
          description: formData.description,
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
          category: 'Cash'
        });
        setShowForm(false);
        fetchTransactions();
        fetchBalance();
      } else {
        const errorData = await response.json();
        alert(`Errore: ${errorData.detail}`);
      }
    } catch (error) {
      console.error('Error creating transaction:', error);
      alert('Errore nel salvare la transazione');
    }
  };

  const handleDelete = async (id) => {
    if (!isAdmin) {
      alert('Solo l\'amministratore può eliminare transazioni');
      return;
    }

    if (window.confirm('Sei sicuro di voler eliminare questa transazione?')) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/transactions/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${adminToken}`
          }
        });

        if (response.ok) {
          fetchTransactions();
          fetchBalance();
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
            Contabilità Alpha/Marzia
          </h1>
          <p className="text-gray-600">Sistema di gestione contabile professionale</p>
          
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
                Inserisci la password per accedere alle funzioni di modifica
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
            onClick={() => isAdmin ? setShowForm(!showForm) : alert('Solo l\'amministratore può inserire transazioni')}
            className={`${isAdmin ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'} text-white font-bold py-3 px-6 rounded-full transition-colors duration-200 shadow-lg`}
            disabled={!isAdmin}
          >
            {showForm ? 'Chiudi Form' : '+ Nuova Transazione'}
            {!isAdmin && ' (Solo Admin)'}
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full transition-colors duration-200 shadow-lg"
          >
            {showFilters ? 'Nascondi Filtri' : '🔍 Cronologia e Filtri'}
          </button>
        </div>

        {/* Transaction Form - Only for Admin */}
        {showForm && isAdmin && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Nuova Transazione</h2>
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
                  Descrizione
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Descrizione della transazione"
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
                >
                  Salva Transazione
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
                {showFilters && filters.search || filters.category || filters.type || filters.dateFrom || filters.dateTo
                  ? 'Nessuna transazione trovata con i filtri selezionati'
                  : 'Nessuna transazione trovata'
                }
              </div>
              <div className="text-gray-500 text-sm mt-2">
                {showFilters && (filters.search || filters.category || filters.type || filters.dateFrom || filters.dateTo)
                  ? 'Prova a modificare i filtri di ricerca'
                  : isAdmin 
                    ? 'Inizia aggiungendo la tua prima transazione!'
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
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(transaction.id)}
                          className="text-red-500 hover:text-red-700 p-1 rounded transition-colors duration-200"
                          title="Elimina transazione (Solo Admin)"
                        >
                          🗑️
                        </button>
                      )}
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
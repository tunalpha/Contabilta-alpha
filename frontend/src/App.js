import React, { useState, useEffect } from 'react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState({
    balance: 0,
    total_income: 0,
    total_expenses: 0
  });
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    type: 'expense',
    category: ''
  });

  const categories = {
    income: ['Stipendio', 'Freelance', 'Investimenti', 'Altro'],
    expense: ['Cibo', 'Trasporti', 'Casa', 'Intrattenimento', 'Salute', 'Shopping', 'Altro']
  };

  useEffect(() => {
    fetchTransactions();
    fetchBalance();
  }, []);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.amount || !formData.description || !formData.category) {
      alert('Per favore compila tutti i campi');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
          type: 'expense',
          category: ''
        });
        setShowForm(false);
        fetchTransactions();
        fetchBalance();
      } else {
        alert('Errore nel salvare la transazione');
      }
    } catch (error) {
      console.error('Error creating transaction:', error);
      alert('Errore nel salvare la transazione');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Sei sicuro di voler eliminare questa transazione?')) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/transactions/${id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          fetchTransactions();
          fetchBalance();
        } else {
          alert('Errore nell\'eliminare la transazione');
        }
      } catch (error) {
        console.error('Error deleting transaction:', error);
        alert('Errore nell\'eliminare la transazione');
      }
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('it-IT');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">💰 Gestione Finanze</h1>
          <p className="text-gray-600">Traccia le tue entrate e uscite</p>
        </div>

        {/* Balance Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(balance.total_income)}
              </div>
              <div className="text-sm text-gray-500">Entrate Totali</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(balance.total_expenses)}
              </div>
              <div className="text-sm text-gray-500">Uscite Totali</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${balance.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(balance.balance)}
              </div>
              <div className="text-sm text-gray-500">Bilancio</div>
            </div>
          </div>
        </div>

        {/* Add Transaction Button */}
        <div className="text-center mb-8">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full transition-colors duration-200 shadow-lg"
          >
            {showForm ? 'Chiudi Form' : '+ Aggiungi Transazione'}
          </button>
        </div>

        {/* Transaction Form */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Nuova Transazione</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value, category: ''})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="expense">Uscita</option>
                    <option value="income">Entrata</option>
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
                  Categoria
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleziona una categoria</option>
                  {categories[formData.type].map((category) => (
                    <option key={category} value={category}>
                      {category}
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

        {/* Transactions List */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Ultime Transazioni</h2>
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-lg">Nessuna transazione trovata</div>
              <div className="text-gray-500 text-sm mt-2">Inizia aggiungendo la tua prima transazione!</div>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.reverse().map((transaction) => (
                <div
                  key={transaction.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    transaction.type === 'income' 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-red-500 bg-red-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl ${
                          transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'income' ? '💰' : '💸'}
                        </span>
                        <div>
                          <div className="font-semibold text-gray-800">
                            {transaction.description}
                          </div>
                          <div className="text-sm text-gray-500">
                            {transaction.category} • {formatDate(transaction.date)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`text-xl font-bold ${
                        transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </div>
                      <button
                        onClick={() => handleDelete(transaction.id)}
                        className="text-red-500 hover:text-red-700 p-1 rounded transition-colors duration-200"
                        title="Elimina transazione"
                      >
                        🗑️
                      </button>
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
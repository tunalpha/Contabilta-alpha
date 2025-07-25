import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import './App.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// Helper functions for chart data
const getMonthlyTrendData = (transactions) => {
  const monthlyData = {};
  const last6Months = [];

  // Get last 6 months
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = date.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' });
    last6Months.push({ key: monthKey, label: monthLabel });
    monthlyData[monthKey] = { avere: 0, dare: 0 };
  }

  // Process transactions
  transactions.forEach(transaction => {
    const date = new Date(transaction.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (monthlyData[monthKey]) {
      if (transaction.type === 'avere') {
        monthlyData[monthKey].avere += transaction.amount;
      } else {
        monthlyData[monthKey].dare += transaction.amount;
      }
    }
  });

  const labels = last6Months.map(m => m.label);
  const avereData = last6Months.map(m => monthlyData[m.key].avere);
  const dareData = last6Months.map(m => monthlyData[m.key].dare);

  return {
    labels,
    datasets: [
      {
        label: 'Entrate (Avere)',
        data: avereData,
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.3,
      },
      {
        label: 'Uscite (Dare)',
        data: dareData,
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.3,
      },
    ],
  };
};

const getCategoryPieData = (transactions) => {
  const categoryData = {};

  transactions.forEach(transaction => {
    if (transaction.type === 'dare') { // Only outgoing transactions for expenses
      const category = transaction.category;
      categoryData[category] = (categoryData[category] || 0) + transaction.amount;
    }
  });

  const labels = Object.keys(categoryData);
  const data = Object.values(categoryData);
  const colors = [
    '#EF4444', // Red
    '#F59E0B', // Yellow
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#6B7280', // Gray
    '#F97316', // Orange
    '#84CC16', // Lime
  ];

  return {
    labels,
    datasets: [
      {
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderColor: colors.slice(0, labels.length),
        borderWidth: 2,
      },
    ],
  };
};

// Income Pie Chart Data
const getIncomePieData = (transactions) => {
  const categoryData = {};

  transactions.forEach(transaction => {
    if (transaction.type === 'avere') { // Only incoming transactions for income
      const category = transaction.category;
      categoryData[category] = (categoryData[category] || 0) + transaction.amount;
    }
  });

  const labels = Object.keys(categoryData);
  const data = Object.values(categoryData);
  const colors = [
    '#10B981', // Green
    '#3B82F6', // Blue
    '#06B6D4', // Cyan
    '#0891B2', // Sky
    '#059669', // Emerald
    '#16A34A', // Green-600
    '#65A30D', // Lime-600
  ];

  return {
    labels,
    datasets: [
      {
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderColor: colors.slice(0, labels.length),
        borderWidth: 2,
      },
    ],
  };
};

// Smart AI Insights Functions
const generateFinancialInsights = (transactions, balance, t) => {
  if (!transactions || transactions.length === 0) return [];

  const insights = [];
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // 1. Best performing month
  const monthlyPerformance = {};
  transactions.forEach(tr => {
    const date = new Date(tr.date);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    if (!monthlyPerformance[monthKey]) {
      monthlyPerformance[monthKey] = { avere: 0, dare: 0, monthName: date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) };
    }
    if (tr.type === 'avere') monthlyPerformance[monthKey].avere += tr.amount;
    else monthlyPerformance[monthKey].dare += tr.amount;
  });

  const bestMonth = Object.values(monthlyPerformance)
    .map(m => ({ ...m, net: m.avere - m.dare }))
    .sort((a, b) => b.net - a.net)[0];

  if (bestMonth) {
    insights.push({
      type: 'success',
      icon: '🏆',
      title: t('bestMonth'),
      message: `${bestMonth.monthName}: +€${bestMonth.net.toFixed(2)}`,
      priority: 'high'
    });
  }

  // 2. Spending trend analysis
  const last30Days = transactions.filter(tr => {
    const daysAgo = (Date.now() - new Date(tr.date).getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo <= 30 && tr.type === 'dare';
  });

  const prev30Days = transactions.filter(tr => {
    const daysAgo = (Date.now() - new Date(tr.date).getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo > 30 && daysAgo <= 60 && tr.type === 'dare';
  });

  const currentSpending = last30Days.reduce((sum, tr) => sum + tr.amount, 0);
  const previousSpending = prev30Days.reduce((sum, tr) => sum + tr.amount, 0);

  if (previousSpending > 0) {
    const change = ((currentSpending - previousSpending) / previousSpending) * 100;
    const trend = change > 0 ? t('increase') : t('decrease');
    const emoji = change > 0 ? '📈' : '📉';
    const color = change > 0 ? 'warning' : 'success';

    insights.push({
      type: color,
      icon: emoji,
      title: t('spendingTrend'),
      message: `${trend} del ${Math.abs(change).toFixed(1)}% ${t('vsPreviousMonth')}`,
      priority: Math.abs(change) > 20 ? 'high' : 'medium'
    });
  }

  // 3. Category analysis
  const categorySpending = {};
  transactions.filter(tr => tr.type === 'dare').forEach(tr => {
    categorySpending[tr.category] = (categorySpending[tr.category] || 0) + tr.amount;
  });

  const topCategory = Object.entries(categorySpending)
    .sort(([, a], [, b]) => b - a)[0];

  if (topCategory) {
    const percentage = (topCategory[1] / Object.values(categorySpending).reduce((a, b) => a + b, 0)) * 100;
    insights.push({
      type: 'info',
      icon: '🎯',
      title: t('mainCategory'),
      message: `${topCategory[0]}: ${percentage.toFixed(1)}% ${t('ofExpenses')}`,
      priority: 'medium'
    });
  }

  // 4. Cash flow prediction
  const avgMonthlyIncome = transactions
    .filter(tr => tr.type === 'avere')
    .reduce((sum, tr) => sum + tr.amount, 0) / Math.max(1, new Set(transactions.map(tr => tr.date.split('-').slice(0, 2).join('-'))).size);

  const avgMonthlyExpenses = transactions
    .filter(tr => tr.type === 'dare')
    .reduce((sum, tr) => sum + tr.amount, 0) / Math.max(1, new Set(transactions.map(tr => tr.date.split('-').slice(0, 2).join('-'))).size);

  const prediction = avgMonthlyIncome - avgMonthlyExpenses;

  insights.push({
    type: prediction > 0 ? 'success' : 'danger',
    icon: prediction > 0 ? '💚' : '🔴',
    title: t('monthEndForecast'),
    message: `${prediction > 0 ? '+' : ''}€${prediction.toFixed(2)} ${t('basedOnPatterns')}`,
    priority: prediction < 0 ? 'high' : 'low'
  });

  // 5. Financial health score
  const score = Math.min(10, Math.max(1, (balance.balance / (balance.total_avere || 1)) * 10 + 2));
  const scoreText = score >= 8 ? t('excellent') : score >= 6 ? t('good') : score >= 4 ? t('acceptable') : t('needsImprovement');
  const scoreEmoji = score >= 8 ? '🌟' : score >= 6 ? '👍' : score >= 4 ? '⚠️' : '🔴';

  insights.push({
    type: score >= 7 ? 'success' : score >= 5 ? 'warning' : 'danger',
    icon: scoreEmoji,
    title: t('financialScore'),
    message: `${score.toFixed(1)}/10 - ${scoreText}`,
    priority: score < 5 ? 'high' : 'low'
  });

  return insights.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
};

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';;

function App() {
  const [currentView, setCurrentView] = useState('admin'); // 'admin' or 'client'
  const [currentClientSlug, setCurrentClientSlug] = useState('');
  const [clients, setClients] = useState([]);
  // Theme state for color customization
  const [currentTheme, setCurrentTheme] = useState('blue');
  
  // Theme configurations
  const themes = {
    blue: {
      name: 'Azzurro Classico',
      primary: 'from-blue-50 to-indigo-100',
      accent: 'bg-blue-600 hover:bg-blue-700',
      text: 'text-blue-600',
      border: 'border-blue-500',
      icon: '🔵'
    },
    green: {
      name: 'Verde Business',
      primary: 'from-green-50 to-emerald-100', 
      accent: 'bg-green-600 hover:bg-green-700',
      text: 'text-green-600',
      border: 'border-green-500',
      icon: '🟢'
    },
    purple: {
      name: 'Viola Premium',
      primary: 'from-purple-50 to-violet-100',
      accent: 'bg-purple-600 hover:bg-purple-700', 
      text: 'text-purple-600',
      border: 'border-purple-500',
      icon: '🟣'
    }
  };

  // Logo upload state
  const [customLogo, setCustomLogo] = useState(localStorage.getItem('customLogo') || null);

  // Handle logo upload
  const handleLogoUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 500000) { // 500KB limit
        playSound('error');
        addToast('Immagine troppo grande! Max 500KB', 'error');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result;
        setCustomLogo(base64);
        localStorage.setItem('customLogo', base64);
        playSound('success');
        addToast('🖼️ Logo aggiornato con successo!', 'success');
      };
      reader.readAsDataURL(file);
    } else {
      playSound('error');
      addToast('Seleziona un\'immagine valida (JPG, PNG, etc.)', 'warning');
    }
  };

  // Reset logo to default
  const resetLogo = () => {
    setCustomLogo(null);
    localStorage.removeItem('customLogo');
    playSound('info');
    addToast('🔄 Logo ripristinato all\'originale', 'info');
  };

  // Toast notifications state
  const [toasts, setToasts] = useState([]);

  // Add toast notification
  const addToast = (message, type = 'success', duration = 3000) => {
    const id = Date.now();
    const newToast = { id, message, type, duration };
    setToasts(prev => [...prev, newToast]);
    
    // Auto remove after duration
    setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  // Remove toast notification
  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Toast Component
  const Toast = ({ toast, onRemove }) => {
    const typeStyles = {
      success: 'bg-green-500 text-white',
      warning: 'bg-yellow-500 text-white', 
      error: 'bg-red-500 text-white',
      info: 'bg-blue-500 text-white'
    };

    const icons = {
      success: '✅',
      warning: '⚠️',
      error: '❌', 
      info: 'ℹ️'
    };

    return (
      <div className={`${typeStyles[toast.type]} px-4 py-3 rounded-lg shadow-lg mb-2 animate-fade-in flex items-center gap-2 min-w-64`}>
        <span>{icons[toast.type]}</span>
        <span className="flex-1">{toast.message}</span>
        <button 
          onClick={() => onRemove(toast.id)}
          className="ml-2 hover:opacity-70"
        >
          ×
        </button>
      </div>
    );
  };

  // QR Code state
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');

  // Generate QR code for current client URL
  const generateQRCode = async () => {
    try {
      const currentURL = window.location.href;
      const qrDataURL = await QRCode.toDataURL(currentURL, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeDataURL(qrDataURL);
      setShowQRModal(true);
      playSound('success');
      addToast('📱 QR Code generato!', 'success');
    } catch (error) {
      console.error('Errore generazione QR:', error);
      playSound('error');
      addToast('❌ Errore nella generazione QR', 'error');
    }
  };

  // Download QR code as image
  const downloadQRCode = () => {
    const link = document.createElement('a');
    link.download = `qr-code-${selectedClient?.name || 'cliente'}.png`;
    link.href = qrCodeDataURL;
    link.click();
    playSound('success');
    addToast('💾 QR Code scaricato!', 'success');
  };

  // Sound feedback system
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('soundEnabled') !== 'false');

  // Play sound function
  const playSound = (type) => {
    if (!soundEnabled) return;
    
    const sounds = {
      success: { frequency: 800, duration: 200, volume: 0.3 },
      error: { frequency: 300, duration: 400, volume: 0.3 },
      info: { frequency: 600, duration: 150, volume: 0.2 },
      click: { frequency: 1000, duration: 100, volume: 0.1 }
    };

    const sound = sounds[type] || sounds.click;
    
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(sound.frequency, audioContext.currentTime);
      gainNode.gain.setValueAtTime(sound.volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + sound.duration / 1000);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + sound.duration / 1000);
    } catch (error) {
      console.log('Audio not supported');
    }
  };

  // Toggle sound preference
  const toggleSound = () => {
    const newSoundState = !soundEnabled;
    setSoundEnabled(newSoundState);
    localStorage.setItem('soundEnabled', newSoundState);
    playSound(newSoundState ? 'success' : 'info');
    addToast(`🔊 Suoni: ${newSoundState ? 'Attivati' : 'Disattivati'}`, 'info');
  };

  // Background music system
  const [backgroundMusicEnabled, setBackgroundMusicEnabled] = useState(localStorage.getItem('backgroundMusicEnabled') === 'true');
  const [audioContext, setAudioContext] = useState(null);
  const [musicNodes, setMusicNodes] = useState(null);

  // Generate ambient background music
  const createBackgroundMusic = () => {
    if (!backgroundMusicEnabled) return;

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      setAudioContext(ctx);

      // Create multiple layers for ambient music
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.3, ctx.currentTime); // Increased volume!
      masterGain.connect(ctx.destination);

      // Layer 1: Deep bass pad
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.frequency.setValueAtTime(110, ctx.currentTime); // Higher bass note
      bassOsc.type = 'sine';
      bassGain.gain.setValueAtTime(0.5, ctx.currentTime);
      bassOsc.connect(bassGain);
      bassGain.connect(masterGain);

      // Layer 2: Mid-range harmony (beautiful chord)
      const midOsc = ctx.createOscillator();
      const midGain = ctx.createGain();
      midOsc.frequency.setValueAtTime(440, ctx.currentTime); // A4
      midOsc.type = 'triangle';
      midGain.gain.setValueAtTime(0.4, ctx.currentTime);
      midOsc.connect(midGain);
      midGain.connect(masterGain);

      // Layer 3: High sparkle
      const highOsc = ctx.createOscillator();
      const highGain = ctx.createGain();
      highOsc.frequency.setValueAtTime(660, ctx.currentTime); // E5
      highOsc.type = 'sine';
      highGain.gain.setValueAtTime(0.3, ctx.currentTime);
      highOsc.connect(highGain);
      highGain.connect(masterGain);

      // Add gentle modulation
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(0.2, ctx.currentTime); // Faster modulation
      lfo.type = 'sine';
      lfoGain.gain.setValueAtTime(20, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(bassOsc.frequency);

      // Start all oscillators
      bassOsc.start();
      midOsc.start();
      highOsc.start();
      lfo.start();

      setMusicNodes({ bassOsc, midOsc, highOsc, lfo, masterGain });
      
      console.log('🎵 Background music started!');

    } catch (error) {
      console.log('Background music not supported:', error);
      addToast('❌ Audio non supportato dal browser', 'error');
    }
  };

  // Stop background music
  const stopBackgroundMusic = () => {
    if (musicNodes && audioContext) {
      musicNodes.bassOsc.stop();
      musicNodes.midOsc.stop();
      musicNodes.highOsc.stop();
      musicNodes.lfo.stop();
      audioContext.close();
      setMusicNodes(null);
      setAudioContext(null);
    }
  };

  // Toggle background music
  const toggleBackgroundMusic = () => {
    const newState = !backgroundMusicEnabled;
    setBackgroundMusicEnabled(newState);
    localStorage.setItem('backgroundMusicEnabled', newState);
    
    if (newState) {
      createBackgroundMusic();
      addToast('🎵 Musica ambientale attivata', 'success');
    } else {
      stopBackgroundMusic();
      addToast('🎵 Musica ambientale disattivata', 'info');
    }
  };

  // Start music when enabled
  useEffect(() => {
    if (backgroundMusicEnabled) {
      // Delay to ensure user interaction (required for autoplay)
      const timer = setTimeout(() => {
        createBackgroundMusic();
      }, 1000);
      return () => clearTimeout(timer);
    }
    return () => {
      if (musicNodes) {
        stopBackgroundMusic();
      }
    };
  }, [backgroundMusicEnabled]);

  // Dark/Light mode state
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('darkMode') === 'true');

  // Toggle dark/light mode
  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode);
    addToast(`🌙 Tema: ${newDarkMode ? 'Scuro' : 'Chiaro'}`, 'success');
  };

  // Get theme classes based on mode
  const getThemeClasses = () => {
    if (isDarkMode) {
      return {
        background: 'bg-gradient-to-br from-gray-900 to-gray-800',
        card: 'bg-gray-800 border-gray-700',
        text: 'text-gray-100',
        textSecondary: 'text-gray-300',
        border: 'border-gray-600',
        input: 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-blue-400',
        button: 'bg-gray-700 hover:bg-gray-600 text-gray-100'
      };
    } else {
      return {
        background: themes[currentTheme].primary,
        card: 'bg-white border-gray-200', 
        text: 'text-gray-800',
        textSecondary: 'text-gray-600',
        border: 'border-gray-300',
        input: 'bg-white border-gray-300 text-gray-900 focus:ring-purple-500',
        button: 'bg-white hover:bg-gray-50 text-gray-800'
      };
    }
  };

  const themeClasses = getThemeClasses();

  const [selectedClient, setSelectedClient] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalClient, setPasswordModalClient] = useState(null);
  const [clientPassword, setClientPassword] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [balance, setBalance] = useState({
    balance: 0,
    total_avere: 0,
    total_dare: 0
  });
  const [showLogin, setShowLogin] = useState(false);
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);
  const [password, setPassword] = useState(''); // Admin password
  const [clientLoginPassword, setClientLoginPassword] = useState('');
  const [showClientLogin, setShowClientLogin] = useState(false);
  const [clientLoginError, setClientLoginError] = useState('');
  const [clientToken, setClientToken] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordChangeData, setPasswordChangeData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordChangeError, setPasswordChangeError] = useState('');
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
    client_id: '',
    currency: 'EUR',
    date: new Date().toISOString().split('T')[0] // Default to today's date
  });
  const [editFormData, setEditFormData] = useState({
    amount: '',
    description: '',
    type: 'dare',
    category: 'Cash',
    client_id: '',
    currency: 'EUR',
    date: new Date().toISOString().split('T')[0] // Default to today's date
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
    // Force cache refresh
    console.log('🔄 CACHE REFRESH TIMESTAMP:', new Date().toISOString());
    
    // Check URL for client slug - handle both formats: /cliente/slug and /slug
    const path = window.location.pathname;
    
    // Check URL for admin reset page
    if (path === '/admin-reset') {
      setCurrentView('admin-reset');
      return;
    }
    
    let slug = null;
    let isClientView = false;

    // First check for /cliente/slug format (generated by copy link)
    const clienteMatch = path.match(/^\/cliente\/([^\/]+)$/);
    if (clienteMatch) {
      slug = clienteMatch[1];
      isClientView = true;
      console.log('🔍 ROUTING: Found /cliente/ format with slug:', slug);
    } 
    // Then check for direct /slug format (for direct access)
    else if (path.match(/^\/([^\/]+)$/) && path !== '/') {
      slug = path.substring(1); // Remove leading slash
      isClientView = true;
      console.log('🔍 ROUTING: Found direct format with slug:', slug);
    }

    if (isClientView && slug) {
      console.log('🎯 ROUTING: Setting client view for slug:', slug);
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

  // Initialize client token from localStorage
  useEffect(() => {
    const storedClientToken = localStorage.getItem('clientToken');
    if (storedClientToken) {
      setClientToken(storedClientToken);
    }
  }, []);

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

  // Auto-apply filters when transactions change
  useEffect(() => {
    if (transactions.length > 0) {
      applyFilters();
    }
  }, [transactions, filters]); // Add filters as dependency

  // Remove the separate useEffect for filters since we're handling it above

  const fetchClientData = async (slug) => {
    try {
      const headers = {
        'Content-Type': 'application/json'
      };

      // Add client token if available
      if (clientToken) {
        headers['Authorization'] = `Bearer ${clientToken}`;
      }

      const response = await fetch(`${BACKEND_URL}/api/clients/${slug}`, { headers });

      if (response.status === 401) {
        // Need password authentication - reset state
        setSelectedClient(null);
        setTransactions([]);
        setBalance({ balance: 0, total_avere: 0, total_dare: 0 });
        setShowClientLogin(true);
        return;
      }

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

      const headers = {
        'Content-Type': 'application/json'
      };

      // Add client token if available
      if (clientToken) {
        headers['Authorization'] = `Bearer ${clientToken}`;
      }

      const response = await fetch(url, { headers });

      if (response.ok) {
        const data = await response.json();
        // Assicuriamoci che sia sempre un array
        const transactionsArray = Array.isArray(data) ? data : [];
        setTransactions(transactionsArray);
        // DON'T reset filteredTransactions - let applyFilters handle it
        // Only set initial filteredTransactions if it's empty
        if (filteredTransactions.length === 0) {
          setFilteredTransactions(transactionsArray);
        }
      } else {
        // In caso di errore, imposta array vuoto
        setTransactions([]);
        setFilteredTransactions([]);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      // In caso di errore, imposta array vuoto
      setTransactions([]);
      setFilteredTransactions([]);
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

      const headers = {
        'Content-Type': 'application/json'
      };

      // Add client token if available
      if (clientToken) {
        headers['Authorization'] = `Bearer ${clientToken}`;
      }

      const response = await fetch(url, { headers });

      if (response.ok) {
        const data = await response.json();
        setBalance(data);
      } else {
        // In caso di errore, imposta balance di default
        setBalance({ balance: 0, total_avere: 0, total_dare: 0 });
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
      // In caso di errore, imposta balance di default
      setBalance({ balance: 0, total_avere: 0, total_dare: 0 });
    }
  };

  const handleLogin = async () => {
    console.log('🔑 handleLogin called!', { password, BACKEND_URL });
    try {
      const response = await fetch(`${BACKEND_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: password }),
      });

      const data = await response.json();

      if (data.success) {
        setAdminToken(data.token);
        localStorage.setItem('adminToken', data.token);
        setIsAdmin(true);
        setShowLogin(false);
        setPassword(''); // Clear admin password
        setLoginPassword(''); // Clear old password field
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

  const applyFilters = useCallback(() => {
    console.log('🚨 APPLY FILTERS CALLED!');
    console.log('🚨 Current transactions:', transactions?.length || 0);
    console.log('🚨 Current filters:', filters);
    
    // Assicuriamoci che transactions sia un array valido - enhanced defensive programming
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      console.log('❌ No transactions to filter');
      setFilteredTransactions([]);
      return;
    }

    try {
      let filtered = [...transactions];
      console.log('🔍 DEBUGGING FILTERS:', filters);
      console.log('📊 ORIGINAL TRANSACTIONS:', transactions.length);

      if (filters.search) {
        filtered = filtered.filter(t =>
          t.description && t.description.toLowerCase().includes(filters.search.toLowerCase())
        );
        console.log('🔎 After search filter:', filtered.length);
      }

      if (filters.category) {
        filtered = filtered.filter(t => t.category === filters.category);
        console.log('📁 After category filter:', filtered.length);
      }

      if (filters.type) {
        filtered = filtered.filter(t => t.type === filters.type);
        console.log('📋 After type filter:', filtered.length);
      }

      // DATE FILTERING WITH EXTREME DEBUG
      if (filters.dateFrom) {
        console.log('🚨 APPLYING DATE FROM FILTER:', filters.dateFrom);
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        console.log('🚨 From date object:', fromDate);
        
        const beforeCount = filtered.length;
        filtered = filtered.filter(t => {
          if (!t.date) return false;
          const transactionDate = new Date(t.date);
          transactionDate.setHours(0, 0, 0, 0);
          const result = transactionDate >= fromDate;
          console.log(`🚨 Transaction ${t.description}: ${t.date} >= ${filters.dateFrom} = ${result}`);
          return result;
        });
        console.log(`🚨 DATE FROM FILTER: ${beforeCount} -> ${filtered.length}`);
      }

      if (filters.dateTo) {
        console.log('🚨 APPLYING DATE TO FILTER:', filters.dateTo);
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        console.log('🚨 To date object:', toDate);
        
        const beforeCount = filtered.length;
        filtered = filtered.filter(t => {
          if (!t.date) return false;
          const transactionDate = new Date(t.date);
          const result = transactionDate <= toDate;
          console.log(`🚨 Transaction ${t.description}: ${t.date} <= ${filters.dateTo} = ${result}`);
          return result;
        });
        console.log(`🚨 DATE TO FILTER: ${beforeCount} -> ${filtered.length}`);
      }

      // Filter by currency
      if (filters.currency) {
        filtered = filtered.filter(t => t.currency === filters.currency);
        console.log('💰 After currency filter:', filtered.length);
      }

      console.log('🚨 FINAL FILTERED RESULT:', filtered.length);
      console.log('🚨 Setting filteredTransactions to:', filtered.map(t => ({id: t.id, description: t.description, date: t.date})));
      setFilteredTransactions(filtered);
    } catch (error) {
      console.error('❌ Error in applyFilters:', error);
      setFilteredTransactions([]);
    }
  }, [transactions, filters]); // Dependencies ensure fresh values

  // Balance Evolution Chart Component  
  const BalanceEvolutionChart = ({ transactions }) => {
    // Calculate cumulative balance over time
    const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let cumulativeBalance = 0;
    const data = [];
    const labels = [];
    
    sortedTransactions.forEach((transaction, index) => {
      const amount = transaction.type === 'avere' ? transaction.amount : -transaction.amount;
      cumulativeBalance += amount;
      
      data.push(cumulativeBalance);
      labels.push(formatDate(transaction.date));
    });

    const chartData = {
      labels,
      datasets: [
        {
          label: 'Evoluzione Saldo',
          data,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'rgb(59, 130, 246)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Saldo: €${context.parsed.y.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: {
            color: 'rgba(0, 0, 0, 0.1)',
          },
          ticks: {
            callback: function(value) {
              return '€' + value.toFixed(0);
            }
          }
        },
        x: {
          grid: {
            display: false,
          },
          ticks: {
            maxTicksLimit: 6
          }
        }
      }
    };

    return <Line data={chartData} options={options} />;
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
        alert(`✅ Cliente "${newClient.name}" creato con successo!\n\nLink condivisibile: ${window.location.origin}/cliente/${newClient.slug}\n\n⚠️ IMPORTANTE: Il cliente non ha ancora una password.\nClicca "🔒 Aggiungi Password" per proteggerlo.\n\nClienti: ${clients.length + 1}/${MAX_CLIENTS}`);
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
      const transactionData = {
        client_id: formData.client_id,
        amount: parseFloat(formData.amount),
        description: formData.description || 'Transazione senza descrizione',
        type: formData.type,
        category: formData.category,
        currency: formData.currency,
        date: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString()
      };

      console.log('Sending transaction data:', transactionData);

      const response = await fetch(`${BACKEND_URL}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(transactionData),
      });

      if (response.ok) {
        setFormData({
          amount: '',
          description: '',
          type: 'dare',
          category: 'Cash',
          client_id: '',
          currency: 'EUR',
          date: new Date().toISOString().split('T')[0] // Default to today's date
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
      client_id: transaction.client_id,
      currency: transaction.currency || 'EUR',
      date: transaction.date ? transaction.date.split('T')[0] : new Date().toISOString().split('T')[0]
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
          currency: editFormData.currency,
          date: editFormData.date ? new Date(editFormData.date).toISOString() : editingTransaction.date
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
          client_id: '',
          currency: 'EUR',
          date: new Date().toISOString().split('T')[0]
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

  // Helper function to format currency display with original currency
  const formatCurrencyWithOriginal = (transaction) => {
    const amount = transaction.amount; // Always in EUR (for calculations)
    const currency = transaction.currency || 'EUR';

    // Try both naming conventions: original_amount and originalAmount
    const originalAmount = transaction.original_amount || transaction.originalAmount;

    if (originalAmount && currency !== 'EUR') {
      // Show ORIGINAL currency as primary
      const currencySymbols = {
        'USD': '$',
        'GBP': '£',
        'EUR': '€'
      };

      const symbol = currencySymbols[currency] || currency;
      return `${symbol}${originalAmount.toFixed(2)}`;
    } else {
      // Show only EUR for EUR transactions
      return `€${amount.toFixed(2)}`;
    }
  };

  // Helper function to get tooltip text for converted transactions
  const getCurrencyTooltip = (transaction) => {
    const amount = transaction.amount;
    const currency = transaction.currency || 'EUR';

    // Try both naming conventions
    const originalAmount = transaction.original_amount || transaction.originalAmount;
    const exchangeRate = transaction.exchange_rate || transaction.exchangeRate;

    if (originalAmount && currency !== 'EUR' && exchangeRate) {
      return `Convertito in €${amount.toFixed(2)} (tasso: 1 ${currency} = €${exchangeRate.toFixed(4)})`;
    }
    return '';
  };

  // Helper function for balance (always show EUR)
  const formatCurrencyEUR = (amount) => {
    return `€${amount.toFixed(2)}`;
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
  const [showPDFShareModal, setShowPDFShareModal] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [pdfDateFilters, setPdfDateFilters] = useState({ dateFrom: '', dateTo: '', targetClientSlug: '' });
  const [language, setLanguage] = useState('it'); // 'it' or 'en'
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [exchangeRates, setExchangeRates] = useState({ EUR: 1.0, USD: 0.92, GBP: 1.17 });

  // Translations
  const translations = {
    it: {
      // Header
      title: "Contabilità",
      subtitle: "Sistema Multi-Cliente Professionale",
      adminMode: "🔐 Modalità Amministratore",
      readOnlyMode: "👁️ Modalità Solo Lettura",
      viewOnly: "Visualizzazione solo lettura",

      // Buttons
      logout: "Logout",
      loginAdmin: "Login Admin",
      newClient: "Nuovo Cliente",
      newTransaction: "Nuova Transazione",
      filters: "🔍 Lista Movimenti",
      hideFilters: "Nascondi Filtri",
      downloadPDF: "📄 Scarica PDF",
      sharePDF: "📤 Condividi PDF",
      shareViaWhatsApp: "📱 WhatsApp",
      shareViaEmail: "📧 Email",
      shareViaLink: "🔗 Link",
      saveAs: "💾 Salva come",
      sharePDFTitle: "Condividi Estratto Conto",
      selectShareMethod: "Scegli come condividere:",
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
      currency: "Valuta",

      // Balance
      totalAvere: "Totale Avere (Incassi)",
      totalDare: "Totale Dare (Pagamenti)",
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
      transactionHistory: "Lista Movimenti",
      transactionChronology: "Cronologia Transazioni", 
      balanceEvolution: "📈 Evoluzione del Tuo Saldo",
      balanceEvolutionDesc: "Grafico dell'andamento del tuo saldo nel tempo",
      transactionsCount: "transazioni",
      noTransactions: "Nessuna transazione trovata",
      noTransactionsFiltered: "Nessuna transazione trovata con i filtri selezionati",
      totalTransactions: "Totale transazioni",
      clientManagement: "👥 Gestione Clienti",
      resetLink: "🔄 Reset Link",

      // AI Insights
      smartInsights: "🧠 Insights Intelligenti",
      priority: "Prioritari",
      highPriority: "🔴 Prioritario",
      bestMonth: "Il tuo miglior mese",
      spendingTrend: "Tendenza spese",
      mainCategory: "Categoria principale",
      monthEndForecast: "Previsione fine mese",
      financialScore: "Punteggio finanziario",
      excellent: "Ottimo!",
      good: "Buono",
      acceptable: "Accettabile",
      needsImprovement: "Da migliorare",
      basedOnPatterns: "(basato sui pattern)",
      increase: "aumento",
      decrease: "diminuzione",
      vsPreviousMonth: "vs mese scorso",
      ofExpenses: "delle spese",

      // Analytics
      analytics: "📊 Analytics",
      monthlyTrend: "📈 Trend Mensile",
      expensesByCategory: "🍰 Spese per Categoria"
    },
    en: {
      // Header
      title: "Accounting",
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
      sharePDF: "📤 Share PDF",
      shareViaWhatsApp: "📱 WhatsApp",
      shareViaEmail: "📧 Email",
      shareViaLink: "🔗 Link",
      saveAs: "💾 Save as",
      sharePDFTitle: "Share Account Statement",
      selectShareMethod: "Choose how to share:",
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
      currency: "Currency",

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
      transactionChronology: "Transaction History",
      balanceEvolution: "📈 Your Balance Evolution", 
      balanceEvolutionDesc: "Chart showing your balance trend over time",
      transactionsCount: "transactions",
      noTransactions: "No transactions found",
      noTransactionsFiltered: "No transactions found with selected filters",
      totalTransactions: "Total transactions",
      clientManagement: "👥 Client Management",
      resetLink: "🔄 Reset Link",

      // AI Insights
      smartInsights: "🧠 Smart Insights",
      priority: "Priority",
      highPriority: "🔴 Priority",
      bestMonth: "Your best month",
      spendingTrend: "Spending trend",
      mainCategory: "Main category",
      monthEndForecast: "Month-end forecast",
      financialScore: "Financial score",
      excellent: "Excellent!",
      good: "Good",
      acceptable: "Acceptable",
      needsImprovement: "Needs improvement",
      basedOnPatterns: "(based on patterns)",
      increase: "increase",
      decrease: "decrease",
      vsPreviousMonth: "vs previous month",
      ofExpenses: "of expenses",

      // Analytics
      analytics: "📊 Analytics",
      monthlyTrend: "📈 Monthly Trend",
      expensesByCategory: "🍰 Expenses by Category"
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

  // Load exchange rates on component mount
  useEffect(() => {
    const fetchExchangeRates = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/exchange-rates`);
        if (response.ok) {
          const data = await response.json();
          setExchangeRates(data.rates);
        }
      } catch (error) {
        console.error('Error fetching exchange rates:', error);
        // Keep fallback rates
      }
    };

    fetchExchangeRates();
  }, []);

  // Generate smart insights when transactions change
  useEffect(() => {
    if (transactions.length > 0 && balance) {
      const insights = generateFinancialInsights(transactions, balance, t);
      setNotifications(insights);
    }
  }, [transactions, balance, language]);

  // Helper function to calculate EUR equivalent
  const calculateEurEquivalent = (amount, currency) => {
    if (!amount || !currency || currency === 'EUR') return amount;
    const rate = exchangeRates[currency] || 1;
    return amount * rate;
  };

  // Helper function to format currency display
  const formatCurrencyDisplay = (amount, currency = 'EUR', originalAmount = null, originalCurrency = null) => {
    if (originalAmount && originalCurrency && originalCurrency !== 'EUR') {
      return `${originalCurrency} ${originalAmount.toFixed(2)} (€ ${amount.toFixed(2)})`;
    }
    return `€ ${amount.toFixed(2)}`;
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
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `estratto-conto-${selectedClient.name}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
      } else {
        throw new Error('Errore nel download');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      throw error;
    }
  };

  const createShareLink = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/clients/${currentClientSlug}/pdf/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date_from: '', date_to: '' })
      });

      if (response.ok) {
        const data = await response.json();
        const shareUrl = `${window.location.origin}${data.share_url}`;
        setGeneratedLink(shareUrl);
        return shareUrl;
      } else {
        throw new Error('Errore creazione link');
      }
    } catch (error) {
      console.error('Error creating link:', error);
      alert('Errore nella creazione del link');
      return null;
    }
  };

  const sharePDFViaWhatsApp = async () => {
    const link = await createShareLink();
    if (link) {
      const whatsappText = `Ciao! Ecco l'estratto conto di ${selectedClient.name}: ${link}`;
      // Apertura diretta WhatsApp (funziona meglio su mobile)
      window.location.href = `https://wa.me/393772411743?text=${encodeURIComponent(whatsappText)}`;
    }
  };

  const sharePDFViaEmail = async () => {
    const link = await createShareLink();
    if (link) {
      const subject = `Estratto Conto - ${selectedClient.name}`;
      const body = `Ciao,\n\nEcco l'estratto conto per ${selectedClient.name}:\n\n${link}\n\n(Il link scade tra 24 ore)\n\nCordiali saluti`;
      // Apertura diretta email
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
  };

  const copyPDFLink = async () => {
    const link = await createShareLink();
    if (link) {
      // Mostra link visibile per copia manuale
      setGeneratedLink(link);
      alert('Link generato! Puoi copiarlo manualmente dalla finestra.');
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
    setPdfDateFilters(prev => ({ ...prev, targetClientSlug: clientSlug }));
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
            'Authorization': `Bearer ${adminToken}`
          }
        });

        if (response.ok) {
          const updatedClient = await response.json();

          // Clear any cached tokens for the old slug
          const oldSlug = client.slug;
          localStorage.removeItem(`clientToken_${oldSlug}`);

          // Update the client in the local state
          setClients(prevClients =>
            prevClients.map(c =>
              c.id === client.id
                ? { ...c, slug: updatedClient.slug }
                : c
            )
          );

          // If currently viewing this client, redirect to new URL
          if (currentView === 'client' && currentClientSlug === oldSlug) {
            window.location.href = `/cliente/${updatedClient.slug}`;
            return;
          }

          // Show new link
          const newLink = `${window.location.origin}/cliente/${updatedClient.slug}`;
          alert(`✅ Link resettato con successo!\n\nNuovo link:\n${newLink}\n\n⚠️ IMPORTANTE: Il vecchio link non è più accessibile.\nEventuali sessioni salvate sono state cancellate.`);

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

  // Client password management functions
  const handleSetClientPassword = async (clientId, password) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/clients/${clientId}/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ password })
      });

      if (response.ok) {
        // Update client list to reflect password status
        await fetchClients();
        alert('✅ Password impostata con successo!');
      } else {
        alert('❌ Errore nell\'impostazione della password');
        throw new Error('Errore nell\'impostazione della password');
      }
    } catch (error) {
      console.error('Error setting client password:', error);
      if (!error.message.includes('Errore nell\'impostazione della password')) {
        alert('❌ Errore nell\'impostazione della password');
      }
      throw error; // Re-throw per permettere a handlePasswordSubmit di gestirlo
    }
  };

  const handleRemoveClientPassword = async (clientId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/clients/${clientId}/password`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      if (response.ok) {
        // Update client list to reflect password status
        await fetchClients();
        alert('✅ Password rimossa con successo!');
      } else {
        throw new Error('Errore nella rimozione della password');
      }
    } catch (error) {
      console.error('Error removing client password:', error);
      alert('❌ Errore nella rimozione della password');
    }
  };

  const openPasswordModal = (client) => {
    setPasswordModalClient(client);
    setClientPassword('');
    setShowPasswordModal(true);
  };

  // Generate random password function
  const generateRandomPassword = () => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setClientPassword(password);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (clientPassword.length < 6) {
      alert('La password deve essere di almeno 6 caratteri');
      return;
    }

    try {
      await handleSetClientPassword(passwordModalClient.id, clientPassword);
      // Chiudi il modal solo dopo che l'operazione è completata con successo
      setShowPasswordModal(false);
      setPasswordModalClient(null);
      setClientPassword('');
    } catch (error) {
      // In caso di errore, non chiudere il modal
      console.error('Error in password submit:', error);
    }
  };

  // Client login functions
  const handleClientLogin = async (clientSlug, password) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/clients/${clientSlug}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (data.success) {
        // Store client token
        setClientToken(data.token);
        localStorage.setItem('clientToken', data.token);
        setShowClientLogin(false);
        setClientLoginError('');

        // Check if this is first login
        if (data.first_login) {
          // Show password change modal
          setPasswordChangeData({
            current_password: password,
            new_password: '',
            confirm_password: ''
          });
          setShowPasswordChange(true);

          // Don't load client data yet - wait for password change
          return true;
        }

        // Reset state before loading new data
        setTransactions([]);
        setFilteredTransactions([]);
        setBalance({ balance: 0, total_avere: 0, total_dare: 0 });

        // Now fetch client data with proper authentication - wait for completion
        setTimeout(async () => {
          await fetchClientData(clientSlug);
        }, 100); // Small delay to ensure state is reset

        return true;
      } else {
        setClientLoginError(data.message);
        return false;
      }
    } catch (error) {
      console.error('Error during client login:', error);
      setClientLoginError('Errore di connessione');
      return false;
    }
  };

  // Handle client password change
  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (passwordChangeData.new_password !== passwordChangeData.confirm_password) {
      setPasswordChangeError('Le password non corrispondono');
      return;
    }

    if (passwordChangeData.new_password.length < 6) {
      setPasswordChangeError('La password deve essere di almeno 6 caratteri');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/clients/${currentClientSlug}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          current_password: passwordChangeData.current_password,
          new_password: passwordChangeData.new_password
        })
      });

      const data = await response.json();

      if (data.success) {
        setShowPasswordChange(false);
        setPasswordChangeError('');
        setPasswordChangeData({
          current_password: '',
          new_password: '',
          confirm_password: ''
        });

        alert('🎉 Password cambiata con successo!\n\nDa ora puoi usare la tua nuova password personalizzata per accedere.');

        // Now load client data
        setTransactions([]);
        setFilteredTransactions([]);
        setBalance({ balance: 0, total_avere: 0, total_dare: 0 });

        setTimeout(async () => {
          await fetchClientData(currentClientSlug);
        }, 100);

      } else {
        setPasswordChangeError(data.message || 'Errore nel cambio password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordChangeError('Errore di connessione');
    }
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Cliente sconosciuto';
  };

  // ADMIN RESET PASSWORD VIEW
  if (currentView === 'admin-reset') {
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <div className="mx-auto h-20 w-20 flex items-center justify-center bg-gradient-to-br from-red-500 to-orange-600 rounded-full shadow-lg border-4 border-white mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">🔐</div>
                <div className="text-xs font-bold text-white tracking-wider">RESET</div>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Reset Password Admin</h1>
            <p className="text-gray-600">Imposta una nuova password</p>
          </div>

          <form onSubmit={async (e) => {
            e.preventDefault();
            const newPassword = e.target.newPassword.value;
            const confirmPassword = e.target.confirmPassword.value;
            
            if (newPassword !== confirmPassword) {
              alert('❌ Le password non corrispondono');
              return;
            }
            
            if (newPassword.length < 6) {
              alert('❌ La password deve essere di almeno 6 caratteri');
              return;
            }
            
            try {
              const response = await fetch(`${BACKEND_URL}/api/admin/confirm-password-reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  reset_token: resetToken, 
                  new_password: newPassword 
                })
              });
              
              if (response.ok) {
                alert('✅ Password aggiornata con successo!');
                // Redirect to admin login
                window.location.href = '/';
              } else {
                const error = await response.json();
                alert('❌ ' + (error.detail || 'Errore nel reset'));
              }
            } catch (error) {
              alert('❌ Errore di connessione');
            }
          }} className="space-y-4">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🔑 Nuova Password
              </label>
              <input
                type="password"
                name="newPassword"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Inserisci nuova password"
                required
                minLength="6"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🔐 Conferma Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Conferma nuova password"
                required
                minLength="6"
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
            >
              🔓 Aggiorna Password
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => window.location.href = '/'}
              className="text-gray-600 hover:text-gray-800 text-sm underline"
            >
              ← Torna al Login
            </button>
          </div>
          
          {resetToken && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">
                Token: {resetToken}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ADMIN DASHBOARD VIEW
  if (currentView === 'admin') {
    // Se non è admin autenticato, mostra schermata di login
    if (!isAdmin) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="mx-auto h-20 w-20 flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-lg border-4 border-white mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">📊</div>
                  <div className="text-xs font-bold text-white tracking-wider">ADMIN</div>
                </div>
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Contabilità Admin</h1>
              <p className="text-gray-600">Accesso riservato agli amministratori</p>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🔐 Password Amministratore
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Inserisci la password admin"
                  required
                />
              </div>
              
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
              >
                🚪 Accedi come Admin
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setShowPasswordRecovery(true)}
                className="text-blue-600 hover:text-blue-800 text-sm underline"
              >
                🔑 Password dimenticata?
              </button>
            </div>

            {/* Password Recovery Modal */}
            {showPasswordRecovery && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">🔑 Recupero Password Admin</h2>
                  <p className="text-gray-600 mb-6">
                    Cliccando "Invia Reset", verrà inviata un'email con le istruzioni per resettare la password all'indirizzo dell'amministratore.
                  </p>
                  
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                    <p className="text-blue-800 text-sm">
                      <strong>📧 Email:</strong> ildattero.it@gmail.com<br />
                      <strong>⏱️ Scadenza:</strong> Il link scade dopo 1 ora
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        try {
                          const response = await fetch(`${BACKEND_URL}/api/admin/request-password-reset`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                          });
                          
                          if (response.ok) {
                            alert('✅ Email di reset inviata a ildattero.it@gmail.com!\nControlla la casella di posta e lo spam.');
                            setShowPasswordRecovery(false);
                          } else {
                            alert('❌ Errore nell\'invio dell\'email');
                          }
                        } catch (error) {
                          alert('❌ Errore di connessione');
                        }
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                    >
                      📤 Invia Reset
                    </button>
                    <button
                      onClick={() => setShowPasswordRecovery(false)}
                      className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                    >
                      ❌ Annulla
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Se è admin autenticato, mostra la dashboard completa
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mb-4">
              <div className="mx-auto h-24 w-24 flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-lg border-4 border-white">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">📊</div>
                  <div className="text-xs font-bold text-white tracking-wider">ALPHA</div>
                </div>
              </div>
            </div>
            <h1 className={`text-4xl font-bold ${themeClasses.text} mb-2`}>
              {t('title')}
            </h1>
            <p className="text-gray-600">{t('subtitle')}</p>

            {/* Language Toggle */}
            <div className="mt-4">
              <button
                onClick={() => setLanguage(language === 'it' ? 'en' : 'it')}
                className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200"
              >
                {language === 'it' ? '🇮🇹 Italiano' : '🇬🇧 English'}
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
                    onClick={() => { setShowLogin(false); setLoginPassword(''); }}
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
                        onChange={(e) => setClientFormData({ ...clientFormData, name: e.target.value })}
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

              {/* Edit Client Form */}
              {showEditClientForm && editingClient && (
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border-2 border-orange-200">
                  <h2 className="text-2xl font-bold text-orange-800 mb-4">✏️ Modifica Cliente</h2>
                  <form onSubmit={handleEditClientSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome Cliente
                      </label>
                      <input
                        type="text"
                        value={editClientFormData.name}
                        onChange={(e) => setEditClientFormData({ name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="Inserisci il nome del cliente"
                        required
                      />
                    </div>
                    <div className="flex gap-4">
                      <button
                        type="submit"
                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                      >
                        Salva Modifiche
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditClientForm(false);
                          setEditingClient(null);
                          setEditClientFormData({ name: '' });
                        }}
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tipo Operazione
                        </label>
                        <select
                          value={formData.type}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="dare">Dare (Uscita/Debito)</option>
                          <option value="avere">Avere (Entrata/Credito)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Importo
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.amount}
                          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                        {formData.currency !== 'EUR' && formData.amount && (
                          <div className="text-xs text-gray-500 mt-1">
                            ≈ € {calculateEurEquivalent(parseFloat(formData.amount), formData.currency).toFixed(2)}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('currency')}
                        </label>
                        <select
                          value={formData.currency}
                          onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="EUR">🇪🇺 EUR (Euro)</option>
                          <option value="USD">🇺🇸 USD (Dollar)</option>
                          <option value="GBP">🇬🇧 GBP (Pound)</option>
                        </select>
                        <div className="text-xs text-gray-500 mt-1">
                          1 {formData.currency} = € {exchangeRates[formData.currency]?.toFixed(4)}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descrizione (opzionale)
                      </label>
                      <input
                        type="text"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {getCategoryIcon(category)} {category}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        📅 Data Transazione
                      </label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Seleziona la data di riferimento della transazione
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <button
                        type="submit"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                        onClick={() => setFormData({ ...formData, client_id: selectedClient.id })}
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tipo Operazione
                        </label>
                        <select
                          value={editFormData.type}
                          onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="dare">Dare (Uscita/Debito)</option>
                          <option value="avere">Avere (Entrata/Credito)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Importo
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editFormData.amount}
                          onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="0.00"
                        />
                        {editFormData.currency !== 'EUR' && editFormData.amount && (
                          <div className="text-xs text-gray-500 mt-1">
                            ≈ € {calculateEurEquivalent(parseFloat(editFormData.amount), editFormData.currency).toFixed(2)}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {t('currency')}
                        </label>
                        <select
                          value={editFormData.currency}
                          onChange={(e) => setEditFormData({ ...editFormData, currency: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="EUR">🇪🇺 EUR (Euro)</option>
                          <option value="USD">🇺🇸 USD (Dollar)</option>
                          <option value="GBP">🇬🇧 GBP (Pound)</option>
                        </select>
                        <div className="text-xs text-gray-500 mt-1">
                          1 {editFormData.currency} = € {exchangeRates[editFormData.currency]?.toFixed(4)}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descrizione (opzionale)
                      </label>
                      <input
                        type="text"
                        value={editFormData.description}
                        onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="Descrizione della transazione (opzionale)"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Data Transazione
                      </label>
                      <input
                        type="date"
                        value={editFormData.date}
                        onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Metodo di Pagamento
                      </label>
                      <select
                        value={editFormData.category}
                        onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
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
                          setEditFormData({ amount: '', description: '', type: 'dare', category: 'Cash', client_id: '', currency: 'EUR', date: new Date().toISOString().split('T')[0] });
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
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${selectedClient?.id === client.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                      }`}
                    onClick={() => setSelectedClient(client)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-gray-800">{client.name}</h3>
                        {client.has_password && (
                          <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                            🔒 Protetto
                          </span>
                        )}
                      </div>
                      {isAdmin && (
                        <div className="flex space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClient(client);
                            }}
                            className="text-blue-500 hover:text-blue-700 p-1"
                            title="Modifica nome cliente"
                          >
                            ✏️
                          </button>
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
                        </div>
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
                      {isAdmin && (
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
                      )}
                    </div>

                    {/* Password Management Buttons */}
                    {isAdmin && (
                      <div className="mt-2 flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openPasswordModal(client);
                          }}
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs py-1 px-2 rounded transition-colors duration-200"
                          title="Imposta password protezione"
                        >
                          🔒 {client.has_password ? 'Modifica' : 'Aggiungi'} Password
                        </button>

                        {client.has_password && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Rimuovere la password di protezione per ${client.name}?`)) {
                                handleRemoveClientPassword(client.id);
                              }
                            }}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-1 px-2 rounded transition-colors duration-200"
                            title="Rimuovi password protezione"
                          >
                            🔓 Rimuovi
                          </button>
                        )}
                      </div>
                    )}
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
                  {transactions && transactions.slice(0, 10).map((transaction) => (
                    <div
                      key={transaction.id}
                      className={`p-3 rounded-lg border-l-4 ${transaction.type === 'avere'
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
                          <div
                            className={`font-bold ${transaction.type === 'avere' ? 'text-green-600' : 'text-red-600'
                              }`}
                            title={getCurrencyTooltip(transaction)}
                          >
                            {transaction.type === 'avere' ? '+' : '-'}{formatCurrencyWithOriginal(transaction)}
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
                    onChange={(e) => setPdfDateFilters({ ...pdfDateFilters, dateFrom: e.target.value })}
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
                    onChange={(e) => setPdfDateFilters({ ...pdfDateFilters, dateTo: e.target.value })}
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

        {/* Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-96">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">🔒 Imposta Password Cliente</h2>
              <p className="text-gray-600 mb-4">
                Cliente: <strong>{passwordModalClient?.name}</strong>
              </p>
              <p className="text-gray-600 mb-4">
                La password proteggerà l'accesso al link del cliente. Minimo 6 caratteri.
              </p>
              <form onSubmit={handlePasswordSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password Cliente
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={clientPassword}
                      onChange={(e) => setClientPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                      placeholder="Inserisci password (min 6 caratteri)"
                      minLength="6"
                      required
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(clientPassword);
                          // Feedback visivo temporaneo
                          const btn = document.querySelector('[title="Copia password"]');
                          const originalText = btn.textContent;
                          btn.textContent = '✅';
                          setTimeout(() => {
                            btn.textContent = originalText;
                          }, 1000);
                        } catch (err) {
                          // Fallback per browser che non supportano clipboard API
                          const textArea = document.createElement('textarea');
                          textArea.value = clientPassword;
                          document.body.appendChild(textArea);
                          textArea.select();
                          document.execCommand('copy');
                          document.body.removeChild(textArea);

                          // Feedback visivo
                          const btn = document.querySelector('[title="Copia password"]');
                          const originalText = btn.textContent;
                          btn.textContent = '✅';
                          setTimeout(() => {
                            btn.textContent = originalText;
                          }, 1000);
                        }
                      }}
                      className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
                      title="Copia password"
                    >
                      📋
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200 mb-2"
                  >
                    🎲 Genera Password Casuale
                  </button>
                  <p className="text-xs text-gray-500 text-center">
                    Genera una password di 8 caratteri (lettere + numeri)
                  </p>
                </div>

                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    🔒 Imposta Password
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setPasswordModalClient(null);
                      setClientPassword('');
                    }}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    Annulla
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // CLIENT LOGIN MODAL
  if (showClientLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-96">
          <div className="text-center mb-6">
            <div className="mx-auto h-16 w-16 flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-lg border-4 border-white mb-4">
              <div className="text-center">
                <div className="text-xl font-bold text-white">📊</div>
                <div className="text-xs font-bold text-white tracking-wider">ALPHA</div>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">🔒 Accesso Cliente</h2>
            <p className="text-gray-600">
              Questo cliente è protetto da password. Inserisci la password per accedere.
            </p>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            handleClientLogin(currentClientSlug, clientLoginPassword);
          }}>
            <div className="mb-4">
              <input
                type="password"
                value={clientLoginPassword}
                onChange={(e) => setClientLoginPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Inserisci la password..."
                required
              />
            </div>

            {clientLoginError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{clientLoginError}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
            >
              🔓 Accedi
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm mb-2">
              Non conosci la password? Contatta l'amministratore.
            </p>
            <button
              onClick={() => {
                localStorage.removeItem('clientToken');
                window.location.reload();
              }}
              className="text-red-500 text-xs hover:text-red-700"
            >
              🔄 Pulisci Cache e Riprova
            </button>
          </div>
        </div>
      </div>
    );
  }

  // CLIENT PASSWORD CHANGE MODAL
  if (showPasswordChange) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-96">
          <div className="text-center mb-6">
            <div className="mx-auto h-16 w-16 flex items-center justify-center bg-gradient-to-br from-green-500 to-blue-600 rounded-full shadow-lg border-4 border-white mb-4">
              <div className="text-center">
                <div className="text-xl font-bold text-white">🔑</div>
                <div className="text-xs font-bold text-white tracking-wider">ALPHA</div>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">🎉 Primo Accesso!</h2>
            <p className="text-gray-600 text-sm">
              Benvenuto! Questa è la tua password temporanea.<br />
              Per sicurezza, ti consigliamo di cambiarla con una personalizzata.
            </p>
          </div>

          <form onSubmit={handlePasswordChange}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password Attuale (temporanea)
              </label>
              <input
                type="password"
                value={passwordChangeData.current_password}
                readOnly
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nuova Password (min 6 caratteri)
              </label>
              <input
                type="password"
                value={passwordChangeData.new_password}
                onChange={(e) => setPasswordChangeData({ ...passwordChangeData, new_password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Inserisci nuova password..."
                minLength="6"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Conferma Nuova Password
              </label>
              <input
                type="password"
                value={passwordChangeData.confirm_password}
                onChange={(e) => setPasswordChangeData({ ...passwordChangeData, confirm_password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Conferma nuova password..."
                minLength="6"
                required
              />
            </div>

            {passwordChangeError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{passwordChangeError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                🔑 Cambia Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordChange(false);
                  // Continue with current password
                  setTransactions([]);
                  setFilteredTransactions([]);
                  setBalance({ balance: 0, total_avere: 0, total_dare: 0 });

                  setTimeout(async () => {
                    await fetchClientData(currentClientSlug);
                  }, 100);
                }}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                🔄 Continua
              </button>
            </div>

            <div className="mt-4 text-center">
              <p className="text-gray-500 text-xs">
                Puoi continuare con la password attuale e cambiarla successivamente.
              </p>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // CLIENT VIEW
  return (
    <div className={`min-h-screen ${themeClasses.background}`}>
      {/* 🔔 TOAST NOTIFICATIONS CONTAINER */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <div className="mx-auto h-24 w-24 flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-lg border-4 border-white overflow-hidden">
              {customLogo ? (
                <img 
                  src={customLogo} 
                  alt="Logo personalizzato" 
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">📊</div>
                  <div className="text-xs font-bold text-white tracking-wider">ALPHA</div>
                </div>
              )}
            </div>
          </div>
          <h1 className={`text-4xl font-bold ${themeClasses.text} mb-2`}>
            {t('title')}
          </h1>
          {selectedClient && (
            <p className="text-xl text-blue-600 font-medium">📊 {selectedClient.name}</p>
          )}
          <p className="text-gray-600">{t('viewOnly')}</p>

          {/* Language Toggle */}
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                const newLang = language === 'it' ? 'en' : 'it';
                setLanguage(newLang);
                playSound('info');
                addToast(`🌍 Lingua: ${newLang === 'it' ? 'Italiano' : 'English'}`, 'info');
              }}
              className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200"
            >
              {language === 'it' ? '🇮🇹 Italiano' : '🇬🇧 English'}
            </button>
            
            {/* 🌙 DARK/LIGHT MODE TOGGLE */}
            <button
              onClick={toggleDarkMode}
              className={`ml-3 px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${
                isDarkMode 
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-gray-900' 
                  : 'bg-gray-800 hover:bg-gray-900 text-white'
              }`}
              title={`Modalità: ${isDarkMode ? 'Scura' : 'Chiara'}`}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            
            {/* 🎨 THEME SELECTOR - CENTERED BELOW */}
            <div className="flex justify-center gap-2 mt-3">
              {Object.entries(themes).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => {
                    setCurrentTheme(key);
                    playSound('success');
                    addToast(`🎨 Tema cambiato: ${theme.name}`, 'success');
                  }}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${
                    currentTheme === key 
                      ? theme.accent + ' text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                  title={theme.name}
                  disabled={isDarkMode}
                >
                  {theme.icon}
                </button>
              ))}
            </div>
            
            {/* 🖼️ LOGO UPLOAD - FEATURE UTILI */}
            <div className="flex justify-center gap-2 mt-3">
              <label className="cursor-pointer bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200">
                📷 Logo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
              {customLogo && (
                <button
                  onClick={resetLogo}
                  className="bg-gray-400 hover:bg-gray-500 text-white px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200"
                  title="Ripristina logo originale"
                >
                  ↺ Reset
                </button>
              )}
              <button
                onClick={generateQRCode}
                className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200"
                title="Genera QR Code per accesso rapido"
              >
                📱 QR
              </button>
            </div>
          </div>
        </div>

        {/* Balance Card */}
        <div className={`${themeClasses.card} rounded-2xl shadow-lg p-6 mb-8 animate-fade-in hover-lift`}>
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

        {/* Transaction History - MOVED UP for better UX */}
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 justify-center mb-8">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full transition-colors duration-200 shadow-lg"
          >
            {showFilters ? t('hideFilters') : t('filters')}
          </button>

          <button
            onClick={() => setShowPDFModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-full transition-colors duration-200 shadow-lg"
          >
            {t('downloadPDF')}
          </button>
        </div>

        {/* 🔍 FILTERS SECTION - MISSING! ADDING NOW */}
        {showFilters && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">🔍 Lista Movimenti</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cerca nella descrizione
                </label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Cerca..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo
                </label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Tutti</option>
                  <option value="avere">Solo Incassi</option>
                  <option value="dare">Solo Pagamenti</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data da
                </label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
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
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valuta
                </label>
                <select
                  value={filters.currency}
                  onChange={(e) => setFilters({ ...filters, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Tutte</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={() => {
                    // Apply filters and close panel
                    applyFilters();
                    setShowFilters(false);
                    addToast(`✅ Filtri applicati! ${filteredTransactions.length} transazioni trovate`, 'success');
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  ✅ Applica e Chiudi
                </button>
                <button
                  onClick={() => {
                    setFilters({
                      search: '',
                      type: '',
                      dateFrom: '',
                      dateTo: '',
                      currency: ''
                    });
                    addToast('🔄 Filtri rimossi', 'info');
                  }}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  🔄 Reset Filtri
                </button>
              </div>
            </div>
            <div className="border-t pt-4">
              <div className="text-sm text-gray-600">
                Trovate {filteredTransactions.length} transazioni
              </div>
            </div>
          </div>
        )}

        {/* Transactions List - MOVED ABOVE SMART INSIGHTS */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 animate-fade-in hover-lift">
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
                  className={`p-4 rounded-lg border-l-4 ${transaction.type === 'avere'
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
                          <div className="font-medium text-gray-800 text-lg">
                            {translateText(transaction.description)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {translateText(transaction.category)} • {translateText(transaction.type === 'avere' ? 'Avere' : 'Dare')} • {formatDate(transaction.date)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`text-xl font-bold ${transaction.type === 'avere' ? 'text-green-600' : 'text-red-600'
                          }`}
                        title={getCurrencyTooltip(transaction)}
                      >
                        {transaction.type === 'avere' ? '+' : '-'}{formatCurrencyWithOriginal(transaction)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Smart Insights - NOW BELOW TRANSACTIONS */}
        {/* PDF Date Selection Modal */}
        {notifications.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-800">{t('smartInsights')}</h2>
              <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                {notifications.filter(n => n.priority === 'high').length} {t('priority')}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {notifications.slice(0, 6).map((notification, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border-l-4 ${notification.type === 'success' ? 'bg-green-50 border-green-500' :
                      notification.type === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                        notification.type === 'danger' ? 'bg-red-50 border-red-500' :
                          'bg-blue-50 border-blue-500'
                    }`}
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">{notification.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">{notification.title}</h3>
                      <p className="text-gray-600 text-sm mt-1">{notification.message}</p>
                      {notification.priority === 'high' && (
                        <span className="inline-block mt-2 bg-red-100 text-red-800 text-xs font-semibold px-2 py-1 rounded">
                          {t('highPriority')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

              {/* 📈 BALANCE EVOLUTION CHART - NEW FEATURE */}
              {transactions.length > 1 && (
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 animate-fade-in-delay hover-lift">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-800">{t('balanceEvolution')}</h3>
                    <span className="text-sm text-gray-500">
                      {transactions.length} {t('transactionsCount')}
                    </span>
                  </div>
                  <div className="h-64">
                    <BalanceEvolutionChart transactions={transactions} />
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-600">
                      {t('balanceEvolutionDesc')}
                    </p>
                  </div>
                </div>
              )}

        {/* Analytics Section - MOVED TO BOTTOM */}
        {transactions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">{t('analytics')}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Trend Chart */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">{t('monthlyTrend')}</h3>
                <div style={{ height: '300px' }}>
                  <Line
                    data={getMonthlyTrendData(transactions)}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'top',
                        },
                        title: {
                          display: false,
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          ticks: {
                            callback: function (value) {
                              return '€ ' + value.toFixed(0);
                            }
                          }
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Category Pie Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Income Pie Chart */}
                <div className="bg-green-50 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-green-700 mb-4">💰 Entrate per Categoria</h3>
                  <div style={{ height: '250px' }}>
                    <Pie
                      data={getIncomePieData(transactions)}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              boxWidth: 12,
                              padding: 8,
                              font: {
                                size: 11
                              }
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: function (context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: €${value.toFixed(2)} (${percentage}%)`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Expenses Pie Chart */}
                <div className="bg-red-50 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-red-700 mb-4">💸 Uscite per Categoria</h3>
                  <div style={{ height: '250px' }}>
                    <Pie
                      data={getCategoryPieData(transactions)}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              boxWidth: 12,
                              padding: 8,
                              font: {
                                size: 11
                              }
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: function (context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: €${value.toFixed(2)} (${percentage}%)`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PDF Date Selection Modal */}

        {/* Transaction Chronology */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            {t('transactionChronology')}
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
                  className={`p-4 rounded-lg border-l-4 ${transaction.type === 'avere'
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
                      <div
                        className={`text-xl font-bold ${transaction.type === 'avere' ? 'text-green-600' : 'text-red-600'
                          }`}
                        title={getCurrencyTooltip(transaction)}
                      >
                        {transaction.type === 'avere' ? '+' : '-'}{formatCurrencyWithOriginal(transaction)}
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
                    onChange={(e) => setPdfDateFilters({ ...pdfDateFilters, dateFrom: e.target.value })}
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
                    onChange={(e) => setPdfDateFilters({ ...pdfDateFilters, dateTo: e.target.value })}
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

        {/* PDF Share Modal */}
        {showPDFShareModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">{t('sharePDFTitle')}</h2>

              {generatedLink ? (
                <div className="mb-6">
                  <p className="text-gray-600 mb-4">Link generato:</p>
                  <div className="bg-gray-100 p-4 rounded-lg break-all text-sm">
                    <a href={generatedLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {generatedLink}
                    </a>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">Tocca il link per aprire il PDF o copialo manualmente</p>
                </div>
              ) : (
                <p className="text-gray-600 mb-6">{t('selectShareMethod')}</p>
              )}

              <div className="space-y-4">
                <button
                  onClick={sharePDFViaWhatsApp}
                  className="w-full bg-green-500 hover:bg-green-600 text-white p-4 rounded-xl flex items-center space-x-3"
                >
                  <span className="text-2xl">📱</span>
                  <span className="font-semibold">{t('shareViaWhatsApp')}</span>
                </button>

                <button
                  onClick={sharePDFViaEmail}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-xl flex items-center space-x-3"
                >
                  <span className="text-2xl">📧</span>
                  <span className="font-semibold">{t('shareViaEmail')}</span>
                </button>

                <button
                  onClick={copyPDFLink}
                  className="w-full bg-purple-500 hover:bg-purple-600 text-white p-4 rounded-xl flex items-center space-x-3"
                >
                  <span className="text-2xl">🔗</span>
                  <span className="font-semibold">{t('copyLink')}</span>
                </button>

                <button
                  onClick={() => setShowPDFModal(true)}
                  className="w-full bg-red-500 hover:bg-red-600 text-white p-4 rounded-xl flex items-center space-x-3"
                >
                  <span className="text-2xl">📄</span>
                  <span className="font-semibold">{t('downloadPDF')}</span>
                </button>
              </div>

              <button
                onClick={() => {
                  setShowPDFShareModal(false);
                  setGeneratedLink('');
                }}
                className="w-full mt-6 bg-gray-500 hover:bg-gray-600 text-white p-3 rounded-xl"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}

        {/* 📱 QR CODE MODAL */}
        {showQRModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-96 text-center animate-fade-in">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">📱 QR Code Accesso Rapido</h2>
              <p className="text-gray-600 mb-6">
                Scansiona per accesso diretto a questa pagina
              </p>
              
              {qrCodeDataURL && (
                <div className="mb-6">
                  <img 
                    src={qrCodeDataURL} 
                    alt="QR Code" 
                    className="mx-auto border-2 border-gray-200 rounded-lg"
                  />
                </div>
              )}
              
              <div className="space-y-3">
                <button
                  onClick={downloadQRCode}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  💾 Scarica QR Code
                </button>
                
                <button
                  onClick={() => setShowQRModal(false)}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  Chiudi
                </button>
              </div>
              
              <p className="text-xs text-gray-500 mt-4">
                Perfetto per condividere l'accesso via mobile
              </p>
            </div>
          </div>
        )}

        {/* WhatsApp Assistance */}
        {currentView === 'client' && selectedClient && (
          <a
            href={`https://wa.me/393772411743?text=Ciao!%20Ho%20bisogno%20di%20assistenza%20per%20la%20mia%20contabilità.%0ACliente:%20${encodeURIComponent(selectedClient.name)}%0AProblema:%20`}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-20 right-6 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg transition-colors duration-200 z-50"
            title="Contatta assistenza su WhatsApp"
          >
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.525 3.488" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );

// CLIENT VIEW - FULLY IMPLEMENTED
return (
  <div className={`min-h-screen ${themeClasses.bg} ${isDarkMode ? 'bg-gray-900' : ''}`}>
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="mb-4">
          <div className="mx-auto h-24 w-24 flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-lg border-4 border-white">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">📊</div>
              <div className="text-xs font-bold text-white tracking-wider">ALPHA</div>
            </div>
          </div>
        </div>
        <h1 className={`text-4xl font-bold ${themeClasses.text} mb-2`}>
          {t('title')}
        </h1>
        <p className="text-gray-600">{t('subtitle')}</p>
        
        {/* Client Name */}
        {selectedClient && (
          <p className="text-xl text-blue-600 font-medium">📊 {selectedClient.name}</p>
        )}
        <p className="text-gray-600">{t('viewOnly')}</p>

        {/* Language Toggle */}
        <div className="mt-4 text-center">
          <button
            onClick={() => {
              const newLang = language === 'it' ? 'en' : 'it';
              setLanguage(newLang);
              playSound('info');
              addToast(`🌍 Lingua: ${newLang === 'it' ? 'Italiano' : 'English'}`, 'info');
            }}
            className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200"
          >
            {language === 'it' ? '🇮🇹 Italiano' : '🇬🇧 English'}
          </button>
          
          {/* 🌙 DARK/LIGHT MODE TOGGLE */}
          <button
            onClick={toggleDarkMode}
            className={`ml-3 px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${
              isDarkMode 
                ? 'bg-yellow-500 hover:bg-yellow-600 text-gray-900' 
                : 'bg-gray-800 hover:bg-gray-900 text-white'
            }`}
            title={`Modalità: ${isDarkMode ? 'Scura' : 'Chiara'}`}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          
          {/* 🎨 THEME SELECTOR - CENTERED BELOW */}
          <div className="flex justify-center gap-2 mt-3">
            {Object.entries(themes).map(([key, theme]) => (
              <button
                key={key}
                onClick={() => {
                  setCurrentTheme(key);
                  playSound('success');
                  addToast(`🎨 Tema cambiato: ${theme.name}`, 'success');
                }}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200 ${
                  currentTheme === key 
                    ? theme.accent + ' text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
                title={theme.name}
                disabled={isDarkMode}
              >
                {theme.icon}
              </button>
            ))}
          </div>
          
          {/* 🖼️ LOGO UPLOAD - FEATURE UTILI */}
          <div className="flex justify-center gap-2 mt-3">
            <label className="cursor-pointer bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200">
              📷 Logo
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </label>
            {customLogo && (
              <button
                onClick={resetLogo}
                className="bg-gray-400 hover:bg-gray-500 text-white px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200"
                title="Ripristina logo originale"
              >
                ↺ Reset
              </button>
            )}
            <button
              onClick={generateQRCode}
              className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200"
              title="Genera QR Code per accesso rapido"
            >
              📱 QR
            </button>
          </div>
        </div>
      </div>

      {/* Balance Card */}
      <div className={`${themeClasses.card} rounded-2xl shadow-lg p-6 mb-8 animate-fade-in hover-lift`}>
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
          onClick={() => setShowPDFModal(true)}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-full transition-colors duration-200 shadow-lg"
        >
          {t('downloadPDF')}
        </button>
      </div>

      {/* 🔍 FILTERS SECTION */}
      {showFilters && (
        <div className={`${themeClasses.card} rounded-2xl shadow-lg p-6 mb-8 animate-fade-in`}>
          <h2 className={`text-2xl font-bold ${themeClasses.text} mb-4`}>🔍 Lista Movimenti</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cerca nella descrizione
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Cerca..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Tutti</option>
                <option value="avere">Avere (Entrate)</option>
                <option value="dare">Dare (Uscite)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data da
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => {
                  console.log('🚨 DATE FROM CHANGING TO:', e.target.value);
                  const newFilters = { ...filters, dateFrom: e.target.value };
                  setFilters(newFilters);
                  
                  // FORCE IMMEDIATE FILTER APPLICATION
                  setTimeout(() => {
                    console.log('🚨 FORCING FILTER APPLICATION NOW!');
                    applyFilters();
                  }, 50);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data fino
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => {
                  console.log('🚨 DATE TO CHANGING TO:', e.target.value);
                  const newFilters = { ...filters, dateTo: e.target.value };
                  setFilters(newFilters);
                  
                  // FORCE IMMEDIATE FILTER APPLICATION
                  setTimeout(() => {
                    console.log('🚨 FORCING FILTER APPLICATION NOW!');
                    applyFilters();
                  }, 50);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 force:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valuta
              </label>
              <select
                value={filters.currency}
                onChange={(e) => setFilters({ ...filters, currency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Tutte</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={() => {
                  // Just close the filters panel - filtering is automatic
                  setShowFilters(false);
                  addToast(`✅ Filtri applicati! ${filteredTransactions.length} transazioni trovate`, 'success');
                }}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                ✅ Chiudi Filtri
              </button>
              <button
                onClick={() => {
                  setFilters({
                    search: '',
                    type: '',
                    dateFrom: '',
                    dateTo: '',
                    currency: ''
                  });
                  addToast('🔄 Filtri rimossi', 'info');
                }}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                🔄 Reset Filtri
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Balance Evolution Chart */}
      <div className={`${themeClasses.card} rounded-2xl shadow-lg p-6 mb-8 animate-fade-in`}>
        <h2 className={`text-2xl font-bold ${themeClasses.text} mb-4`}>
          {t('balanceEvolution')}
        </h2>
        <p className="text-gray-600 mb-6">{t('balanceEvolutionDesc')}</p>
        <BalanceEvolutionChart transactions={filteredTransactions} />
      </div>

      {/* Transaction List */}
      <div className={`${themeClasses.card} rounded-2xl shadow-lg p-6 mb-8 animate-fade-in`}>
        <h2 className={`text-2xl font-bold ${themeClasses.text} mb-4`}>
          📋 {t('transactionHistory')} ({filteredTransactions.length} {t('transactionsCount')})
        </h2>
        
        {filteredTransactions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            {transactions.length === 0 ? t('noTransactions') : t('noTransactionsFiltered')}
          </p>
        ) : (
          <div className="space-y-4">
            {filteredTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className={`p-4 rounded-lg border-l-4 ${
                  transaction.type === 'avere' 
                    ? 'bg-green-50 border-green-500' 
                    : 'bg-red-50 border-red-500'
                } hover:shadow-md transition-shadow duration-200`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-2xl font-bold ${
                        transaction.type === 'avere' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'avere' ? '+' : '-'}
                        {formatCurrencyWithOriginal(transaction.amount, transaction.currency, transaction.original_amount)}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        transaction.type === 'avere' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.type === 'avere' ? 'Avere' : 'Dare'}
                      </span>
                    </div>
                    <p className="text-gray-800 font-medium">{transaction.description}</p>
                    <p className="text-sm text-gray-500">
                      {formatDate(transaction.date)} • {transaction.category}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Smart Insights */}
      <div className={`${themeClasses.card} rounded-2xl shadow-lg p-6 mb-8 animate-fade-in`}>
        <h2 className={`text-2xl font-bold ${themeClasses.text} mb-4`}>
          {t('smartInsights')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {generateFinancialInsights(filteredTransactions, balance, t).map((insight, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border-l-4 ${
                insight.priority === 'high' 
                  ? 'bg-red-50 border-red-500' 
                  : insight.priority === 'medium'
                  ? 'bg-yellow-50 border-yellow-500'
                  : 'bg-blue-50 border-blue-500'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{insight.icon}</span>
                <div>
                  <h3 className="font-bold text-gray-800">{insight.title}</h3>
                  <p className="text-sm text-gray-600">{insight.description}</p>
                  {insight.priority === 'high' && (
                    <span className="inline-block mt-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                      {t('highPriority')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Monthly Trend Chart */}
        <div className={`${themeClasses.card} rounded-2xl shadow-lg p-6 animate-fade-in`}>
          <h3 className={`text-xl font-bold ${themeClasses.text} mb-4`}>📈 Trend Mensile</h3>
          <div className="h-64">
            <Line
              data={getMonthlyTrendData(filteredTransactions)}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                  },
                  title: {
                    display: true,
                    text: 'Entrate vs Uscite - Ultimi 6 Mesi'
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: function(value) {
                        return formatCurrency(value);
                      }
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Category Breakdown Chart */}
        <div className={`${themeClasses.card} rounded-2xl shadow-lg p-6 animate-fade-in`}>
          <h3 className={`text-xl font-bold ${themeClasses.text} mb-4`}>🎯 Spese per Categoria</h3>
          <div className="h-64">
            <Pie
              data={getCategoryPieData(filteredTransactions)}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'right',
                  },
                  title: {
                    display: true,
                    text: 'Distribuzione Spese'
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* PDF Modal */}
      {showPDFModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{t('pdfTitle')}</h2>
            <p className="text-gray-600 mb-6">{t('pdfSubtitle')}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data da
                </label>
                <input
                  type="date"
                  value={pdfDateFilters.dateFrom}
                  onChange={(e) => setPdfDateFilters({ ...pdfDateFilters, dateFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data fino
                </label>
                <input
                  type="date"
                  value={pdfDateFilters.dateTo}
                  onChange={(e) => setPdfDateFilters({ ...pdfDateFilters, dateTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={handlePDFDownloadConfirm}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                📄 Scarica PDF
              </button>
              <button
                onClick={() => setShowPDFModal(false)}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">📱 QR Code</h2>
            <p className="text-gray-600 mb-6">Scansiona per accedere rapidamente</p>
            
            <div className="flex justify-center mb-4">
              <div id="qrcode" className="p-4 bg-white rounded-lg shadow-inner"></div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowQRModal(false)}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
              >
                Chiudi
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mt-4">
              Perfetto per condividere l'accesso via mobile
            </p>
          </div>
        </div>
      )}

      {/* WhatsApp Assistance */}
      {selectedClient && (
        <a
          href={`https://wa.me/393772411743?text=Ciao!%20Ho%20bisogno%20di%20assistenza%20per%20la%20mia%20contabilità.%0ACliente:%20${encodeURIComponent(selectedClient.name)}%0AProblema:%20`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-20 right-6 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg transition-colors duration-200 z-50"
          title="Contatta assistenza su WhatsApp"
        >
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.525 3.488" />
          </svg>
        </a>
      )}

      {/* Toast Notifications */}
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg text-white font-medium animate-fade-in ${
            toast.type === 'success' ? 'bg-green-500' :
            toast.type === 'error' ? 'bg-red-500' :
            'bg-blue-500'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  </div>
);

}

export default App;

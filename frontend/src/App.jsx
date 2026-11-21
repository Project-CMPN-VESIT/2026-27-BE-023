import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopNavbar from './components/TopNavbar';
import Dashboard from './pages/Dashboard';
import Predictions from './pages/Predictions';
import Products from './pages/Products';
import Sales from './pages/Sales';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import Import from './pages/Import';
import Login from './pages/Login';
import WarehouseManager from './pages/WarehouseManager';
import Suppliers from './pages/Suppliers';
import Staff from './pages/Staff';
import Alerts from './pages/Alerts';
import BarcodeSheet from './pages/BarcodeSheet';
import Chatbot from './components/Chatbot';
import BarcodeHUD from './components/BarcodeHUD';
import { Sparkle, Warning, Info, CheckCircle } from '@phosphor-icons/react';
import axios from 'axios';

// Global request interceptor to inject the selected brand and auth token dynamically
axios.interceptors.request.use(config => {
  const activeBrand = localStorage.getItem('inventai_active_brand') || 'Apparel & Fashion';
  config.headers['x-brand'] = activeBrand;
  const token = localStorage.getItem('inventai_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, error => {
  return Promise.reject(error);
});

function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('inventai_theme') || 'light');
  const [toasts, setToasts] = useState([]);

  // Check login state
  useEffect(() => {
    const savedUser = localStorage.getItem('inventai_user');
    const token = localStorage.getItem('inventai_token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Theme Sync
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('inventai_theme', theme);
  }, [theme]);

  const playAlertSound = (severity) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      if (severity === 'Critical') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
        
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
        gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.95);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(ctx.currentTime + 0.15);
        osc2.stop(ctx.currentTime + 0.95);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      }
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch (err) {
      console.error('AudioContext synthesis failed:', err);
    }
  };

  // WebSocket Live Updates Setup
  useEffect(() => {
    if (!user) return;

    // Use standard WS connection to port 5000
    const ws = new WebSocket('ws://localhost:5000');

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('🔌 Live WebSocket Event:', data);
        
        let msg = "";
        let type = "info";
        let icon = <Info weight="fill" />;

        if (data.type === 'WELCOME') {
          return; 
        } else if (data.type === 'PRODUCT_CHANGE') {
          msg = `📦 Lot updated: ${data.payload.name || 'SKU'} current stock: ${data.payload.current_stock} cartons`;
          type = "success";
          icon = <CheckCircle weight="fill" />;
        } else if (data.type === 'SALE_LOGGED') {
          msg = `💸 B2B Sale registered! Quantity: ${data.payload.quantity_sold} cartons`;
          type = "info";
          icon = <Sparkle weight="fill" />;
        } else if (data.type === 'ALERT_TRIGGERED') {
          msg = `🚨 [${data.payload.severity}] ${data.payload.title}: ${data.payload.message}`;
          type = data.payload.severity === 'Critical' ? "danger" : "alert";
          icon = <Warning weight="fill" />;
          
          // Play browser-synthesized audio beeps!
          playAlertSound(data.payload.severity);
          
          // Emit reactive window event for navbar unread count badge!
          window.dispatchEvent(new Event('inventai_new_alert'));
        }

        if (msg) {
          showToast(msg, type, icon);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket transmission', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [user]);

  // Global Keyboard-Wedge USB Barcode Scanner listener
  useEffect(() => {
    if (!user) return;

    let barcodeBuffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e) => {
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (barcodeBuffer.length >= 4 && timeDiff < 60) {
          console.log('⚡️ USB Wedge Barcode Scanned:', barcodeBuffer);
          window.dispatchEvent(new CustomEvent('inventai_barcode_scanned', { detail: barcodeBuffer }));
          barcodeBuffer = '';
          e.preventDefault();
          e.stopPropagation();
        }
      } else if (e.key.length === 1) {
        // If human speed typing, reset buffer
        if (timeDiff > 60 && barcodeBuffer !== '') {
          barcodeBuffer = '';
        }
        barcodeBuffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // capture phase interception
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [user]);

  const showToast = (message, type, icon) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, icon }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  const handleLogout = () => {
    localStorage.removeItem('inventai_token');
    localStorage.removeItem('inventai_user');
    setUser(null);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Auth Guard
  if (!user) {
    return <Login onLoginSuccess={setUser} theme={theme} onToggleTheme={toggleTheme} />;
  }

  return (
    <BrowserRouter>
      <div className="app-container">
        {/* Dynamic Sidebar with role context */}
        <Sidebar user={user} onLogout={handleLogout} />
        
        <main className="main-content">
          {/* Top Navbar with user profiles & Dark mode */}
          <TopNavbar user={user} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout} />
          
          <div className="dashboard-scroll-area">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard user={user} />} />
              <Route path="/products" element={<Products user={user} />} />
              <Route path="/sales" element={<Sales user={user} />} />
              <Route path="/inventory" element={<Inventory user={user} />} />
              <Route path="/predictions" element={<Predictions user={user} />} />
              <Route path="/reports" element={<Reports user={user} />} />
              <Route path="/import" element={<Import user={user} />} />
              <Route path="/warehouse" element={<WarehouseManager user={user} />} />
              <Route path="/suppliers" element={<Suppliers user={user} />} />
              <Route path="/staff" element={<Staff user={user} />} />
              <Route path="/alerts" element={<Alerts user={user} />} />
              <Route path="/barcodes" element={<BarcodeSheet />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </main>

        {/* Global Live Toast Container */}
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.type}`}>
              <span style={{ fontSize: '20px', display: 'flex', alignItems: 'center' }}>{t.icon}</span>
              <span>{t.message}</span>
            </div>
          ))}
        </div>

        {/* Global Floating AI Operations Assistant */}
        <Chatbot />

        {/* Global Barcode Scanning Hub HUD */}
        <BarcodeHUD user={user} />
      </div>
    </BrowserRouter>
  );
}

export default App;

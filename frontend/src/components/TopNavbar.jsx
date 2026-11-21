import React, { useState, useEffect } from 'react';
import { MagnifyingGlass, Bell, CaretDown, Moon, Sun, SignOut, Buildings, Plus, Tag, Trash, WarningCircle, CheckCircle, Barcode } from '@phosphor-icons/react';
import axios from 'axios';

const TopNavbar = ({ user, theme, onToggleTheme, onLogout }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [navbarAlerts, setNavbarAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchText, setSearchText] = useState('');

  const handleSearchKeyDown = async (e) => {
    if (e.key === 'Enter') {
      const query = searchText.trim();
      if (!query) return;

      // Check if input resembles a barcode format
      const isBarcodePattern = /^\d{12,13}$/.test(query) || query.startsWith('BRC-') || query.startsWith('BAR-') || query.startsWith('200');

      if (isBarcodePattern) {
        try {
          const res = await axios.get(`http://localhost:5000/api/products/barcode/${query}`);
          if (res.data) {
            window.dispatchEvent(new CustomEvent('inventai_barcode_scanned', { detail: query }));
            setSearchText('');
          }
        } catch (err) {
          window.dispatchEvent(new CustomEvent('inventai_barcode_scanned', { detail: query }));
          setSearchText('');
        }
      }
    }
  };

  const fetchNavbarAlerts = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/alerts?status=unread');
      setNavbarAlerts(res.data.slice(0, 5));
      setUnreadCount(res.data.length);
    } catch (err) {
      console.error('Failed to fetch navbar alerts:', err);
    }
  };

  const handleMarkSingleRead = async (alertId) => {
    try {
      await axios.patch(`http://localhost:5000/api/alerts/${alertId}/read`);
      setNavbarAlerts(prev => prev.filter(a => a.id !== alertId));
      setUnreadCount(prev => Math.max(0, prev - 1));
      window.dispatchEvent(new Event('inventai_alerts_refreshed'));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await Promise.all(navbarAlerts.map(a => 
        axios.patch(`http://localhost:5000/api/alerts/${a.id}/read`)
      ));
      setNavbarAlerts([]);
      setUnreadCount(0);
      window.dispatchEvent(new Event('inventai_alerts_refreshed'));
    } catch (err) {
      console.error('Failed to clear alerts:', err);
    }
  };
  
  // Brand States
  const [activeBrand, setActiveBrand] = useState(
    localStorage.getItem('inventai_active_brand') || 'Apparel & Fashion'
  );
  const [brands, setBrands] = useState(() => {
    const saved = localStorage.getItem('inventai_brands');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    const defaultBrands = [
      'Apparel & Fashion',
      'Electronics & Gadgets',
      'FMCG & Pantry',
      'Pharma & Cosmetics',
      'Hardware & Power Tools'
    ];
    localStorage.setItem('inventai_brands', JSON.stringify(defaultBrands));
    return defaultBrands;
  });
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [isNewBrandModalOpen, setIsNewBrandModalOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [brandToDelete, setBrandToDelete] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Bidirectional brand synchronization & dynamic notifications sync
  useEffect(() => {
    const handleBrandChange = () => {
      setActiveBrand(localStorage.getItem('inventai_active_brand') || 'Apparel & Fashion');
      const savedBrands = localStorage.getItem('inventai_brands');
      if (savedBrands) {
        try {
          setBrands(JSON.parse(savedBrands));
        } catch (e) {
          // ignore
        }
      }
      fetchNavbarAlerts();
    };

    fetchNavbarAlerts();

    const handleAlertsRefresh = () => fetchNavbarAlerts();
    const handleNewAlert = () => fetchNavbarAlerts();

    window.addEventListener('inventai_brand_changed', handleBrandChange);
    window.addEventListener('inventai_alerts_refreshed', handleAlertsRefresh);
    window.addEventListener('inventai_new_alert', handleNewAlert);

    return () => {
      window.removeEventListener('inventai_brand_changed', handleBrandChange);
      window.removeEventListener('inventai_alerts_refreshed', handleAlertsRefresh);
      window.removeEventListener('inventai_new_alert', handleNewAlert);
    };
  }, []);

  const handleSelectBrand = (brand) => {
    localStorage.setItem('inventai_active_brand', brand);
    setActiveBrand(brand);
    setIsBrandDropdownOpen(false);
    window.dispatchEvent(new Event('inventai_brand_changed'));
  };

  const handleCreateBrand = (e) => {
    e.preventDefault();
    if (!newBrandName.trim()) return;
    const trimmed = newBrandName.trim();
    if (brands.includes(trimmed)) {
      alert("This brand catalog already exists!");
      return;
    }
    const updatedBrands = [...brands, trimmed];
    localStorage.setItem('inventai_brands', JSON.stringify(updatedBrands));
    localStorage.setItem('inventai_active_brand', trimmed);
    setBrands(updatedBrands);
    setActiveBrand(trimmed);
    setNewBrandName('');
    setIsNewBrandModalOpen(false);
    setIsBrandDropdownOpen(false);
    window.dispatchEvent(new Event('inventai_brand_changed'));
  };

  const triggerDeleteBrand = (e, brand) => {
    e.stopPropagation();
    if (brand === activeBrand) {
      alert("Cannot delete the currently active brand! Switch to another brand first.");
      return;
    }
    setBrandToDelete(brand);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteBrand = async () => {
    if (!brandToDelete) return;
    try {
      await axios.post('http://localhost:5000/api/brands/delete', { brand: brandToDelete });
      
      const updatedBrands = brands.filter(b => b !== brandToDelete);
      localStorage.setItem('inventai_brands', JSON.stringify(updatedBrands));
      setBrands(updatedBrands);
      setIsDeleteModalOpen(false);
      setBrandToDelete(null);
      
      // Dispatch brand changed event to refresh the UI
      window.dispatchEvent(new Event('inventai_brand_changed'));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to delete brand.');
    }
  };

  // Quick fallback name strings
  const roleDisplay = {
    'admin': '👑 Company Administrator',
    'staff': '🏷️ Procurement Staff',
    'warehouse_manager': '📦 Warehouse Manager'
  };

  const nameDisplay = user ? user.username.toUpperCase() : 'INVENTAI MOCK';
  const roleName = user ? (roleDisplay[user.role] || 'System User') : 'User';

  return (
    <>
      <header className="top-navbar">
        <div className="search-container" style={{ display: 'flex', alignItems: 'center' }}>
          <MagnifyingGlass className="search-icon" />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search SKUs or Scan Barcode..." 
            aria-label="Search" 
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          <button 
            type="button" 
            onClick={() => window.dispatchEvent(new Event('inventai_open_scanner'))}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-light)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 8px',
              marginRight: '4px',
              transition: 'color 0.2s'
            }}
            title="Scan Barcode / QR Code"
            onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-light)'}
          >
            <Barcode size={22} weight="fill" />
          </button>
          <div className="keyboard-shortcut">⌘K</div>
        </div>

        {/* Glassmorphic Brand Switcher dropdown */}
        <div className="brand-switcher-container">
          <div className="brand-switcher-trigger" onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}>
            <Buildings size={20} className="text-gradient" weight="fill" />
            <span>{activeBrand}</span>
            <CaretDown size={14} />
          </div>

          {isBrandDropdownOpen && (
            <div className="brand-switcher-dropdown">
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-light)', padding: '6px 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Select Active Brand
              </div>
              {brands.map(brand => (
                <div 
                  key={brand} 
                  className={`brand-dropdown-item ${activeBrand === brand ? 'active' : ''}`}
                  onClick={() => handleSelectBrand(brand)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <Tag size={16} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{brand}</span>
                  </div>
                  {brand !== activeBrand && (
                    <button 
                      className="delete-brand-btn"
                      onClick={(e) => triggerDeleteBrand(e, brand)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-light)',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        transition: 'all 0.2s ease',
                        flexShrink: 0
                      }}
                      title={`Remove brand catalog for ${brand}`}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-light)'}
                    >
                      <Trash size={15} />
                    </button>
                  )}
                </div>
              ))}
              
              <div className="brand-dropdown-divider"></div>
              
              <div className="brand-dropdown-item add-custom" onClick={() => { setIsNewBrandModalOpen(true); setIsBrandDropdownOpen(false); }}>
                <Plus size={16} />
                <span>Add Custom Brand</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="navbar-actions">
          {/* Dark/Light mode quick toggles */}
          <button className="icon-btn" onClick={onToggleTheme} title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}>
            {theme === 'light' ? <Moon size={22} /> : <Sun size={22} style={{ color: 'var(--warning)' }} />}
          </button>
 
          <div className="notifications-bell-container" style={{ position: 'relative' }}>
            <button className="icon-btn" onClick={() => setIsBellOpen(!isBellOpen)} aria-label="Notifications" title="System Alerts">
              <Bell />
              {unreadCount > 0 && <span className="notification-badge"></span>}
            </button>

            {isBellOpen && (
              <div className="notifications-dropdown-menu glass-card">
                <div className="notifications-header">
                  <span>System Alarms ({unreadCount})</span>
                  {unreadCount > 0 && <button className="clear-all-btn" onClick={handleMarkAllAsRead}>Mark all read</button>}
                </div>
                
                <div className="notifications-list">
                  {navbarAlerts.length === 0 ? (
                    <div className="empty-notifications">
                      <CheckCircle size={32} style={{ color: 'var(--success)' }} />
                      <p>Systems healthy. No unread alerts.</p>
                    </div>
                  ) : (
                    navbarAlerts.map(a => (
                      <div key={a.id} className={`notification-item severity-${a.severity.toLowerCase()}`}>
                        <div className="notification-content" onClick={() => { setIsBellOpen(false); window.location.href = '/alerts'; }} style={{ cursor: 'pointer' }}>
                          <div className="notification-title-bar">
                            <span className="notification-title">{a.title}</span>
                            <span className={`severity-tag ${a.severity.toLowerCase()}`}>{a.severity}</span>
                          </div>
                          <p className="notification-desc">{a.message}</p>
                          <span className="notification-time">
                            {new Date(a.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <button 
                          className="mark-read-btn" 
                          onClick={() => handleMarkSingleRead(a.id)}
                          title="Mark as Read"
                        >
                          <CheckCircle size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="notifications-footer">
                  <a href="/alerts" className="view-all-link" onClick={(e) => { e.preventDefault(); setIsBellOpen(false); window.location.href = '/alerts'; }}>
                    View Alerts Analytics &rarr;
                  </a>
                </div>
              </div>
            )}
          </div>
          
          <div className="user-profile" onClick={() => setIsDropdownOpen(!isDropdownOpen)} style={{position: 'relative'}}>
            <div className="avatar">
              <img src={`https://ui-avatars.com/api/?name=${nameDisplay}&background=6366F1&color=fff`} alt="User Avatar" />
            </div>
            <div className="user-info">
              <span className="user-name">{nameDisplay}</span>
              <span className="user-role">{roleName}</span>
            </div>
            <CaretDown />

            {/* Profile Dropdown */}
            {isDropdownOpen && (
              <div className="profile-dropdown" style={{
                position: 'absolute', top: '100%', right: 0, marginTop: '8px', 
                backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', 
                borderRadius: 'var(--radius-md)', padding: '8px', minWidth: '180px',
                boxShadow: 'var(--shadow-lg)', zIndex: 100
              }}>
                <div className="dropdown-item" onClick={onToggleTheme} style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', cursor: 'pointer', borderRadius: '4px', color: 'var(--text-main)', fontSize: '0.9rem'}}>
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                  {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </div>
                <div style={{height: '1px', backgroundColor: 'var(--border-light)', margin: '4px 0'}}></div>
                <div className="dropdown-item" onClick={onLogout} style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', cursor: 'pointer', borderRadius: '4px', color: 'var(--danger)', fontSize: '0.9rem'}}>
                  <SignOut size={18} />
                  Logout
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Custom Brand Creator glassmorphic modal overlay */}
      {isNewBrandModalOpen && (
        <div className="modal active" style={{ zIndex: 200 }}>
          <div className="modal-content glass-card" style={{ maxWidth: '450px' }}>
            <span className="close-modal" onClick={() => setIsNewBrandModalOpen(false)}>&times;</span>
            <h2 className="modal-title">➕ Add Custom Brand</h2>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '20px', lineHeight: '1.5' }}>
              Create a new standalone brand context. You can manage products, sales, and procurements for this brand in complete isolation.
            </p>
            <form onSubmit={handleCreateBrand}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Brand Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  placeholder="e.g. Nike, Apple, Ikea..." 
                  value={newBrandName} 
                  onChange={e => setNewBrandName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-actions" style={{ marginTop: '28px', gap: '12px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsNewBrandModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Brand Catalog</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Brand Deletion glassmorphic confirmation modal */}
      {isDeleteModalOpen && (
        <div className="modal active" style={{ zIndex: 200 }}>
          <div className="modal-content glass-card" style={{ maxWidth: '460px' }}>
            <span className="close-modal" onClick={() => setIsDeleteModalOpen(false)}>&times;</span>
            <h2 className="modal-title" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <WarningCircle size={24} weight="fill" /> Remove Brand Catalog
            </h2>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '20px', lineHeight: '1.5' }}>
              Are you absolutely sure you want to permanently delete the brand catalog for <strong style={{ color: 'var(--text-main)' }}>"{brandToDelete}"</strong>?
            </p>
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--danger)', padding: '14px', borderRadius: '8px', marginBottom: '24px', fontSize: '0.8rem', color: 'var(--danger-text)', lineHeight: '1.5' }}>
              <strong>⚠️ CRITICAL PERMANENT WIPE WARNING:</strong><br />
              This action is highly destructive and cannot be undone. Clicking delete will completely wipe all database records for this brand:
              <ul style={{ margin: '8px 0 0 16px', padding: 0 }}>
                <li>Products catalog and real-time inventory stocks</li>
                <li>B2B sales history invoices and XGBoost forecasting data</li>
                <li>Purchase orders, returns, and low-stock alerts</li>
                <li>Registered supplier vendor accounts</li>
                <li>Staff management registry: employee cards, monthly salary ledgers, daily work timelines, and past payment logs</li>
              </ul>
            </div>
            <div className="form-actions" style={{ marginTop: '28px', gap: '12px' }}>
              <button type="button" className="btn btn-outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
              <button 
                type="button" 
                className="btn" 
                onClick={confirmDeleteBrand}
                style={{ 
                  background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', 
                  color: 'white', 
                  border: 'none',
                  boxShadow: 'var(--shadow-md)',
                  fontWeight: 600
                }}
              >
                Yes, Wipe & Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TopNavbar;

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Barcode, Camera, Keyboard, Package, CheckCircle, WarningCircle, 
  ArrowsLeftRight, PlusCircle, MinusCircle, ClockCounterClockwise, Eye
} from '@phosphor-icons/react';

const API_BASE = 'http://localhost:5000/api';

const BarcodeHUD = ({ user, activeBrand }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scanMode, setScanMode] = useState('usb'); // 'usb' or 'camera'
  const [typedBarcode, setTypedBarcode] = useState('');
  const [lookupResult, setLookupResult] = useState(null); // product object or 'not_found'
  const [scannedCode, setScannedCode] = useState('');
  
  // Quick action states
  const [actionTab, setActionTab] = useState('view'); // 'view', 'receive', 'dispatch', 'transfer', 'logs'
  const [actionQty, setActionQty] = useState('');
  const [transferWarehouse, setTransferWarehouse] = useState('');
  const [warehouses, setWarehouses] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  const qrRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  // Fetch registered warehouses
  const fetchWarehouses = async () => {
    try {
      const res = await axios.get(`${API_BASE}/warehouses`);
      setWarehouses(res.data);
    } catch (err) {
      console.error('Failed to load warehouses in scanner HUD:', err);
    }
  };

  // Fetch barcode activity logs for product
  const fetchProductLogs = async (productId) => {
    try {
      const res = await axios.get(`${API_BASE}/barcode-logs`);
      const filtered = res.data.filter(l => l.product_id === productId);
      setRecentLogs(filtered);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWarehouses();
    } else {
      stopCamera();
    }
  }, [isOpen]);

  useEffect(() => {
    if (lookupResult && lookupResult !== 'not_found') {
      fetchProductLogs(lookupResult.product_id);
    }
  }, [lookupResult]);

  // Global listeners for events
  useEffect(() => {
    const handleOpenScanner = () => {
      setIsOpen(true);
      setScanMode('camera');
      setLookupResult(null);
      setScannedCode('');
    };

    const handleBarcodeScanned = (e) => {
      const code = e.detail;
      setIsOpen(true);
      setScannedCode(code);
      setScanMode('usb');
      handleLookupBarcode(code);
    };

    window.addEventListener('inventai_open_scanner', handleOpenScanner);
    window.addEventListener('inventai_barcode_scanned', handleBarcodeScanned);

    return () => {
      window.removeEventListener('inventai_open_scanner', handleOpenScanner);
      window.removeEventListener('inventai_barcode_scanned', handleBarcodeScanned);
    };
  }, []);

  // HTML5 Camera Scanning Lifecycle
  useEffect(() => {
    if (isOpen && scanMode === 'camera' && !cameraActive) {
      startCamera();
    } else if (scanMode !== 'camera') {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, scanMode]);

  const startCamera = async () => {
    // Wait briefly for the DOM element to mount
    setTimeout(async () => {
      try {
        const elementId = "camera-scanner-viewport";
        const element = document.getElementById(elementId);
        if (!element) return;

        if (html5QrCodeRef.current) {
          await stopCamera();
        }

        const html5QrCode = new Html5Qrcode(elementId);
        html5QrCodeRef.current = html5QrCode;
        setCameraActive(true);

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (width, height) => {
              // Rectangular box suited for barcode lines
              return { width: Math.min(width * 0.8, 300), height: Math.min(height * 0.4, 150) };
            }
          },
          async (decodedText) => {
            console.log("📷 Camera Decoded Code:", decodedText);
            setScannedCode(decodedText);
            await stopCamera();
            setScanMode('usb');
            handleLookupBarcode(decodedText);
          },
          (errorMessage) => {
            // standard frame scan fail, ignore
          }
        );
      } catch (err) {
        console.error("Failed to start camera scan:", err);
        setCameraActive(false);
      }
    }, 300);
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.error("Failed to stop camera:", err);
      }
    }
    html5QrCodeRef.current = null;
    setCameraActive(false);
  };

  const handleLookupBarcode = async (codeVal) => {
    if (!codeVal) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/products/barcode/${codeVal}`);
      setLookupResult(res.data);
      setActionTab('view');
    } catch (err) {
      console.error(err);
      setLookupResult('not_found');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    if (!typedBarcode.trim()) return;
    setScannedCode(typedBarcode.trim());
    handleLookupBarcode(typedBarcode.trim());
    setTypedBarcode('');
  };

  // Perform Receive/Dispatch/Transfer Actions
  const handleStockAction = async (e) => {
    e.preventDefault();
    if (actionTab !== 'transfer' && !actionQty) {
      alert('Please enter a valid quantity.');
      return;
    }
    if (actionTab === 'transfer' && !transferWarehouse) {
      alert('Please select a destination warehouse.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/products/barcode/action`, {
        product_id: lookupResult.product_id,
        action_type: actionTab,
        quantity: Number(actionQty),
        destination_warehouse: transferWarehouse,
        username: user ? user.username : 'Admin'
      });

      // Update HUD state
      setLookupResult(res.data.product);
      setActionQty('');
      setTransferWarehouse('');
      fetchProductLogs(res.data.product.product_id);
      
      // Dispatch global brand change event to force lists to reload
      window.dispatchEvent(new Event('inventai_brand_changed'));

      alert(`✅ Transaction success: ${res.data.log.details}`);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Stock transaction failed.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger fallback workflow to register unrecognized scanned barcode
  const handleRegisterNewSKU = () => {
    // 1. Store temporary barcode in localStorage
    localStorage.setItem('inventai_temp_barcode', scannedCode);
    setIsOpen(false);

    // 2. Redirect to products catalog page
    if (window.location.pathname !== '/products') {
      window.location.href = '/products';
    } else {
      // If already on products page, dispatch event to immediately trigger creation modal!
      window.dispatchEvent(new Event('inventai_trigger_add_lot'));
    }
  };

  if (!isOpen) return null;

  const isLowStock = lookupResult && lookupResult !== 'not_found' && lookupResult.current_stock < lookupResult.threshold;

  return (
    <div className="modal active" style={{ zIndex: 110 }}>
      <div className="modal-content glass-card" style={{ maxWidth: '600px', padding: '0', overflow: 'hidden' }}>
        
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Barcode size={24} className="text-gradient" weight="fill" /> Barcode Scanner Hub
          </h2>
          <span className="close-modal" style={{ fontSize: '28px', cursor: 'pointer', lineHeight: 1 }} onClick={() => setIsOpen(false)}>&times;</span>
        </div>

        {/* Action Toggle Modes */}
        <div style={{ display: 'flex', backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)' }}>
          <button 
            style={{ 
              flex: 1, padding: '14px', border: 'none', background: scanMode === 'usb' ? 'var(--bg-surface)' : 'transparent',
              color: scanMode === 'usb' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem',
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer',
              borderBottom: scanMode === 'usb' ? '2px solid var(--primary)' : 'none'
            }}
            onClick={() => setScanMode('usb')}
          >
            <Keyboard size={18} /> USB wedge / Manual Search
          </button>
          <button 
            style={{ 
              flex: 1, padding: '14px', border: 'none', background: scanMode === 'camera' ? 'var(--bg-surface)' : 'transparent',
              color: scanMode === 'camera' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem',
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer',
              borderBottom: scanMode === 'camera' ? '2px solid var(--primary)' : 'none'
            }}
            onClick={() => setScanMode('camera')}
          >
            <Camera size={18} /> Webcam camera scanner
          </button>
        </div>

        <div style={{ padding: '24px', maxHeight: '550px', overflowY: 'auto' }}>
          
          {/* CAMERA SCANNING FEED VIEW */}
          {scanMode === 'camera' && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div 
                id="camera-scanner-viewport" 
                style={{ 
                  width: '100%', 
                  maxWidth: '380px', 
                  height: '240px', 
                  borderRadius: '12px', 
                  overflow: 'hidden', 
                  background: '#000000',
                  position: 'relative',
                  border: '2px dashed var(--primary)'
                }}
              >
                {!cameraActive && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#ffffff', fontSize: '0.9rem' }}>
                    Initializing webcam permissions...
                  </div>
                )}
              </div>
              <p className="text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>
                Align standard barcode lines or QR codes inside the glowing target boundary box to scan automatically.
              </p>
            </div>
          )}

          {/* USB WEDGE / MANUAL INPUT LOOKUP VIEW */}
          {scanMode === 'usb' && !lookupResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center', padding: '16px 0' }}>
              <div style={{ padding: '24px', background: 'var(--bg-app)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <Keyboard size={48} className="text-gradient" weight="fill" style={{ margin: '0 auto 12px auto' }} />
                <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 700 }}>Scan Label using Hardware USB Wedge</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  If you have a physical barcode gun connected, simply pull the trigger to scan a label now. The system's keyboard wedge listeners will capture the scan instantly.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ height: '1px', background: 'var(--border-light)', flex: 1 }}></div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>OR Type Barcode Code</span>
                <div style={{ height: '1px', background: 'var(--border-light)', flex: 1 }}></div>
              </div>

              <form onSubmit={handleManualSearch} style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Type numeric EAN-13, SKU, or custom code..." 
                  value={typedBarcode}
                  onChange={e => setTypedBarcode(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0 20px', whiteSpace: 'nowrap' }}>
                  Lookup SKU
                </button>
              </form>
            </div>
          )}

          {/* SEARCH RESULT AND ACTIONS AREA */}
          {scannedCode && (
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>SCANNED BARCODE:</span>
              <code style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '0.05em' }}>{scannedCode}</code>
            </div>
          )}

          {loading && (
            <div className="text-center text-muted" style={{ padding: '32px' }}>
              Performing systems database lookup...
            </div>
          )}

          {/* NOT FOUND FALLBACK SCREEN */}
          {!loading && lookupResult === 'not_found' && (
            <div className="card text-center" style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid rgba(239, 68, 68, 0.15)', backgroundColor: 'rgba(239, 68, 68, 0.02)' }}>
              <WarningCircle size={48} style={{ color: 'var(--danger)', margin: '0 auto' }} weight="fill" />
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-main)' }}>Product Not Found</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  The scanned barcode value is not currently registered under <strong style={{ color: 'var(--text-main)' }}>"{activeBrand}"</strong> brand catalog context.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setLookupResult(null)}>
                  Try Another Scan
                </button>
                <button className="btn btn-primary" style={{ flex: 1.5 }} onClick={handleRegisterNewSKU}>
                  ➕ Register New SKU Lot
                </button>
              </div>
            </div>
          )}

          {/* ACTIVE PRODUCT LOADED HUD */}
          {!loading && lookupResult && lookupResult !== 'not_found' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Product Info Banner */}
              <div className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="product-img bg-gray" style={{ width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '20px', borderRadius: '8px', color: 'var(--primary)' }}>
                    <Package weight="fill" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 2px 0' }}>{lookupResult.name}</h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>SKU: {lookupResult.product_id} | Category: {lookupResult.category}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className={`status-badge ${isLowStock ? 'status-high' : 'status-normal'}`} style={{ padding: '2px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isLowStock ? <WarningCircle weight="fill" /> : <CheckCircle weight="fill" />}
                    {isLowStock ? 'Low Stock' : 'Healthy'}
                  </span>
                </div>
              </div>

              {/* Action Tabs selectors */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', gap: '4px' }}>
                <button 
                  className={`btn ${actionTab === 'view' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: '8px', fontSize: '0.78rem' }}
                  onClick={() => setActionTab('view')}
                >
                  <Eye size={15} /> Details
                </button>
                <button 
                  className={`btn ${actionTab === 'receive' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: '8px', fontSize: '0.78rem' }}
                  onClick={() => setActionTab('receive')}
                >
                  <PlusCircle size={15} /> Receive
                </button>
                <button 
                  className={`btn ${actionTab === 'dispatch' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: '8px', fontSize: '0.78rem' }}
                  onClick={() => setActionTab('dispatch')}
                >
                  <MinusCircle size={15} /> Dispatch
                </button>
                <button 
                  className={`btn ${actionTab === 'transfer' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: '8px', fontSize: '0.78rem' }}
                  onClick={() => setActionTab('transfer')}
                >
                  <ArrowsLeftRight size={15} /> Transfer
                </button>
                <button 
                  className={`btn ${actionTab === 'logs' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: '8px', fontSize: '0.78rem' }}
                  onClick={() => setActionTab('logs')}
                >
                  <ClockCounterClockwise size={15} /> Logs
                </button>
              </div>

              {/* Actions panels */}
              <div style={{ minHeight: '150px' }}>
                {actionTab === 'view' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Available stock</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px', color: isLowStock ? 'var(--danger)' : 'var(--success)' }}>
                        {lookupResult.current_stock} cartons
                      </span>
                    </div>
                    <div className="card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Storage Facility</span>
                      <span style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-main)' }}>
                        {lookupResult.warehouse_location}
                      </span>
                    </div>
                    <div className="card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pricing Tier</span>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px', color: 'var(--text-main)' }}>
                        ₹{lookupResult.price.toLocaleString()}
                      </span>
                    </div>
                    <div className="card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Safety Boundary</span>
                      <span style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '4px', color: 'var(--text-main)' }}>
                        {lookupResult.threshold} cartons
                      </span>
                    </div>
                  </div>
                )}

                {actionTab === 'receive' && (
                  <form onSubmit={handleStockAction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Cartons to Add/Receive</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        required 
                        min="1"
                        placeholder="e.g. 15"
                        value={actionQty}
                        onChange={e => setActionQty(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
                      {loading ? 'Processing...' : '✓ Confirm Stock Receipt'}
                    </button>
                  </form>
                )}

                {actionTab === 'dispatch' && (
                  <form onSubmit={handleStockAction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Cartons to dispatch/sell</label>
                      <input 
                        type="number" 
                        className="form-input" 
                        required 
                        min="1"
                        placeholder="e.g. 8"
                        value={actionQty}
                        onChange={e => setActionQty(e.target.value)}
                      />
                    </div>
                    <button 
                      type="submit" 
                      className="btn" 
                      disabled={loading} 
                      style={{ 
                        width: '100%', 
                        background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', 
                        color: 'white',
                        border: 'none'
                      }}
                    >
                      {loading ? 'Processing...' : '✓ Confirm Stock Dispatch'}
                    </button>
                  </form>
                )}

                {actionTab === 'transfer' && (
                  <form onSubmit={handleStockAction} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Destination facility</label>
                      <select 
                        className="form-input" 
                        required
                        value={transferWarehouse}
                        onChange={e => setTransferWarehouse(e.target.value)}
                      >
                        <option value="">Select Warehouse...</option>
                        {warehouses.filter(w => w.name !== lookupResult.warehouse_location).map(w => (
                          <option key={w.id} value={w.name}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
                      {loading ? 'Processing...' : '✓ Execute Location Relocation'}
                    </button>
                  </form>
                )}

                {actionTab === 'logs' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {recentLogs.length === 0 ? (
                      <div className="text-center text-muted" style={{ padding: '16px' }}>No logs registered.</div>
                    ) : (
                      recentLogs.slice(0, 3).map(l => (
                        <div key={l.id} className="card" style={{ padding: '10px 14px', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                            <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{l.action_type}</span>
                            <span>{new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <span style={{ fontWeight: 600 }}>{l.details}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Drawer footer options */}
              <div style={{ display: 'flex', gap: '12px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setLookupResult(null)}>
                  Clear / Rescan Label
                </button>
                <button className="btn btn-primary" style={{ flex: 1.2 }} onClick={() => setIsOpen(false)}>
                  Close Hub View
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default BarcodeHUD;

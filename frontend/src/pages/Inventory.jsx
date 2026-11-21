import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Stack, Package, Clock, ShieldWarning } from '@phosphor-icons/react';

const API_BASE = 'http://localhost:5000/api';

const Inventory = () => {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, mRes] = await Promise.all([
        axios.get(`${API_BASE}/products`),
        axios.get(`${API_BASE}/inventory/movements`)
      ]);
      setProducts(pRes.data);
      setMovements(mRes.data);
    } catch (err) {
      console.error("Failed to fetch inventory data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    window.addEventListener('inventai_brand_changed', fetchData);
    
    // Listen to real-time websocket changes broadcasted in the window!
    const handleProductChange = () => {
      fetchData();
    };
    window.addEventListener('inventai_barcode_scanned', handleProductChange);
    
    return () => {
      window.removeEventListener('inventai_brand_changed', fetchData);
      window.removeEventListener('inventai_barcode_scanned', handleProductChange);
    };
  }, []);

  return (
    <div className="view-section active">
      <div className="dashboard-header">
        <div>
          <h2 className="page-title text-gradient">Warehouse Inventory Hub</h2>
          <p className="page-subtitle">Real-time carton stocks, threshold safety limits, and chronological movement ledger.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '28px' }}>
        {/* Live Stock Tracking Table */}
        <div className="card glass-card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Stack size={24} className="text-accent-gradient" weight="fill" />
              <h3 className="card-title">Live Stock Tracking</h3>
            </div>
          </div>
          
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Lot</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Threshold Limit</th>
                  <th>Capacity / Health</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-muted" style={{ padding: '32px' }}>
                      No items in inventory yet.
                    </td>
                  </tr>
                ) : (
                  products.map(p => {
                    const isLow = p.current_stock < p.threshold;
                    const isCritical = p.current_stock === 0;
                    
                    const maxCap = p.threshold * 3;
                    const percentage = Math.min(100, Math.max(0, (p.current_stock / maxCap) * 100));
                    
                    let barColor = 'var(--success)';
                    if (isCritical) barColor = 'var(--danger)';
                    else if (isLow) barColor = 'var(--warning)';

                    return (
                      <tr key={p.product_id}>
                        <td>
                          <div className="product-info-cell" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="product-img bg-gray" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '32px', height: '32px', borderRadius: '8px', color: 'var(--primary)' }}>
                              <Package size={18} weight="fill" />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600 }}>{p.name}</div>
                              {p.created_via_PO && (
                                <span className="status-badge status-high" style={{ fontSize: '0.58rem', padding: '1px 5px', marginTop: '2px', display: 'inline-block', borderRadius: '3px', fontWeight: 800 }}>
                                  📦 PO Auto
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.category}</span>
                        </td>
                        <td style={{ fontWeight: 700, fontSize: '1.05rem' }}>{p.current_stock} cartons</td>
                        <td className="text-muted">{p.threshold}</td>
                        <td style={{ width: '160px' }}>
                          <div style={{ width: '100%', backgroundColor: 'var(--border-light)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${percentage}%`, backgroundColor: barColor, height: '100%', transition: 'width 0.3s ease' }}></div>
                          </div>
                        </td>
                        <td>
                          {isCritical ? (
                            <span className="status-badge status-low">Out of Stock</span>
                          ) : isLow ? (
                            <span className="status-badge status-low">Low Stock</span>
                          ) : (
                            <span className="status-badge status-normal">Healthy</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Real-time Inventory Movements Timeline */}
        <div className="card glass-card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Clock size={24} className="text-accent-gradient" weight="fill" />
              <h3 className="card-title">Stock Movements Log</h3>
            </div>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '550px', overflowY: 'auto', paddingRight: '4px' }}>
              {movements.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 12px' }}>
                  <ShieldWarning size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>No stock movements recorded yet. Draft POs or disburse sales logs to record entries.</p>
                </div>
              ) : (
                movements.map(m => {
                  const isIN = m.movement_type === 'IN';
                  const isOut = m.movement_type === 'OUT';
                  
                  let badgeStyle = { backgroundColor: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary)' };
                  if (isIN) badgeStyle = { backgroundColor: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)' };
                  if (isOut) badgeStyle = { backgroundColor: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)' };

                  return (
                    <div key={m.id} style={{ 
                      borderLeft: `3px solid ${isIN ? 'var(--success)' : isOut ? 'var(--danger)' : 'var(--primary)'}`, 
                      padding: '12px 14px', 
                      backgroundColor: 'rgba(255,255,255,0.02)', 
                      borderRadius: '0 8px 8px 0',
                      borderTop: '1px solid var(--border-light)',
                      borderRight: '1px solid var(--border-light)',
                      borderBottom: '1px solid var(--border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                          {m.products?.name || m.product_id}
                        </span>
                        <span className="status-badge" style={{ ...badgeStyle, fontSize: '0.68rem', padding: '1px 5px', fontWeight: 800 }}>
                          {isIN ? '+' : isOut ? '-' : ''}{m.quantity}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        ⚙️ {m.reference_type} Ref: <strong>{m.reference_id}</strong>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-light)', textAlign: 'right', marginTop: '2px' }}>
                        📅 {new Date(m.created_at).toLocaleString()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inventory;

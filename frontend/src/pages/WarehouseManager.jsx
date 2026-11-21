import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { House, Stack, Calendar, WarningCircle, ArrowCounterClockwise, Package, Plus, Trash } from '@phosphor-icons/react';

const API_BASE = 'http://localhost:5000/api';

const WarehouseManager = () => {
  const [products, setProducts] = useState([]);
  const [returns, setReturns] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');
  const [isReturnModalOpen, setReturnModalOpen] = useState(false);
  const [isManageModalOpen, setManageModalOpen] = useState(false);
  const [returnForm, setReturnForm] = useState({ product_id: '', quantity: '', type: 'damaged', reason: '' });
  const [newWarehouseName, setNewWarehouseName] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [pRes, rRes, wRes] = await Promise.all([
        axios.get(`${API_BASE}/products`),
        axios.get(`${API_BASE}/returns`),
        axios.get(`${API_BASE}/warehouses`)
      ]);
      setProducts(pRes.data);
      setReturns(rRes.data);
      setWarehouses(wRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateWarehouse = async (e) => {
    e.preventDefault();
    if (!newWarehouseName.trim()) return;
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/warehouses`, { name: newWarehouseName.trim() });
      setNewWarehouseName('');
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to register facility.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWarehouse = async (warehouseId) => {
    setLoading(true);
    try {
      await axios.delete(`${API_BASE}/warehouses/${warehouseId}`);
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to remove facility.');
    } finally {
      setLoading(false);
    }
  };

  const getProductCountInWarehouse = (wName) => {
    return products.filter(p => p.warehouse_location === wName).length;
  };

  useEffect(() => {
    fetchData();

    window.addEventListener('inventai_brand_changed', fetchData);
    return () => {
      window.removeEventListener('inventai_brand_changed', fetchData);
    };
  }, []);

  const handleLogReturn = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/returns`, {
        product_id: returnForm.product_id,
        quantity: Number(returnForm.quantity),
        type: returnForm.type,
        reason: returnForm.reason
      });
      setReturnModalOpen(false);
      setReturnForm({ product_id: '', quantity: '', type: 'damaged', reason: '' });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to log transaction. Verify that the product code is registered.');
    } finally {
      setLoading(false);
    }
  };

  const warehouseOptions = ['All', ...warehouses.map(w => w.name)];
  const filteredProducts = selectedWarehouse === 'All' 
    ? products 
    : products.filter(p => p.warehouse_location === selectedWarehouse);

  return (
    <div className="view-section active">
      <div className="dashboard-header">
        <div>
          <h2 className="page-title">Multi-Warehouse & Damage Tracking</h2>
          <p className="page-subtitle">Track carton distributions and damaged lots across B2B facilities.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-outline" onClick={() => setManageModalOpen(true)}>
            🏢 Manage Facilities
          </button>
          <button className="btn btn-accent" onClick={() => setReturnModalOpen(true)}>
            <Plus style={{ marginRight: '8px' }} /> Log Damage / Return
          </button>
        </div>
      </div>

      {/* Warehouse Selector */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {warehouseOptions.map(w => (
          <button 
            key={w} 
            className={`btn ${selectedWarehouse === w ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setSelectedWarehouse(w)}
            style={{ fontSize: '0.85rem', padding: '8px 16px' }}
          >
            <House style={{ marginRight: '6px' }} /> {w}
          </button>
        ))}
      </div>

      {/* Distribution Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: '28px', alignItems: 'start' }}>
        {/* Products by Warehouse Location */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><Stack /> Stocks at {selectedWarehouse}</h3>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Lot</th>
                  <th>Category</th>
                  <th>Warehouse Location</th>
                  <th>Stock Count</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center text-muted" style={{ padding: '32px' }}>
                      No stock carton lots mapped to this warehouse.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(p => (
                    <tr key={p.product_id}>
                      <td>
                        <div className="product-info-cell">
                          <div className="product-img bg-gray" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <Package />
                          </div>
                          <span>{p.name}</span>
                        </div>
                      </td>
                      <td>{p.category}</td>
                      <td><span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>{p.warehouse_location}</span></td>
                      <td style={{ fontWeight: 700 }}>{p.current_stock} cartons</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Returned and Damaged Lots Log */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><ArrowCounterClockwise /> Damage & Return Logs</h3>
          </div>
          <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Type</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {returns.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center text-muted" style={{ padding: '32px' }}>
                      No damage or returns logged yet.
                    </td>
                  </tr>
                ) : (
                  returns.map(r => {
                    const p = products.find(x => x.product_id === r.product_id);
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{p ? p.name : 'Unknown Product'}</td>
                        <td>{r.quantity}</td>
                        <td>
                          <span className={`status-badge ${r.type === 'damaged' ? 'status-high' : 'status-low'}`}>
                            {r.type === 'damaged' ? 'Damaged' : 'Returned'}
                          </span>
                        </td>
                        <td className="text-muted" style={{ fontSize: '0.8rem' }}>{r.reason}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Log Return Modal */}
      {isReturnModalOpen && (
        <div className="modal active">
          <div className="modal-content">
            <span className="close-modal" onClick={() => setReturnModalOpen(false)}>&times;</span>
            <h2 className="modal-title">Log Return or Damage Lot</h2>
            <form onSubmit={handleLogReturn}>
              <div className="form-group">
                <label className="form-label">Select Stock Item</label>
                <select className="form-input" required value={returnForm.product_id} onChange={e => setReturnForm({ ...returnForm, product_id: e.target.value })}>
                  <option value="">Choose item...</option>
                  {products.map(p => (
                    <option key={p.product_id} value={p.product_id}>{p.name} (Stock: {p.current_stock})</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Quantity (Cartons)</label>
                  <input type="number" min="1" className="form-input" required value={returnForm.quantity} onChange={e => setReturnForm({ ...returnForm, quantity: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Transaction Type</label>
                  <select className="form-input" required value={returnForm.type} onChange={e => setReturnForm({ ...returnForm, type: e.target.value })}>
                    <option value="damaged">💥 Damaged Stock (Decrements stock)</option>
                    <option value="returned">↩️ Customer Return (Increments stock)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Audit / Reason</label>
                <input type="text" className="form-input" required placeholder="e.g. Broken packaging / Fabric discoloration" value={returnForm.reason} onChange={e => setReturnForm({ ...returnForm, reason: e.target.value })} />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => setReturnModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-accent" disabled={loading}>{loading ? 'Saving...' : 'Log Event'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Warehouses Modal */}
      {isManageModalOpen && (
        <div className="modal active">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <span className="close-modal" onClick={() => setManageModalOpen(false)}>&times;</span>
            <h2 className="modal-title">Active Facilities Management</h2>
            
            {/* List of Registered Warehouses */}
            <div style={{ margin: '20px 0', maxHeight: '250px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Facility Name</th>
                    <th>Occupied Lots</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="text-center text-muted">No custom facilities registered.</td>
                    </tr>
                  ) : (
                    warehouses.map(w => {
                      const count = getProductCountInWarehouse(w.name);
                      const isDefault = w.name === 'Mumbai Main Warehouse';
                      
                      return (
                        <tr key={w.id}>
                          <td style={{ fontWeight: 600 }}>🏢 {w.name}</td>
                          <td>
                            <span className={`status-badge ${count > 0 ? 'status-normal' : 'status-low'}`}>
                              {count} SKU lots
                            </span>
                          </td>
                          <td>
                            <button 
                              className="btn btn-outline" 
                              style={{ 
                                padding: '4px 8px', 
                                color: isDefault ? 'var(--text-muted)' : 'var(--danger)', 
                                borderColor: isDefault ? 'var(--border)' : 'rgba(239, 68, 68, 0.2)',
                                cursor: isDefault ? 'not-allowed' : 'pointer'
                              }} 
                              disabled={isDefault || loading}
                              onClick={() => handleDeleteWarehouse(w.id)}
                              title={isDefault ? 'System default warehouse' : 'Remove Facility'}
                            >
                              <Trash size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Add New Warehouse Form */}
            <form onSubmit={handleCreateWarehouse} style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>➕ Register New Facility</h3>
              <div className="form-group" style={{ display: 'flex', gap: '12px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Pune Dispatch Terminal" 
                  required 
                  value={newWarehouseName} 
                  onChange={e => setNewWarehouseName(e.target.value)} 
                />
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ whiteSpace: 'nowrap' }}>
                  {loading ? 'Adding...' : 'Register'}
                </button>
              </div>
            </form>

            <div className="form-actions" style={{ marginTop: '24px' }}>
              <button type="button" className="btn btn-outline" onClick={() => setManageModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseManager;

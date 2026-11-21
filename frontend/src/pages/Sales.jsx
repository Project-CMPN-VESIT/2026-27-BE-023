import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, DownloadSimple, TrendUp, FileText } from '@phosphor-icons/react';

const API_BASE = 'http://localhost:5000/api';

const Sales = () => {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [isSaleModalOpen, setSaleModalOpen] = useState(false);
  const [saleForm, setSaleForm] = useState({ product_id: '', quantity_sold: '' });

  const fetchData = async () => {
    try {
      const [sRes, pRes] = await Promise.all([
        axios.get(`${API_BASE}/sales`),
        axios.get(`${API_BASE}/products`)
      ]);
      setSales(sRes.data);
      setProducts(pRes.data);
    } catch (err) {
      console.error("Failed to fetch sales data", err);
    }
  };

  useEffect(() => {
    fetchData();

    window.addEventListener('inventai_brand_changed', fetchData);
    return () => {
      window.removeEventListener('inventai_brand_changed', fetchData);
    };
  }, []);

  const handleLogSale = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/sales`, {
        product_id: saleForm.product_id,
        quantity_sold: Number(saleForm.quantity_sold)
      });
      setSaleModalOpen(false);
      setSaleForm({ product_id: '', quantity_sold: '' });
      fetchData();
      axios.post(`${API_BASE}/trigger-prediction`).catch(console.error);
    } catch (err) { 
      console.error(err);
      alert('Failed to log sale. Please check the console for details.');
    }
  };

  return (
    <div className="view-section active">
      <div className="dashboard-header">
        <div>
          <h2 className="page-title">B2B Sales Orders & Report</h2>
          <p className="page-subtitle">Track wholesale shipments, outstanding invoices, and revenue metrics.</p>
        </div>
        <div style={{display: 'flex', gap: '12px'}}>
          <button className="btn btn-outline" onClick={() => alert('Export functionality coming soon!')}>
            <DownloadSimple style={{marginRight: '8px'}} /> Export Report
          </button>
          <button className="btn btn-primary" onClick={() => setSaleModalOpen(true)}>
            <Plus style={{marginRight: '8px'}} /> Log Sale
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Transactions</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span className="status-badge status-normal" style={{ fontSize: '0.8rem' }}>
              {sales.length} Total Records
            </span>
          </div>
        </div>
        
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Product Item</th>
                <th>Volume (Cartons)</th>
                <th>Total Value</th>
                <th>Date</th>
                <th>Status</th>
                <th>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center text-muted" style={{ padding: '32px' }}>
                    No sales recorded yet. Click 'Log Sale' to create your first invoice!
                  </td>
                </tr>
              ) : (
                sales.map(s => {
                  const product = products.find(p => p.product_id === s.product_id);
                  const pName = product ? product.name : 'Unknown Product';
                  const amount = s.quantity_sold * (product ? product.price : 0);
                  const dateStr = new Date(s.date || s.created_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric'
                  });

                  return (
                    <tr key={s.sale_id}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        #{s.sale_id.substring(0, 8).toUpperCase()}
                      </td>
                      <td style={{ fontWeight: 600 }}>{pName}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <TrendUp className="text-purple" />
                          {s.quantity_sold} Cartons
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        ₹{amount.toLocaleString()}
                      </td>
                      <td className="text-muted">{dateStr}</td>
                      <td>
                        <span className="status-badge status-normal">Completed</span>
                      </td>
                      <td>
                        <button className="icon-btn-small" title="Download Invoice">
                          <FileText />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Sale Modal */}
      {isSaleModalOpen && (
        <div className="modal active">
          <div className="modal-content">
            <span className="close-modal" onClick={() => setSaleModalOpen(false)}>&times;</span>
            <h2 className="modal-title">Record B2B Sale</h2>
            <form onSubmit={handleLogSale}>
              <div className="form-group">
                <label className="form-label">Select Product Lot</label>
                <select className="form-input" required value={saleForm.product_id} onChange={e => setSaleForm({...saleForm, product_id: e.target.value})}>
                  <option value="">Choose a product...</option>
                  {products.map(p => (
                    <option key={p.product_id} value={p.product_id}>{p.name} (Stock: {p.current_stock})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity Sold (Cartons)</label>
                <input type="number" min="1" className="form-input" required value={saleForm.quantity_sold} onChange={e => setSaleForm({...saleForm, quantity_sold: e.target.value})} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => setSaleModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Log Sale</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;

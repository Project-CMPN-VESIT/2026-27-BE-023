import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserCheck, FileText, Plus, Truck, DownloadSimple, Trash } from '@phosphor-icons/react';

const API_BASE = 'http://localhost:5000/api';

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [isPoModalOpen, setPoModalOpen] = useState(false);
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [poForm, setPoForm] = useState({
    supplier_id: '',
    product_id: '',
    quantity: '',
    new_product_name: '',
    new_product_cost: '',
    new_product_selling: '',
    new_product_category: '',
    new_product_barcode: '',
    new_product_description: '',
    new_product_brand: ''
  });
  const [selectedPoForPdf, setSelectedPoForPdf] = useState(null);
  const [isSupplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [loading, setLoading] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState(null);

  const fetchData = async () => {
    try {
      const [sRes, poRes, pRes] = await Promise.all([
        axios.get(`${API_BASE}/suppliers`),
        axios.get(`${API_BASE}/purchase-orders`),
        axios.get(`${API_BASE}/products`)
      ]);
      setSuppliers(sRes.data);
      setPurchaseOrders(poRes.data);
      setProducts(pRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();

    window.addEventListener('inventai_brand_changed', fetchData);
    return () => {
      window.removeEventListener('inventai_brand_changed', fetchData);
    };
  }, []);

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/suppliers`, supplierForm);
      setSupplierModalOpen(false);
      setSupplierForm({ name: '', email: '', phone: '', address: '' });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to register vendor.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (supplier) => {
    setSupplierToDelete(supplier);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!supplierToDelete) return;
    setLoading(true);
    try {
      await axios.delete(`${API_BASE}/suppliers/${supplierToDelete.id}`);
      setDeleteModalOpen(false);
      setSupplierToDelete(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to delete supplier.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePo = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        supplier_id: poForm.supplier_id,
        quantity: Number(poForm.quantity)
      };

      if (isNewProduct) {
        payload.product_id = 'NEW_PRODUCT';
        payload.product_name = poForm.new_product_name;
        payload.cost_price = Number(poForm.new_product_cost);
        payload.selling_price = Number(poForm.new_product_selling);
        payload.category = poForm.new_product_category;
        payload.barcode = poForm.new_product_barcode;
        payload.description = poForm.new_product_description;
        payload.brand_name = poForm.new_product_brand;
      } else {
        payload.product_id = poForm.product_id;
      }

      await axios.post(`${API_BASE}/purchase-orders`, payload);
      
      setPoModalOpen(false);
      setIsNewProduct(false);
      setPoForm({
        supplier_id: '',
        product_id: '',
        quantity: '',
        new_product_name: '',
        new_product_cost: '',
        new_product_selling: '',
        new_product_category: '',
        new_product_barcode: '',
        new_product_description: '',
        new_product_brand: ''
      });
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to draft B2B Purchase Order.');
    } finally {
      setLoading(false);
    }
  };

  const updatePoStatus = async (id, status) => {
    try {
      await axios.put(`${API_BASE}/purchase-orders/${id}`, { status });
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to update PO status.');
    }
  };

  const printPoPdf = (po) => {
    const supplier = suppliers.find(s => s.id === po.supplier_id) || {};
    const product = products.find(p => p.product_id === po.product_id) || {};
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Purchase Order ${po.po_number}</title>
          <style>
            body { font-family: 'Plus Jakarta Sans', sans-serif; padding: 40px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 40px; }
            .logo { font-size: 28px; font-weight: 800; color: #6366f1; }
            .po-title { text-align: right; }
            .po-title h1 { margin: 0; font-size: 24px; color: #0f172a; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .info-block h3 { margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #64748b; }
            .info-block p { margin: 4px 0; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background-color: #f8fafc; font-weight: 600; color: #64748b; }
            .totals { text-align: right; font-size: 18px; font-weight: 700; color: #0f172a; }
            .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 80px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            @media print {
              .print-btn { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">InventAI Supply Portal</div>
            <div class="po-title">
              <h1>PURCHASE ORDER</h1>
              <p style="margin: 4px 0; color: #64748b;">${po.po_number}</p>
            </div>
          </div>
          <div class="info-grid">
            <div class="info-block">
              <h3>Vendor Detail</h3>
              <p><strong>${supplier.name || 'N/A'}</strong></p>
              <p>${supplier.address || 'N/A'}</p>
              <p>Email: ${supplier.email || 'N/A'}</p>
              <p>Phone: ${supplier.phone || 'N/A'}</p>
            </div>
            <div class="info-block" style="text-align: right;">
              <h3>Ship To</h3>
              <p><strong>InventAI Central Warehouse</strong></p>
              <p>Sector-5 B2B Hub, Bandra-Kurla</p>
              <p>Mumbai, MH - 400051</p>
              <p>Date: ${new Date(po.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Stock Lot SKU</th>
                <th>Quantity Ordered</th>
                <th>Unit Cost</th>
                <th>Estimated Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${po.product_name || product.name || 'N/A'}</td>
                <td>${po.quantity} cartons</td>
                <td>₹${(po.cost_price || product.original_price || product.price || 0).toLocaleString()}</td>
                <td>₹${((po.cost_price || product.original_price || product.price || 0) * po.quantity).toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          <div class="totals">
            Estimated PO Total: ₹${((po.cost_price || product.original_price || product.price || 0) * po.quantity).toLocaleString()}
          </div>
          <button class="print-btn" onclick="window.print()" style="padding: 10px 20px; background-color: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold; margin-top: 20px;">
            Print / Save to PDF
          </button>
          <div class="footer">
            Authorized procurement order. Generated by InventAI B2B automation tools.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="view-section active">
      <div className="dashboard-header">
        <div>
          <h2 className="page-title">Supplier Profiles & Purchase Orders</h2>
          <p className="page-subtitle">Draft vendor orders, track procurement lines, and restock automatically.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-outline" onClick={() => setSupplierModalOpen(true)}>
            <Plus style={{ marginRight: '8px' }} /> Register Vendor
          </button>
          <button className="btn btn-primary" onClick={() => setPoModalOpen(true)}>
            <Plus style={{ marginRight: '8px' }} /> Draft Purchase Order (PO)
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '28px' }}>
        {/* Supplier Profiles */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><UserCheck /> Supplier Register</h3>
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {suppliers.length === 0 ? (
              <p className="text-muted">No suppliers registered.</p>
            ) : (
              suppliers.map(s => (
                <div key={s.id} style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontWeight: 700, margin: '0 0 4px 0' }}>{s.name}</h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>📧 {s.email}</p>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>📞 {s.phone}</p>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-light)', marginTop: '4px' }}>📍 {s.address}</p>
                  </div>
                  <button 
                    className="btn btn-outline" 
                    style={{ padding: '6px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)', minWidth: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                    onClick={() => handleDeleteClick(s)}
                    title="Delete Supplier"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Purchase Orders Table */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><FileText /> B2B Purchase Order Line</h3>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Vendor</th>
                  <th>Product</th>
                  <th>Order Lot</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-muted" style={{ padding: '32px' }}>
                      No purchase orders drafted yet.
                    </td>
                  </tr>
                ) : (
                  purchaseOrders.map(po => {
                    const sup = suppliers.find(s => s.id === po.supplier_id);
                    const prod = products.find(p => p.product_id === po.product_id);
                    
                    return (
                      <tr key={po.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{po.po_number}</td>
                        <td>{sup ? sup.name : 'Unknown Vendor'}</td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{po.product_name || (prod ? prod.name : 'Unknown Product')}</div>
                          {!po.product_id ? (
                            <span className="status-badge status-high" style={{ fontSize: '0.62rem', padding: '1px 6px', marginTop: '4px', display: 'inline-block', textTransform: 'uppercase', fontWeight: 800 }}>
                              ✨ Auto-Create
                            </span>
                          ) : (
                            <span className="status-badge status-normal" style={{ fontSize: '0.62rem', padding: '1px 6px', marginTop: '4px', display: 'inline-block', textTransform: 'uppercase', fontWeight: 800 }}>
                              🔄 Restock
                            </span>
                          )}
                        </td>
                        <td>{po.quantity} cartons</td>
                        <td>
                          <span className={`status-badge ${
                            po.status === 'Draft' ? 'status-low' : 
                            po.status === 'Sent' ? 'status-normal' : 'status-high'
                          }`}>
                            {po.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {po.status === 'Draft' && (
                              <button className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => updatePoStatus(po.id, 'Sent')}>
                                📤 Send
                              </button>
                            )}
                            {po.status === 'Sent' && (
                              <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => updatePoStatus(po.id, 'Received')}>
                                📥 Receive
                              </button>
                            )}
                            <button className="btn btn-outline" style={{ padding: '4px', fontSize: '1rem', display: 'flex', alignItems: 'center' }} onClick={() => printPoPdf(po)} title="Export Invoice">
                              <DownloadSimple />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Supplier Register Modal */}
      {isSupplierModalOpen && (
        <div className="modal active">
          <div className="modal-content">
            <span className="close-modal" onClick={() => setSupplierModalOpen(false)}>&times;</span>
            <h2 className="modal-title">Register Supplier Vendor</h2>
            <form onSubmit={handleCreateSupplier}>
              <div className="form-group">
                <label className="form-label">Vendor Corporate Name</label>
                <input type="text" className="form-input" required value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} />
              </div>
              <div className="form-group" style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Contact Email</label>
                  <input type="email" className="form-input" required value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Contact Phone</label>
                  <input type="text" className="form-input" required value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Office Address</label>
                <input type="text" className="form-input" required value={supplierForm.address} onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => setSupplierModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Registering...' : 'Save Profile'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Draft PO Modal */}
      {isPoModalOpen && (
        <div className="modal active">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <span className="close-modal" onClick={() => {
              setPoModalOpen(false);
              setIsNewProduct(false);
              setPoForm({
                supplier_id: '',
                product_id: '',
                quantity: '',
                new_product_name: '',
                new_product_cost: '',
                new_product_selling: '',
                new_product_category: '',
                new_product_barcode: '',
                new_product_description: '',
                new_product_brand: ''
              });
            }}>&times;</span>
            <h2 className="modal-title">Draft New B2B Purchase Order</h2>
            <form onSubmit={handleCreatePo}>
              <div className="form-group">
                <label className="form-label">Select Registered Vendor</label>
                <select className="form-input" required value={poForm.supplier_id} onChange={e => setPoForm({ ...poForm, supplier_id: e.target.value })}>
                  <option value="">Choose Supplier...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="checkbox-container" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, color: 'var(--primary)' }}>
                  <input 
                    type="checkbox" 
                    checked={isNewProduct} 
                    onChange={e => {
                      setIsNewProduct(e.target.checked);
                      setPoForm(prev => ({ ...prev, product_id: e.target.checked ? '' : prev.product_id }));
                    }}
                    style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                  />
                  ➕ Unregistered / New Product (Auto-register in inventory on receipt)
                </label>
              </div>

              {!isNewProduct ? (
                <div className="form-group">
                  <label className="form-label">Select Stock Carton Lot</label>
                  <select className="form-input" required value={poForm.product_id} onChange={e => setPoForm({ ...poForm, product_id: e.target.value })}>
                    <option value="">Choose Item...</option>
                    {products.map(p => (
                      <option key={p.product_id} value={p.product_id}>{p.name} (Stock: {p.current_stock} cartons | SKU: {p.product_id})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ borderLeft: '3px solid var(--primary)', paddingLeft: '16px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h4 style={{ margin: '0 0 4px 0', color: 'var(--text-main)', fontSize: '0.92rem' }}>New Product Initial Parameters</h4>
                  
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Product Name *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Heavy Cotton Jogger" 
                      required={isNewProduct} 
                      value={poForm.new_product_name} 
                      onChange={e => setPoForm({ ...poForm, new_product_name: e.target.value })} 
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                      <label className="form-label">Cost Price * (₹)</label>
                      <input 
                        type="number" 
                        min="1" 
                        className="form-input" 
                        placeholder="Cost price" 
                        required={isNewProduct} 
                        value={poForm.new_product_cost} 
                        onChange={e => setPoForm({ ...poForm, new_product_cost: e.target.value })} 
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                      <label className="form-label">Selling Price * (₹)</label>
                      <input 
                        type="number" 
                        min="1" 
                        className="form-input" 
                        placeholder="Selling price" 
                        required={isNewProduct} 
                        value={poForm.new_product_selling} 
                        onChange={e => setPoForm({ ...poForm, new_product_selling: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                      <label className="form-label">Category (Blank for auto-detect)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. Bottomwear, Accessories" 
                        value={poForm.new_product_category} 
                        onChange={e => setPoForm({ ...poForm, new_product_category: e.target.value })} 
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                      <label className="form-label">Brand Context (Blank for active)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. Apparel & Fashion" 
                        value={poForm.new_product_brand} 
                        onChange={e => setPoForm({ ...poForm, new_product_brand: e.target.value })} 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                      <label className="form-label">Custom Barcode (Optional)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Auto-generated EAN-13 if blank" 
                        value={poForm.new_product_barcode} 
                        onChange={e => setPoForm({ ...poForm, new_product_barcode: e.target.value })} 
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1, margin: 0 }}>
                      <label className="form-label">Description (Optional)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Garment details..." 
                        value={poForm.new_product_description} 
                        onChange={e => setPoForm({ ...poForm, new_product_description: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Quantity to Order (Cartons)</label>
                <input type="number" min="1" className="form-input" required value={poForm.quantity} onChange={e => setPoForm({ ...poForm, quantity: e.target.value })} />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => {
                  setPoModalOpen(false);
                  setIsNewProduct(false);
                  setPoForm({
                    supplier_id: '',
                    product_id: '',
                    quantity: '',
                    new_product_name: '',
                    new_product_cost: '',
                    new_product_selling: '',
                    new_product_category: '',
                    new_product_barcode: '',
                    new_product_description: '',
                    new_product_brand: ''
                  });
                }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Drafting...' : 'Draft PO'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Deletion Confirmation Modal */}
      {isDeleteModalOpen && supplierToDelete && (
        <div className="modal active">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <span className="close-modal" onClick={() => { setDeleteModalOpen(false); setSupplierToDelete(null); }}>&times;</span>
            <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Remove Supplier</h2>
            <div style={{ margin: '20px 0', fontSize: '0.9rem', lineHeight: '1.5' }}>
              <p style={{ color: 'var(--text-main)', marginBottom: '16px' }}>
                Are you sure you want to permanently remove <strong>{supplierToDelete.name}</strong>?
              </p>
              <div style={{ 
                padding: '12px 16px', 
                borderRadius: '8px', 
                background: 'rgba(239, 68, 68, 0.1)', 
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                fontSize: '0.82rem'
              }}>
                <span style={{ fontWeight: 700, display: 'block', marginBottom: '6px' }}>⚠️ SYSTEM IMPACT NOTICE:</span>
                <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: '1.4' }}>
                  <li>All associated Purchase Orders will be deleted permanently.</li>
                  <li>Linked products will have their supplier references set to empty.</li>
                </ul>
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-outline" onClick={() => { setDeleteModalOpen(false); setSupplierToDelete(null); }}>Cancel</button>
              <button type="button" className="btn btn-danger" disabled={loading} onClick={handleConfirmDelete}>{loading ? 'Removing...' : 'Confirm Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;

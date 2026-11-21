import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Package, Plus, WarningCircle, CheckCircle, Barcode, Printer, 
  ArrowsLeftRight, ClockCounterClockwise, PlusCircle, MinusCircle, Tag, Eye
} from '@phosphor-icons/react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

const API_BASE = 'http://localhost:5000/api';

// --- Vector/Canvas Barcode Renderer Component ---
const BarcodeRenderer = ({ value, format = 'CODE128', width = 2, height = 50, displayValue = true }) => {
  const svgRef = useRef(null);
  const qrCanvasRef = useRef(null);

  useEffect(() => {
    if (!value) return;

    if (format === 'QR') {
      if (qrCanvasRef.current) {
        QRCode.toCanvas(qrCanvasRef.current, value, {
          width: 120,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        }, (err) => {
          if (err) console.error('QR code generation failed', err);
        });
      }
    } else {
      try {
        let finalFormat = format;
        if (format === 'EAN13') {
          const isNumeric = /^\d+$/.test(value);
          if (!isNumeric || value.length < 12 || value.length > 13) {
            // Fallback to Code 128 if EAN-13 format is incompatible
            finalFormat = 'CODE128';
          }
        }

        if (svgRef.current) {
          JsBarcode(svgRef.current, value, {
            format: finalFormat,
            width: width,
            height: height,
            displayValue: displayValue,
            margin: 10,
            background: '#ffffff',
            lineColor: '#000000',
            fontSize: 12
          });
        }
      } catch (err) {
        console.error('Barcode rendering failed', err);
      }
    }
  }, [value, format, width, height, displayValue]);

  if (format === 'QR') {
    return (
      <div style={{ background: '#ffffff', padding: '10px', borderRadius: '8px', display: 'inline-block', border: '1px solid var(--border-light)' }}>
        <canvas ref={qrCanvasRef}></canvas>
      </div>
    );
  }

  const isEanCompatible = format === 'EAN13' && /^\d+$/.test(value) && (value.length === 12 || value.length === 13);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ background: '#ffffff', padding: '5px', borderRadius: '8px', display: 'inline-block', border: '1px solid var(--border-light)' }}>
        <svg ref={svgRef} style={{ maxWidth: '100%', height: 'auto' }}></svg>
      </div>
      {format === 'EAN13' && !isEanCompatible && (
        <span style={{ fontSize: '0.72rem', color: 'var(--warning)', marginTop: '6px', textAlign: 'center', fontWeight: 600 }}>
          ⚠️ Text contains letters. Fallback to Code 128 rendered.
        </span>
      )}
    </div>
  );
};

const Products = ({ user }) => {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [prodForm, setProdForm] = useState({ 
    name: '', category: '', price: '', current_stock: '', threshold: '', warehouse_location: '', barcode: '', autoBarcode: true 
  });
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editProdForm, setEditProdForm] = useState(null);

  // Selected Product Detail Drawer States
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [barcodeFormat, setBarcodeFormat] = useState('CODE128');
  const [actionTab, setActionTab] = useState('view'); // 'view', 'receive', 'dispatch', 'transfer', 'logs'
  const [actionQty, setActionQty] = useState('');
  const [transferWarehouse, setTransferWarehouse] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [productLogs, setProductLogs] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [pRes, wRes] = await Promise.all([
        axios.get(`${API_BASE}/products`),
        axios.get(`${API_BASE}/warehouses`)
      ]);
      setProducts(pRes.data);
      setWarehouses(wRes.data);
    } catch (err) {
      console.error("Failed to fetch catalog data", err);
    }
  };

  const fetchLogs = async (productId) => {
    try {
      const res = await axios.get(`${API_BASE}/barcode-logs`);
      const filtered = res.data.filter(l => l.product_id === productId);
      setProductLogs(filtered);
    } catch (err) {
      console.error('Failed to retrieve barcode action logs:', err);
    }
  };

  useEffect(() => {
    fetchData();

    window.addEventListener('inventai_brand_changed', () => {
      fetchData();
      setSelectedProduct(null);
    });
    return () => {
      window.removeEventListener('inventai_brand_changed', fetchData);
    };
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      fetchLogs(selectedProduct.product_id);
    }
  }, [selectedProduct]);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...prodForm,
        price: Number(prodForm.price),
        current_stock: Number(prodForm.current_stock),
        threshold: Number(prodForm.threshold),
        barcode: prodForm.autoBarcode ? '' : prodForm.barcode
      };
      delete payload.autoBarcode;

      await axios.post(`${API_BASE}/products`, payload);
      setProductModalOpen(false);
      setProdForm({ name: '', category: '', price: '', current_stock: '', threshold: '', warehouse_location: '', barcode: '', autoBarcode: true });
      fetchData();
      alert('📦 Product added successfully!');
    } catch (err) { 
      console.error(err); 
      alert(err.response?.data?.message || 'Failed to save product.');
    }
  };

  const openEditModal = (e, product) => {
    e.stopPropagation();
    setEditProdForm(product);
    setEditModalOpen(true);
  };

  const handleEditProduct = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_BASE}/products/${editProdForm.product_id}`, {
        name: editProdForm.name,
        category: editProdForm.category,
        price: Number(editProdForm.price),
        current_stock: Number(editProdForm.current_stock),
        threshold: Number(editProdForm.threshold),
        warehouse_location: editProdForm.warehouse_location,
        barcode: editProdForm.barcode
      });
      setEditModalOpen(false);
      
      // Update drawer if current details are open
      if (selectedProduct && selectedProduct.product_id === editProdForm.product_id) {
        setSelectedProduct({
          ...selectedProduct,
          name: editProdForm.name,
          category: editProdForm.category,
          price: Number(editProdForm.price),
          current_stock: Number(editProdForm.current_stock),
          threshold: Number(editProdForm.threshold),
          warehouse_location: editProdForm.warehouse_location,
          barcode: editProdForm.barcode
        });
      }

      setEditProdForm(null);
      fetchData();
      alert('✅ Details updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update product details.');
    }
  };

  // Bulk generate EAN-13 barcodes
  const handleBulkGenerate = async () => {
    setBulkLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/products/barcode/bulk-generate`);
      alert(`⚡️ ${res.data.message}`);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Bulk generation failed.');
    } finally {
      setBulkLoading(false);
    }
  };

  // Single label thermal print routine
  const handlePrintLabel = (product, format) => {
    const printWindow = window.open('', '_blank', 'width=600,height=400');
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Label - ${product.name}</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              margin: 0;
              padding: 15px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              background: #ffffff;
              color: #000000;
            }
            .label-container {
              border: 1px solid #000000;
              padding: 15px;
              border-radius: 8px;
              width: 3.5in;
              height: 2.2in;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              box-sizing: border-box;
            }
            .title {
              font-size: 14px;
              font-weight: bold;
              margin: 0 0 2px 0;
              text-transform: uppercase;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              width: 100%;
            }
            .sku {
              font-size: 9px;
              color: #444444;
              margin: 0 0 8px 0;
            }
            .price {
              font-size: 12px;
              font-weight: 700;
              margin: 4px 0 0 0;
            }
            .barcode-area {
              display: flex;
              justify-content: center;
              align-items: center;
              height: 60px;
              width: 100%;
              overflow: hidden;
            }
          </style>
        </head>
        <body>
          <div class="label-container">
            <div>
              <div class="title">${product.name}</div>
              <div class="sku">SKU: ${product.product_id}</div>
            </div>
            <div class="barcode-area" id="barcode-placeholder"></div>
            <div class="price">PRICE: ₹${product.price}</div>
          </div>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <script>
            const val = "${product.barcode || product.product_id}";
            const fmt = "${format}";
            const container = document.getElementById('barcode-placeholder');

            if (fmt === 'QR') {
              const canvas = document.createElement('canvas');
              container.appendChild(canvas);
              QRCode.toCanvas(canvas, val, { width: 70, margin: 1 }, function(err) {
                if (err) console.error(err);
                window.print();
                setTimeout(() => window.close(), 500);
              });
            } else {
              const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
              container.appendChild(svg);
              
              let finalFormat = fmt;
              if (fmt === 'EAN13') {
                const isNumeric = /^\\d+$/.test(val);
                if (!isNumeric || val.length < 12 || val.length > 13) {
                  finalFormat = 'CODE128';
                }
              }

              try {
                JsBarcode(svg, val, {
                  format: finalFormat,
                  width: 1.5,
                  height: 38,
                  displayValue: true,
                  fontSize: 10,
                  margin: 2
                });
                window.print();
                setTimeout(() => window.close(), 500);
              } catch(e) {
                console.error(e);
              }
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Perform Receive/Dispatch/Transfer actions via Barcode Endpoint
  const handleBarcodeAction = async (e) => {
    e.preventDefault();
    if (!actionQty && actionTab !== 'transfer') {
      alert('Please specify a valid quantity.');
      return;
    }
    if (actionTab === 'transfer' && !transferWarehouse) {
      alert('Please select a destination warehouse.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/products/barcode/action`, {
        product_id: selectedProduct.product_id,
        action_type: actionTab,
        quantity: Number(actionQty),
        destination_warehouse: transferWarehouse,
        username: user ? user.username : 'Admin'
      });

      // Update local state dynamically
      setSelectedProduct(res.data.product);
      setActionQty('');
      setTransferWarehouse('');
      fetchData();
      fetchLogs(selectedProduct.product_id);

      alert(`✅ Stock transaction complete: ${res.data.log.details}`);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Stock modification failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const unassignedCount = products.filter(p => !p.barcode).length;

  return (
    <div className="view-section active">
      {/* Page Header */}
      <div className="dashboard-header">
        <div>
          <h2 className="page-title">Wholesale Product Catalog</h2>
          <p className="page-subtitle">Manage your SKUs, pricing tiers, warehouses, and unique product barcodes.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {unassignedCount > 0 && (
            <button 
              className={`btn btn-outline`} 
              disabled={bulkLoading} 
              onClick={handleBulkGenerate}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)', borderColor: 'rgba(245, 158, 11, 0.3)' }}
            >
              <Barcode />
              {bulkLoading ? 'Generating...' : `Bulk Generate Barcodes (${unassignedCount})`}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setProductModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus /> Add New Lot
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '20px' }}>
        {products.length === 0 ? (
          <div className="card p-6" style={{ padding: '32px', gridColumn: '1 / -1', textAlign: 'center' }}>
            <Package size={48} className="text-muted" style={{ margin: '0 auto 16px auto' }} />
            <p className="text-muted">No products in your catalog yet. Click 'Add New Lot' to get started!</p>
          </div>
        ) : (
          products.map(p => {
            const isLowStock = p.current_stock < p.threshold;
            
            return (
              <div 
                key={p.product_id} 
                className="card p-6 product-lot-card" 
                onClick={() => { setSelectedProduct(p); setActionTab('view'); }}
                style={{ 
                  padding: '24px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className="product-img bg-gray" style={{ width: '48px', height: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px', borderRadius: '12px', color: 'var(--primary)' }}>
                      <Package weight="fill" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {p.name}
                        {p.created_via_po && (
                          <span className="status-badge status-high" style={{ fontSize: '0.58rem', padding: '1px 6px', textTransform: 'uppercase', fontWeight: 800, borderRadius: '4px' }} title="Automatically created via B2B Purchase Order restock">
                            📦 PO Auto
                          </span>
                        )}
                      </h3>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', backgroundColor: 'var(--border-light)', padding: '2px 8px', borderRadius: '99px' }}>{p.category}</span>
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)', padding: '16px 0', margin: 'auto 0 16px 0' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Price</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>₹{p.price.toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Stock</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: isLowStock ? 'var(--danger)' : 'var(--success)' }}>
                      {p.current_stock}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {isLowStock ? (
                    <span className="status-badge status-low" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <WarningCircle weight="fill" /> Low Stock
                    </span>
                  ) : (
                    <span className="status-badge status-normal" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle weight="fill" /> Healthy
                    </span>
                  )}
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {p.barcode && <Barcode size={20} className="text-gradient" weight="fill" title={`Barcode: ${p.barcode}`} />}
                    <button className="btn btn-outline" onClick={(e) => openEditModal(e, p)} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>Edit</button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add Product Modal */}
      {isProductModalOpen && (
        <div className="modal active">
          <div className="modal-content glass-card" style={{ maxWidth: '500px' }}>
            <span className="close-modal" onClick={() => setProductModalOpen(false)}>&times;</span>
            <h2 className="modal-title">Add New Product Lot</h2>
            <form onSubmit={handleAddProduct}>
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input type="text" className="form-input" required value={prodForm.name} onChange={e => setProdForm({...prodForm, name: e.target.value})} />
              </div>
              
              <div className="form-group">
                <label className="form-label">Category</label>
                <input type="text" className="form-input" required value={prodForm.category} onChange={e => setProdForm({...prodForm, category: e.target.value})} />
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Price (₹)</label>
                  <input type="number" className="form-input" required value={prodForm.price} onChange={e => setProdForm({...prodForm, price: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Initial Stock</label>
                  <input type="number" className="form-input" required value={prodForm.current_stock} onChange={e => setProdForm({...prodForm, current_stock: e.target.value})} />
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Low Stock Threshold</label>
                  <input type="number" className="form-input" required value={prodForm.threshold} onChange={e => setProdForm({...prodForm, threshold: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Warehouse Facility</label>
                  <select 
                    className="form-input" 
                    required 
                    value={prodForm.warehouse_location} 
                    onChange={e => setProdForm({ ...prodForm, warehouse_location: e.target.value })}
                  >
                    <option value="">Select Warehouse...</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Product Barcode</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={prodForm.autoBarcode} 
                      onChange={e => setProdForm({ ...prodForm, autoBarcode: e.target.checked })} 
                    />
                    <span>Auto-generate barcode</span>
                  </label>
                </div>
                {!prodForm.autoBarcode && (
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Scan or type numeric EAN-13 or Code 128 SKU..." 
                    value={prodForm.barcode} 
                    onChange={e => setProdForm({ ...prodForm, barcode: e.target.value })} 
                  />
                )}
              </div>

              <div className="form-actions" style={{ marginTop: '24px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setProductModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {isEditModalOpen && editProdForm && (
        <div className="modal active">
          <div className="modal-content glass-card" style={{ maxWidth: '500px' }}>
            <span className="close-modal" onClick={() => setEditModalOpen(false)}>&times;</span>
            <h2 className="modal-title">Edit Product Lot</h2>
            <form onSubmit={handleEditProduct}>
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input type="text" className="form-input" required value={editProdForm.name} onChange={e => setEditProdForm({...editProdForm, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <input type="text" className="form-input" required value={editProdForm.category} onChange={e => setEditProdForm({...editProdForm, category: e.target.value})} />
              </div>
              <div className="form-group" style={{display:'flex', gap:'16px'}}>
                <div style={{flex:1}}>
                  <label className="form-label">Price (₹)</label>
                  <input type="number" className="form-input" required value={editProdForm.price} onChange={e => setEditProdForm({...editProdForm, price: e.target.value})} />
                </div>
                <div style={{flex:1}}>
                  <label className="form-label">Current Stock</label>
                  <input type="number" className="form-input" required value={editProdForm.current_stock} onChange={e => setEditProdForm({...editProdForm, current_stock: e.target.value})} />
                </div>
              </div>
              <div className="form-group" style={{display:'flex', gap:'16px'}}>
                <div style={{flex:1}}>
                  <label className="form-label">Low Stock Threshold</label>
                  <input type="number" className="form-input" required value={editProdForm.threshold} onChange={e => setEditProdForm({...editProdForm, threshold: e.target.value})} />
                </div>
                <div style={{flex:1}}>
                  <label className="form-label">Warehouse Storage Facility</label>
                  <select 
                    className="form-input" 
                    required 
                    value={editProdForm.warehouse_location} 
                    onChange={e => setEditProdForm({ ...editProdForm, warehouse_location: e.target.value })}
                  >
                    <option value="">Select Warehouse...</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.name}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Barcode Value</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editProdForm.barcode || ''} 
                  onChange={e => setEditProdForm({...editProdForm, barcode: e.target.value})} 
                  placeholder="No barcode assigned"
                />
              </div>
              <div className="form-actions" style={{ marginTop: '24px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setEditModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Details</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected Product Slide-Out Detail Drawer Panel */}
      {selectedProduct && (
        <div className="slide-drawer-overlay active" onClick={() => setSelectedProduct(null)}>
          <div className="slide-drawer glass-card" onClick={e => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="drawer-header">
              <div>
                <h3 className="drawer-title">{selectedProduct.name}</h3>
                <span className="drawer-subtitle">SKU / ID: {selectedProduct.product_id}</span>
              </div>
              <span className="close-drawer" onClick={() => setSelectedProduct(null)}>&times;</span>
            </div>

            {/* Tabbed Action Toggles */}
            <div className="drawer-tabs">
              <button 
                className={`drawer-tab ${actionTab === 'view' ? 'active' : ''}`}
                onClick={() => setActionTab('view')}
              >
                <Eye size={18} /> Details
              </button>
              <button 
                className={`drawer-tab ${actionTab === 'receive' ? 'active' : ''}`}
                onClick={() => setActionTab('receive')}
              >
                <PlusCircle size={18} /> Receive
              </button>
              <button 
                className={`drawer-tab ${actionTab === 'dispatch' ? 'active' : ''}`}
                onClick={() => setActionTab('dispatch')}
              >
                <MinusCircle size={18} /> Dispatch
              </button>
              <button 
                className={`drawer-tab ${actionTab === 'transfer' ? 'active' : ''}`}
                onClick={() => setActionTab('transfer')}
              >
                <ArrowsLeftRight size={18} /> Transfer
              </button>
              <button 
                className={`drawer-tab ${actionTab === 'logs' ? 'active' : ''}`}
                onClick={() => setActionTab('logs')}
              >
                <ClockCounterClockwise size={18} /> Logs
              </button>
            </div>

            {/* Tab Contents */}
            <div className="drawer-body">
              {/* Tab 1: View Details & Barcode Rendering */}
              {actionTab === 'view' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Stock Level Card */}
                  <div className="detail-stat-row">
                    <div className="detail-stat-card">
                      <span className="stat-title">Current Stock</span>
                      <span className={`stat-val ${selectedProduct.current_stock < selectedProduct.threshold ? 'danger' : 'success'}`}>
                        {selectedProduct.current_stock} cartons
                      </span>
                    </div>
                    <div className="detail-stat-card">
                      <span className="stat-title">Warehouse Location</span>
                      <span className="stat-val-text">{selectedProduct.warehouse_location}</span>
                    </div>
                  </div>

                  <div className="detail-stat-row">
                    <div className="detail-stat-card">
                      <span className="stat-title">Wholesale Price</span>
                      <span className="stat-val-text">₹{selectedProduct.price.toLocaleString()}</span>
                    </div>
                    <div className="detail-stat-card">
                      <span className="stat-title">Category Layer</span>
                      <span className="stat-val-text">{selectedProduct.category}</span>
                    </div>
                  </div>

                  {/* Interactive Barcode Widget */}
                  {selectedProduct.barcode ? (
                    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                          🏷️ Barcode Preview
                        </span>
                        
                        {/* Selector formats */}
                        <select 
                          className="form-input" 
                          style={{ width: 'auto', padding: '4px 8px', fontSize: '0.78rem', height: 'auto' }}
                          value={barcodeFormat}
                          onChange={e => setBarcodeFormat(e.target.value)}
                        >
                          <option value="CODE128">Code 128 (Default)</option>
                          <option value="EAN13">EAN-13 (Numeric)</option>
                          <option value="QR">QR Code</option>
                        </select>
                      </div>

                      {/* Vector Representation */}
                      <BarcodeRenderer value={selectedProduct.barcode} format={barcodeFormat} />

                      <div style={{ width: '100%', display: 'flex', gap: '12px', borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginTop: '4px' }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>BARCODE VALUE</span>
                          <code style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.05em' }}>
                            {selectedProduct.barcode}
                          </code>
                        </div>
                        <button 
                          className="btn btn-outline"
                          onClick={() => handlePrintLabel(selectedProduct, barcodeFormat)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px' }}
                        >
                          <Printer /> Print Label
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="card text-center" style={{ padding: '24px', color: 'var(--text-muted)' }}>
                      <Barcode size={36} style={{ margin: '0 auto 8px auto', color: 'var(--border)' }} />
                      <p style={{ fontSize: '0.85rem', margin: 0 }}>No barcode assigned to this product.</p>
                      <button 
                        className="btn btn-primary" 
                        style={{ marginTop: '12px', width: '100%', fontSize: '0.8rem', padding: '6px 12px' }}
                        onClick={(e) => openEditModal(e, selectedProduct)}
                      >
                        Assign Barcode SKU
                      </button>
                    </div>
                  )}

                  <button 
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={(e) => openEditModal(e, selectedProduct)}
                  >
                    Edit Product Parameters
                  </button>
                </div>
              )}

              {/* Tab 2: Receive Stock */}
              {actionTab === 'receive' && (
                <form onSubmit={handleBarcodeAction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="card" style={{ padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: 'var(--success)' }}>📥 Receive Stock Addition</h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      Add carton items into the active lot. This transaction increments the stock level and registers an audit row in the ledger.
                    </p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Carton Quantity to Receive</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      required 
                      min="1"
                      placeholder="e.g. 24" 
                      value={actionQty}
                      onChange={e => setActionQty(e.target.value)}
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={actionLoading}
                    style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                  >
                    {actionLoading ? 'Saving Transaction...' : '✓ Complete Receipt'}
                  </button>
                </form>
              )}

              {/* Tab 3: Dispatch Stock */}
              {actionTab === 'dispatch' && (
                <form onSubmit={handleBarcodeAction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="card" style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: 'var(--danger)' }}>📤 Dispatch / Sell Stock</h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      Subtract carton lots for wholesale orders or dispatches. System will reject requests exceeding the currently available stock of <strong>{selectedProduct.current_stock}</strong>.
                    </p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quantity to Dispatch</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      required 
                      min="1"
                      placeholder="e.g. 10" 
                      value={actionQty}
                      onChange={e => setActionQty(e.target.value)}
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="btn" 
                    disabled={actionLoading}
                    style={{ 
                      width: '100%', 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      gap: '8px',
                      background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                      color: '#ffffff',
                      border: 'none'
                    }}
                  >
                    {actionLoading ? 'Saving Transaction...' : '✓ Complete Dispatch'}
                  </button>
                </form>
              )}

              {/* Tab 4: Location Transfer */}
              {actionTab === 'transfer' && (
                <form onSubmit={handleBarcodeAction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="card" style={{ padding: '16px', backgroundColor: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: 'var(--primary)' }}>🏢 Warehouse Transfer</h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      Relocate this product lot from the currently assigned storage <strong>"{selectedProduct.warehouse_location}"</strong> to a new registered facility.
                    </p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Destination Warehouse</label>
                    <select 
                      className="form-input" 
                      required
                      value={transferWarehouse}
                      onChange={e => setTransferWarehouse(e.target.value)}
                    >
                      <option value="">Select Facility...</option>
                      {warehouses.filter(w => w.name !== selectedProduct.warehouse_location).map(w => (
                        <option key={w.id} value={w.name}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={actionLoading}
                    style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                  >
                    {actionLoading ? 'Saving Transaction...' : '✓ Execute Location Transfer'}
                  </button>
                </form>
              )}

              {/* Tab 5: Recent Product Activity Logs */}
              {actionTab === 'logs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    📋 Scan Transaction Ledger
                  </span>

                  {productLogs.length === 0 ? (
                    <div className="text-center text-muted" style={{ padding: '24px' }}>
                      No barcode-triggered transactions logged for this product SKU yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                      {productLogs.map(l => (
                        <div key={l.id} className="card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className={`status-badge ${
                              l.action_type === 'receive' ? 'status-normal' : 
                              l.action_type === 'dispatch' ? 'status-high' : 'status-low'
                            }`} style={{ padding: '2px 8px', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 700 }}>
                              {l.action_type}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {new Date(l.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontWeight: 500, color: 'var(--text-main)' }}>{l.details}</p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.75rem', borderTop: '1px solid var(--border-light)', paddingTop: '6px', marginTop: '2px' }}>
                            <span>User: <strong>{l.username}</strong></span>
                            <span>Resulting stock: <strong>{l.resulting_stock} cartons</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Products;

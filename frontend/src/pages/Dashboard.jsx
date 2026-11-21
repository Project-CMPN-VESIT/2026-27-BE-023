import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, Title, Tooltip, Legend, ArcElement
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { 
  Plus, Tag, CurrencyDollar, WarningCircle, TrendUp, Info, Brain, DotsThree, Package, Sparkle, House
} from '@phosphor-icons/react';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, Title, Tooltip, Legend, ArcElement
);

const API_BASE = 'http://localhost:5000/api';

const Dashboard = ({ user }) => {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [isProductModalOpen, setProductModalOpen] = useState(false);
  const [isSaleModalOpen, setSaleModalOpen] = useState(false);
  const [prodForm, setProdForm] = useState({ name: '', category: '', price: '', current_stock: '', threshold: '', warehouse_location: 'Mumbai Main Warehouse' });
  const [saleForm, setSaleForm] = useState({ product_id: '', quantity_sold: '' });

  // Brand Switcher & Reseeding States
  const [activeBrand, setActiveBrand] = useState(
    localStorage.getItem('inventai_active_brand') || 'Apparel & Fashion'
  );
  const [isReseedModalOpen, setReseedModalOpen] = useState(false);
  const [pendingIndustry, setPendingIndustry] = useState('');
  const [reseeding, setReseeding] = useState(false);

  const brandToKey = {
    'Apparel & Fashion': 'apparel',
    'Electronics & Gadgets': 'electronics',
    'FMCG & Pantry': 'fmcg',
    'Pharma & Cosmetics': 'pharma',
    'Hardware & Power Tools': 'hardware'
  };

  const industryPeaks = {
    apparel: { name: 'Winter Collection', trend: 'Winter demand active' },
    electronics: { name: 'Q4 Holiday Peak', trend: 'Electronics gift buying peak' },
    fmcg: { name: 'Summer Beverages', trend: 'Fresh produce & cold drinks peak' },
    pharma: { name: 'Monsoon Wellness', trend: 'Immunity & hygiene items peak' },
    hardware: { name: 'Spring Construction', trend: 'Power tools & safety gear peak' }
  };
  
  const currentKey = brandToKey[activeBrand] || 'general';
  const activePeak = industryPeaks[currentKey] || { name: 'General Retail', trend: 'Peak Demand stable' };

  const role = user ? user.role : 'admin';

  const fetchData = async () => {
    try {
      const [pRes, sRes, prRes] = await Promise.all([
        axios.get(`${API_BASE}/products`),
        axios.get(`${API_BASE}/sales`),
        axios.get(`${API_BASE}/predictions`)
      ]);
      setProducts(pRes.data);
      setSales(sRes.data);
      setPredictions(prRes.data);
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    }
  };

  // Synchronize with global brand context switching events
  useEffect(() => {
    fetchData();

    const handleBrandChange = () => {
      setActiveBrand(localStorage.getItem('inventai_active_brand') || 'Apparel & Fashion');
      fetchData();
    };

    window.addEventListener('inventai_brand_changed', handleBrandChange);
    return () => {
      window.removeEventListener('inventai_brand_changed', handleBrandChange);
    };
  }, []);

  // Listen to WebSocket events locally to refresh cards without page reload!
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:5000');
    ws.onmessage = () => {
      fetchData(); // Hot-reload data on any stock changes!
    };
    return () => ws.close();
  }, []);

  const handleReseed = async () => {
    setReseeding(true);
    try {
      await axios.post(`${API_BASE}/industry/reseed`, { industry: pendingIndustry });
      // Trigger new forecast calculation for the new dataset
      await axios.post(`${API_BASE}/trigger-prediction`);
      await fetchData();
      setReseedModalOpen(false);
    } catch (err) {
      console.error("Failed to reseed database", err);
      alert("Failed to reseed database with new industry context.");
    } finally {
      setReseeding(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/products`, {
        ...prodForm,
        price: Number(prodForm.price),
        current_stock: Number(prodForm.current_stock),
        threshold: Number(prodForm.threshold)
      });
      setProductModalOpen(false);
      setProdForm({ name: '', category: '', price: '', current_stock: '', threshold: '', warehouse_location: 'Mumbai Main Warehouse' });
      fetchData();
    } catch (err) { console.error(err); }
  };

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
    } catch (err) { console.error(err); }
  };

  // Calculations
  const totalRevenue = sales.reduce((sum, sale) => {
    const p = products.find(x => x.product_id === sale.product_id);
    return sum + (sale.quantity_sold * (p ? p.price : 0));
  }, 0);

  const lowStockCount = products.filter(p => p.current_stock < p.threshold).length;

  // Chart Mapping
  const catData = {};
  sales.forEach(s => {
    const p = products.find(x => x.product_id === s.product_id);
    if(p) { catData[p.category] = (catData[p.category] || 0) + s.quantity_sold; }
  });

  const salesChartData = {
    labels: Object.keys(catData),
    datasets: [{
      data: Object.values(catData),
      backgroundColor: ['#6366F1', '#8B5CF6', '#F59E0B', '#10B981', '#3B82F6'],
      borderWidth: 0
    }]
  };

  const demandChartData = {
    labels: products.map(p => p.name.substring(0, 10) + '...'),
    datasets: [{
      label: 'Current Stock',
      data: products.map(p => p.current_stock),
      backgroundColor: '#8B5CF6',
      borderRadius: 6
    }]
  };

  // Mock peak sales heatmap velocity data (7 days x 5 peak periods)
  const heatmapDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const heatmapCells = [
    { day: 'Mon', time: 'Morning', val: 'Low', color: '#1E293B' },
    { day: 'Mon', time: 'Afternoon', val: 'High', color: '#8B5CF6' },
    { day: 'Mon', time: 'Evening', val: 'Med', color: '#6366F1' },
    { day: 'Tue', time: 'Morning', val: 'Med', color: '#6366F1' },
    { day: 'Tue', time: 'Afternoon', val: 'High', color: '#8B5CF6' },
    { day: 'Tue', time: 'Evening', val: 'Peak', color: '#EC4899' },
    { day: 'Wed', time: 'Morning', val: 'Low', color: '#1E293B' },
    { day: 'Wed', time: 'Afternoon', val: 'Med', color: '#6366F1' },
    { day: 'Wed', time: 'Evening', val: 'High', color: '#8B5CF6' },
    { day: 'Thu', time: 'Morning', val: 'High', color: '#8B5CF6' },
    { day: 'Thu', time: 'Afternoon', val: 'Peak', color: '#EC4899' },
    { day: 'Thu', time: 'Evening', val: 'Med', color: '#6366F1' },
    { day: 'Fri', time: 'Morning', val: 'Med', color: '#6366F1' },
    { day: 'Fri', time: 'Afternoon', val: 'Peak', color: '#EC4899' },
    { day: 'Fri', time: 'Evening', val: 'Peak', color: '#EC4899' },
    { day: 'Sat', time: 'Morning', val: 'Low', color: '#1E293B' },
    { day: 'Sat', time: 'Afternoon', val: 'Med', color: '#6366F1' },
    { day: 'Sat', time: 'Evening', val: 'Low', color: '#1E293B' },
    { day: 'Sun', time: 'Morning', val: 'Low', color: '#1E293B' },
    { day: 'Sun', time: 'Afternoon', val: 'Low', color: '#1E293B' },
    { day: 'Sun', time: 'Evening', val: 'Med', color: '#6366F1' },
  ];

  return (
    <div className="view-section active">
      {/* Header */}
      <div className="dashboard-header" style={{ flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h2 className="page-title">Invent<span className="text-gradient">AI</span> System Overview</h2>
          <p className="page-subtitle">Welcome back! Here is the operations status for role: <strong>{role.toUpperCase()}</strong></p>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Non-destructive Reseed button for default brands */}
          {brandToKey[activeBrand] && role === 'admin' && (
            <button 
              className="btn btn-outline" 
              style={{ height: '42px', display: 'flex', alignItems: 'center', gap: '8px' }} 
              onClick={() => {
                setPendingIndustry(brandToKey[activeBrand]);
                setReseedModalOpen(true);
              }}
            >
              <WarningCircle size={18} className="text-orange" />
              Reseed Demo Catalog
            </button>
          )}

          {(role === 'admin' || role === 'staff') && (
            <button className="btn btn-outline" style={{ height: '42px' }} onClick={() => setSaleModalOpen(true)}>
              <Plus style={{ marginRight: '8px' }} /> Log B2B Sale
            </button>
          )}
          {(role === 'admin' || role === 'warehouse_manager') && (
            <button className="btn btn-primary" style={{ height: '42px' }} onClick={() => setProductModalOpen(true)}>
              <Plus style={{ marginRight: '8px' }} /> Add Lot Carton
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards (Role-Filtered) */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <div className="kpi-title">Active SKU Lots</div>
            <div className="kpi-icon bg-blue-light text-blue"><Package /></div>
          </div>
          <div className="kpi-value">{products.length}</div>
          <div className="kpi-trend positive">
            <TrendUp /> <span>Procured stable</span>
          </div>
        </div>

        {role === 'admin' ? (
          <div className="kpi-card">
            <div className="kpi-header">
              <div className="kpi-title">B2B Contract Revenue</div>
              <div className="kpi-icon bg-purple-light text-purple"><CurrencyDollar /></div>
            </div>
            <div className="kpi-value">₹{totalRevenue.toLocaleString()}</div>
            <div className="kpi-trend positive">
              <TrendUp /> <span>Invoice growth</span>
            </div>
          </div>
        ) : (
          <div className="kpi-card">
            <div className="kpi-header">
              <div className="kpi-title">Logged Transactions</div>
              <div className="kpi-icon bg-purple-light text-purple"><Plus /></div>
            </div>
            <div className="kpi-value">{sales.length} logs</div>
            <div className="kpi-trend neutral">
              <Info /> <span>Completed lines</span>
            </div>
          </div>
        )}

        <div className="kpi-card">
          <div className="kpi-header">
            <div className="kpi-title">Low Stock Cartons</div>
            <div className="kpi-icon bg-orange-light text-orange"><WarningCircle /></div>
          </div>
          <div className="kpi-value">{lowStockCount}</div>
          <div className="kpi-trend negative">
            <TrendUp /> <span>Restock needed</span>
          </div>
        </div>

        <div className="kpi-card ai-glow">
          <div className="kpi-header">
            <div className="kpi-title">AI Peak Season</div>
            <div className="kpi-icon bg-gradient text-white"><Brain /></div>
          </div>
          <div className="kpi-value">{activePeak.name}</div>
          <div className="kpi-trend neutral">
            <Info /> <span>{activePeak.trend}</span>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="charts-grid" style={{ marginBottom: '32px' }}>
        <div className="chart-card card">
          <div className="card-header">
            <h3 className="card-title">Category sales mapping</h3>
          </div>
          <div className="chart-container" style={{ padding: '16px', minHeight: '280px' }}>
            {Object.keys(catData).length > 0 ? (
              <Doughnut data={salesChartData} options={{ responsive: true, maintainAspectRatio: false }} />
            ) : <p className="text-muted" style={{ textAlign: 'center', marginTop: '80px' }}>No sales logged yet.</p>}
          </div>
        </div>

        <div className="chart-card card">
          <div className="card-header">
            <h3 className="card-title">Stock carton levels across SKUs</h3>
          </div>
          <div className="chart-container" style={{ padding: '16px', minHeight: '280px' }}>
            {products.length > 0 ? (
              <Bar data={demandChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
            ) : <p className="text-muted" style={{ textAlign: 'center', marginTop: '80px' }}>No products registered.</p>}
          </div>
        </div>
      </div>

      {/* Heatmap & AI Insights Bottom Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.7fr 1fr', gap: '32px', marginBottom: '32px' }}>
        
        {/* Live Warehouse Heatmap */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><House /> AI Sales Velocity Heatmap (Peak demand analysis)</h3>
          </div>
          <div style={{ padding: '24px' }}>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
              Visualizes wholesale dispatch speed. Highlighted cells represent hours of peak contract loading.
            </p>
            <div className="heatmap-container">
              {heatmapDays.map(d => (
                <div key={d} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d}</div>
              ))}
              {heatmapCells.map((c, idx) => (
                <div 
                  key={idx} 
                  className="heatmap-cell"
                  style={{ backgroundColor: c.color }}
                  title={`${c.day} - ${c.time}: ${c.val} velocity`}
                >
                  {c.time.substring(0, 3)}
                </div>
              ))}
            </div>
            
            <div style={{ display: 'flex', gap: '16px', marginTop: '24px', fontSize: '0.8rem', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#1E293B', borderRadius: '3px' }}></div> Low dispatch</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#6366F1', borderRadius: '3px' }}></div> Medium</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#8B5CF6', borderRadius: '3px' }}></div> High</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', backgroundColor: '#EC4899', borderRadius: '3px' }}></div> Peak Dispatch</div>
            </div>
          </div>
        </div>

        {/* AI Purchasing Panel */}
        <div className="card ai-card">
          <div className="card-header">
            <h3 className="card-title"><Sparkle className="text-gradient" weight="fill" /> AI procurement advice</h3>
          </div>
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {predictions.length === 0 ? (
                <p className="text-muted">No forecasting logs computed. Add transactions to trigger XGBoost advice.</p>
              ) : (
                predictions.slice(0, 3).map(pred => {
                  const p = products.find(x => x.product_id === pred.product_id);
                  return (
                    <div key={pred.id} className="ai-item" style={{ borderLeft: '4px solid var(--primary)', paddingLeft: '12px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{p ? p.name : 'SKU Lot'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Expected Demand: <strong>{parseFloat(pred.predicted_demand).toFixed(1)} cartons</strong><br />
                        Recommended Restock Target: <strong>{pred.recommended_stock} cartons</strong>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Modals */}
      {isProductModalOpen && (
        <div className="modal active">
          <div className="modal-content">
            <span className="close-modal" onClick={() => setProductModalOpen(false)}>&times;</span>
            <h2 className="modal-title">Register Product Lot</h2>
            <form onSubmit={handleAddProduct}>
              <div className="form-group">
                <label className="form-label">Product SKU Name</label>
                <input type="text" className="form-input" required value={prodForm.name} onChange={e => setProdForm({...prodForm, name: e.target.value})} />
              </div>
              <div className="form-group" style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Category</label>
                  <input type="text" className="form-input" required value={prodForm.category} onChange={e => setProdForm({...prodForm, category: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Warehouse Location</label>
                  <select className="form-input" required value={prodForm.warehouse_location} onChange={e => setProdForm({...prodForm, warehouse_location: e.target.value})}>
                    <option value="Mumbai Main Warehouse">Mumbai Main Warehouse</option>
                    <option value="Surat Textiles Lot">Surat Textiles Lot</option>
                    <option value="Ludhiana Hosiery Hub">Ludhiana Hosiery Hub</option>
                  </select>
                </div>
              </div>
              <div className="form-group" style={{display:'flex', gap:'16px'}}>
                <div style={{flex:1}}>
                  <label className="form-label">Price (₹)</label>
                  <input type="number" className="form-input" required value={prodForm.price} onChange={e => setProdForm({...prodForm, price: e.target.value})} />
                </div>
                <div style={{flex:1}}>
                  <label className="form-label">Initial Carton Count</label>
                  <input type="number" className="form-input" required value={prodForm.current_stock} onChange={e => setProdForm({...prodForm, current_stock: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Dynamic stock low alert threshold</label>
                <input type="number" className="form-input" required value={prodForm.threshold} onChange={e => setProdForm({...prodForm, threshold: e.target.value})} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => setProductModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Carton Lot</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSaleModalOpen && (
        <div className="modal active">
          <div className="modal-content">
            <span className="close-modal" onClick={() => setSaleModalOpen(false)}>&times;</span>
            <h2 className="modal-title">Record B2B Sale Invoice</h2>
            <form onSubmit={handleLogSale}>
              <div className="form-group">
                <label className="form-label">Select Active Product Carton Lot</label>
                <select className="form-input" required value={saleForm.product_id} onChange={e => setSaleForm({...saleForm, product_id: e.target.value})}>
                  <option value="">Select item...</option>
                  {products.map(p => (
                    <option key={p.product_id} value={p.product_id}>{p.name} (Available: {p.current_stock} cartons)</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cartons Dispatched</label>
                <input type="number" min="1" className="form-input" required value={saleForm.quantity_sold} onChange={e => setSaleForm({...saleForm, quantity_sold: e.target.value})} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => setSaleModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Log B2B Dispatch</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isReseedModalOpen && (
        <div className="modal active">
          <div className="modal-content glass-card" style={{ maxWidth: '450px', textAlign: 'center', padding: '32px' }}>
            <WarningCircle size={48} className="text-orange" style={{ marginBottom: '16px', display: 'inline-block' }} />
            <h2 className="modal-title" style={{ fontSize: '1.4rem', marginBottom: '12px' }}>Confirm Industry Reseeding</h2>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.5' }}>
              Reseeding <strong>{activeBrand}</strong> will overwrite current products, sales, and forecasts belonging strictly to this brand with clean high-fidelity demo sets. Other brands are completely unaffected. This is non-destructive to unified organization tables (e.g. employee logs).
            </p>
            <div className="form-actions" style={{ justifyContent: 'center', gap: '16px' }}>
              <button className="btn btn-outline" onClick={() => setReseedModalOpen(false)} disabled={reseeding}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleReseed} disabled={reseeding}>
                {reseeding ? 'Reseeding & Forecasting...' : 'Yes, Reseed Catalog'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

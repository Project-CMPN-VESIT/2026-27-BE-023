import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, Title, Tooltip, Legend
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { DownloadSimple, MagnifyingGlass, Funnel } from '@phosphor-icons/react';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, Title, Tooltip, Legend
);

const API_BASE = 'http://localhost:5000/api';

const Reports = () => {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [minVolume, setMinVolume] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('All');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sRes, pRes] = await Promise.all([
          axios.get(`${API_BASE}/sales`),
          axios.get(`${API_BASE}/products`)
        ]);
        setSales(sRes.data);
        setProducts(pRes.data);
      } catch (err) {
        console.error("Failed to fetch report data", err);
      }
    };
    fetchData();

    window.addEventListener('inventai_brand_changed', fetchData);
    return () => {
      window.removeEventListener('inventai_brand_changed', fetchData);
    };
  }, []);

  // Filter Sales Logic
  const filteredSales = sales.filter(s => {
    const p = products.find(x => x.product_id === s.product_id) || {};
    const nameMatch = p.name ? p.name.toLowerCase().includes(searchQuery.toLowerCase()) : true;
    const catMatch = selectedCategory === 'All' || p.category === selectedCategory;
    const locMatch = selectedWarehouse === 'All' || p.warehouse_location === selectedWarehouse;
    const volMatch = minVolume === '' || s.quantity_sold >= Number(minVolume);
    return nameMatch && catMatch && locMatch && volMatch;
  });

  // Prepare data for Sales Velocity Chart (Line)
  const salesByDate = {};
  filteredSales.forEach(s => {
    const d = new Date(s.date || s.created_at).toLocaleDateString();
    salesByDate[d] = (salesByDate[d] || 0) + s.quantity_sold;
  });
  
  const lineChartData = {
    labels: Object.keys(salesByDate).reverse(),
    datasets: [{
      label: 'Units Sold per Day (Cartons)',
      data: Object.values(salesByDate).reverse(),
      borderColor: '#6366F1',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      tension: 0.4,
      fill: true
    }]
  };

  // Prepare data for Revenue by Category (Bar)
  const revByCategory = {};
  filteredSales.forEach(s => {
    const p = products.find(x => x.product_id === s.product_id);
    if(p) {
      revByCategory[p.category] = (revByCategory[p.category] || 0) + (s.quantity_sold * p.price);
    }
  });

  const barChartData = {
    labels: Object.keys(revByCategory),
    datasets: [{
      label: 'Revenue (₹)',
      data: Object.values(revByCategory),
      backgroundColor: '#8B5CF6',
      borderRadius: 6
    }]
  };

  // Export CSV Helper
  const exportToCSV = () => {
    const headers = ["Order ID", "Product SKU", "Warehouse Facility", "Quantity Sold (Cartons)", "Price per Unit", "Contract Value (INR)", "Transaction Date"];
    const rows = filteredSales.map(s => {
      const p = products.find(x => x.product_id === s.product_id) || {};
      const value = s.quantity_sold * (p.price || 0);
      return [
        s.sale_id,
        p.name || 'N/A',
        p.warehouse_location || 'Mumbai Main',
        s.quantity_sold,
        p.price || 0,
        value,
        new Date(s.date).toLocaleDateString()
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(r => r.map(v => typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `InventAI_Sales_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Styled PDF Printing Window
  const exportToPDF = () => {
    const printWindow = window.open('', '_blank');
    const tableRows = filteredSales.map(s => {
      const p = products.find(x => x.product_id === s.product_id) || {};
      const value = s.quantity_sold * (p.price || 0);
      return `
        <tr>
          <td>#${s.sale_id.substring(0, 8).toUpperCase()}</td>
          <td><strong>${p.name || 'N/A'}</strong></td>
          <td>${p.category || 'N/A'}</td>
          <td>${s.quantity_sold} cartons</td>
          <td>₹${value.toLocaleString()}</td>
          <td>${new Date(s.date).toLocaleDateString()}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>InventAI B2B Dispatch Report</title>
          <style>
            body { font-family: 'Plus Jakarta Sans', sans-serif; padding: 40px; color: #1e293b; }
            .header { border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { margin: 0; color: #0f172a; font-size: 26px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
            th { background-color: #f8fafc; font-weight: 600; color: #64748b; font-size: 13px; text-transform: uppercase; }
            td { font-size: 14px; }
            @media print {
              .print-btn { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>InventAI Corporate Dispatch Report</h1>
            <p>Generated on: ${new Date().toLocaleDateString()} | Active Lines: ${filteredSales.length}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Volume</th>
                <th>Value</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <button class="print-btn" onclick="window.print()" style="padding: 10px 20px; background-color: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold; margin-top: 30px;">
            Save to PDF / Print Report
          </button>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Get unique categories for dropdown filter
  const categories = ['All', ...new Set(products.map(p => p.category))];
  const warehouses = ['All', 'Mumbai Main Warehouse', 'Surat Textiles Lot', 'Ludhiana Hosiery Hub'];

  return (
    <div className="view-section active">
      <div className="dashboard-header">
        <div>
          <h2 className="page-title">Analytics & Reports</h2>
          <p className="page-subtitle">Refined analysis of sales velocity, contract values, and inventory speed.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-outline" onClick={exportToCSV}>
            <DownloadSimple style={{ marginRight: '8px' }} /> Export CSV / Excel
          </button>
          <button className="btn btn-primary" onClick={exportToPDF}>
            <DownloadSimple style={{ marginRight: '8px' }} /> Export PDF Document
          </button>
        </div>
      </div>

      {/* Advanced Filters Block */}
      <div className="card" style={{ padding: '24px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontWeight: 'bold' }}>
          <Funnel className="text-primary" /> <span>Advanced Search & Catalog Filters</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Search SKU Lot</label>
            <div style={{ position: 'relative' }}>
              <MagnifyingGlass style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-light)' }} />
              <input 
                type="text" 
                className="form-input" 
                placeholder="Product name..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Category</label>
            <select className="form-input" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Facility Location</label>
            <select className="form-input" value={selectedWarehouse} onChange={e => setSelectedWarehouse(e.target.value)}>
              {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Min Volume (Cartons)</label>
            <input 
              type="number" 
              className="form-input" 
              placeholder="e.g. 10" 
              value={minVolume} 
              onChange={e => setMinVolume(e.target.value)} 
            />
          </div>

        </div>
      </div>

      {/* Main Charts */}
      <div className="charts-grid" style={{ marginBottom: '32px' }}>
        <div className="chart-card card">
          <div className="card-header">
            <h3 className="card-title">Sales Velocity (Cartons Dispatched over time)</h3>
          </div>
          <div className="chart-container" style={{ minHeight: '300px', padding: '16px' }}>
            {Object.keys(salesByDate).length > 0 ? (
              <Line data={lineChartData} options={{ responsive: true, maintainAspectRatio: false }} />
            ) : <p className="text-muted" style={{ textAlign: 'center', marginTop: '100px' }}>No matching data found.</p>}
          </div>
        </div>
        
        <div className="chart-card card">
          <div className="card-header">
            <h3 className="card-title">Revenue by Category (INR)</h3>
          </div>
          <div className="chart-container" style={{ minHeight: '300px', padding: '16px' }}>
            {Object.keys(revByCategory).length > 0 ? (
              <Bar data={barChartData} options={{ responsive: true, maintainAspectRatio: false }} />
            ) : <p className="text-muted" style={{ textAlign: 'center', marginTop: '100px' }}>No matching data found.</p>}
          </div>
        </div>
      </div>

      {/* Filtered Sales Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Filtered Dispatch Records ({filteredSales.length} Active Lines)</h3>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Product SKU</th>
                <th>Warehouse</th>
                <th>Volume (Cartons)</th>
                <th>Total Value (INR)</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center text-muted" style={{ padding: '32px' }}>
                    No sales matches search criteria.
                  </td>
                </tr>
              ) : (
                filteredSales.map(s => {
                  const p = products.find(x => x.product_id === s.product_id) || {};
                  const amount = s.quantity_sold * (p.price || 0);
                  return (
                    <tr key={s.sale_id}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        #{s.sale_id.substring(0, 8).toUpperCase()}
                      </td>
                      <td style={{ fontWeight: 600 }}>{p.name || 'Unknown SKU'}</td>
                      <td className="text-muted" style={{ fontSize: '0.85rem' }}>{p.warehouse_location || 'Mumbai Main'}</td>
                      <td style={{ fontWeight: 600 }}>{s.quantity_sold} cartons</td>
                      <td style={{ fontWeight: 700 }}>₹{amount.toLocaleString()}</td>
                      <td className="text-muted">{new Date(s.date).toLocaleDateString()}</td>
                      <td><span className="status-badge status-normal">Completed</span></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;

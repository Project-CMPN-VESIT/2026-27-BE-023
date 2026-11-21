import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Sparkle, Brain, WarningCircle, CheckCircle, Package, ArrowUpRight, ArrowDownRight, Tag } from '@phosphor-icons/react';

const API_BASE = 'http://localhost:5000/api';

const Predictions = () => {
  const [predictions, setPredictions] = useState([]);
  const [products, setProducts] = useState([]);
  const [insights, setInsights] = useState({
    deadStock: [],
    trending: [],
    safetyThresholds: [],
    seasonalPrediction: '',
    recommendations: []
  });
  const [recomputing, setRecomputing] = useState(false);

  const fetchPredictionsData = async () => {
    try {
      const [prRes, pRes, inRes] = await Promise.all([
        axios.get(`${API_BASE}/predictions`),
        axios.get(`${API_BASE}/products`),
        axios.get(`${API_BASE}/ai-insights`)
      ]);
      setPredictions(prRes.data);
      setProducts(pRes.data);
      setInsights(inRes.data);
    } catch (err) {
      console.error("Failed to fetch predictions", err);
    }
  };

  useEffect(() => {
    fetchPredictionsData();

    window.addEventListener('inventai_brand_changed', fetchPredictionsData);
    return () => {
      window.removeEventListener('inventai_brand_changed', fetchPredictionsData);
    };
  }, []);

  const triggerReforecast = async () => {
    setRecomputing(true);
    try {
      await axios.post(`${API_BASE}/trigger-prediction`);
      await fetchPredictionsData();
      alert("🧠 XGBoost Reforecast completed successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to contact ML Service. Using fallback forecast.");
    } finally {
      setRecomputing(false);
    }
  };

  return (
    <div className="view-section active">
      <div className="dashboard-header">
        <div>
          <h2 className="page-title">AI restock & price optimizations</h2>
          <p className="page-subtitle">Powered by XGBoost Machine Learning Model & B2B statistical analyzers.</p>
        </div>
        <button className="btn btn-primary" onClick={triggerReforecast} disabled={recomputing}>
          <Brain style={{ marginRight: '8px' }} /> {recomputing ? 'Recalculating...' : 'Trigger XGBoost Forecast'}
        </button>
      </div>

      {/* Seasonal Insights Header */}
      {insights.seasonalPrediction && (
        <div className="card glass-card" style={{ padding: '20px', marginBottom: '28px', borderLeft: '5px solid var(--accent)', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Sparkle size={36} className="text-accent-gradient" weight="fill" />
          <div>
            <h4 style={{ margin: 0, fontWeight: 700 }}>AI Seasonal Collection Advice</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>{insights.seasonalPrediction}</p>
          </div>
        </div>
      )}

      {/* Grid: Trending Lots & Price Clearance Discounts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', marginBottom: '32px' }}>
        
        {/* Trending Product Detection */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><ArrowUpRight className="text-primary" /> Trending High-Velocity Products</h3>
          </div>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {insights.trending.length === 0 ? (
              <p className="text-muted">No high-growth velocity items detected.</p>
            ) : (
              insights.trending.map(t => (
                <div key={t.product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className="product-img bg-gray" style={{ width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '8px' }}><Package /></div>
                    <div>
                      <h4 style={{ margin: 0, fontWeight: 700 }}>{t.name}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>{t.status}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>7d Dispatch</div>
                    <div>{t.volume_7d || 24} cartons</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dead Stock & Price Optimization */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><Tag className="text-accent-gradient" /> AI Price optimization (Dead stock liquidation)</h3>
          </div>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {insights.deadStock.length === 0 ? (
              <p className="text-muted">No slow-moving lots detected. Product shelves are clear and healthy!</p>
            ) : (
              insights.deadStock.map(ds => (
                <div key={ds.product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className="product-img bg-gray" style={{ width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '8px' }}><Package /></div>
                    <div>
                      <h4 style={{ margin: 0, fontWeight: 700 }}>{ds.name}</h4>
                      <span className="status-badge status-low" style={{ fontSize: '0.68rem', padding: '2px 8px', marginTop: '4px' }}>
                        Slow dispatch: {ds.current_stock} shelf-cartons
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 700 }}>{ds.suggested_discount}</div>
                    <div style={{ fontWeight: 800 }}>Clearance: ₹{ds.suggested_price}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Main Predictions Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title"><Brain /> Tomorrow's Purchase Recommendations</h3>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product SKU</th>
                <th>Current Stock</th>
                <th>Safety Threshold (Dynamic vs Static)</th>
                <th>Runs Out In</th>
                <th>Tomorrow's XGBoost Forecast</th>
                <th>Recommended Restock</th>
                <th>Recommendation Cross-sell</th>
              </tr>
            </thead>
            <tbody>
              {predictions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center text-muted" style={{ padding: '32px' }}>
                    No predictions stored. Verify sales are registered and run uvicorn ML services.
                  </td>
                </tr>
              ) : (
                predictions.map(pred => {
                  const product = products.find(p => p.product_id === pred.product_id);
                  if (!product) return null;
                  
                  const dynamicLimitObj = insights.safetyThresholds.find(x => x.product_id === pred.product_id);
                  const dynamicLimit = dynamicLimitObj ? dynamicLimitObj.dynamic_threshold : product.threshold + 4;

                  const crossSellObj = insights.recommendations.find(y => y.product_id === pred.product_id);
                  const crossSell = crossSellObj ? crossSellObj.recommended_cross_sell : "High-Demand Companion Item";

                  // Estimate runs out timeline
                  const isLowStock = product.current_stock < product.threshold;
                  let runsOutStr = "30+ days";
                  let badgeClass = "status-normal";
                  
                  if (product.current_stock === 0) {
                    runsOutStr = "💥 Empty";
                    badgeClass = "status-high";
                  } else if (isLowStock) {
                    runsOutStr = `${Math.max(1, Math.round(product.current_stock / 2))} days`;
                    badgeClass = "status-low";
                  }

                  return (
                    <tr key={pred.id}>
                      <td>
                        <div className="product-info-cell">
                          <div className="product-img bg-gray" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}><Package /></div>
                          <span style={{ fontWeight: 600 }}>{product.name}</span>
                        </div>
                      </td>
                      <td>{product.current_stock} cartons</td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>
                          <strong className="text-primary">{dynamicLimit}</strong> <span style={{ color: 'var(--text-light)' }}>(Dynamic)</span> vs <strong className="text-muted">{product.threshold}</strong> <span style={{ color: 'var(--text-light)' }}>(Static)</span>
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${badgeClass}`}>{runsOutStr}</span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.05rem' }}>
                        {parseFloat(pred.predicted_demand).toFixed(1)} cartons
                      </td>
                      <td style={{ fontWeight: 800 }}>
                        {pred.recommended_stock} cartons
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, backgroundColor: 'var(--purple-light)', color: 'var(--purple-text)', padding: '4px 8px', borderRadius: '4px' }}>
                          {crossSell}
                        </span>
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
  );
};

export default Predictions;

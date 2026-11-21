import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, Title, Tooltip, Legend, ArcElement
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { 
  Warning, Info, Bell, Plus, Trash, CheckCircle, ArrowClockwise, 
  WarningCircle, ShieldCheck, Sparkle, Sliders, SpeakerHigh, SpeakerSlash
} from '@phosphor-icons/react';

// Register ChartJS Components
ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, 
  BarElement, Title, Tooltip, Legend, ArcElement
);

const API_BASE = 'http://localhost:5000/api';

const Alerts = ({ user }) => {
  const [activeTab, setActiveTab] = useState('alerts');
  const [alerts, setAlerts] = useState([]);
  const [rules, setRules] = useState([]);
  const [preferences, setPreferences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sweepLoading, setSweepLoading] = useState(false);
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [moduleFilter, setModuleFilter] = useState('All');

  // Rule Form State
  const [ruleForm, setRuleForm] = useState({
    name: '',
    module: 'Inventory',
    metric: 'stock_level',
    operator: '<',
    value: '',
    severity: 'Medium'
  });

  // Selected Alert Drawer/Detail State
  const [selectedAlert, setSelectedAlert] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [aRes, rRes, pRes] = await Promise.all([
        axios.get(`${API_BASE}/alerts`),
        axios.get(`${API_BASE}/alert-rules`),
        axios.get(`${API_BASE}/notification-preferences`)
      ]);
      setAlerts(aRes.data);
      setRules(rRes.data);
      setPreferences(pRes.data);
    } catch (err) {
      console.error('Failed to retrieve alerts dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    window.addEventListener('inventai_brand_changed', fetchData);
    const handleRefreshed = () => {
      axios.get(`${API_BASE}/alerts`).then(res => setAlerts(res.data));
    };
    window.addEventListener('inventai_alerts_refreshed', handleRefreshed);

    return () => {
      window.removeEventListener('inventai_brand_changed', fetchData);
      window.removeEventListener('inventai_alerts_refreshed', handleRefreshed);
    };
  }, []);

  // Force central database systems sweep audit
  const handleTriggerSweep = async () => {
    setSweepLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/alerts/system/audit-trigger`);
      setAlerts(res.data.data);
      window.dispatchEvent(new Event('inventai_alerts_refreshed'));
      alert('⚡️ System Audit Complete! All inventory carton counts, absent staff rosters, and PO transit lines have been audited.');
    } catch (err) {
      console.error(err);
      alert('Failed to trigger background system sweep.');
    } finally {
      setSweepLoading(false);
    }
  };

  const handleMarkRead = async (alertId) => {
    try {
      await axios.patch(`${API_BASE}/alerts/${alertId}/read`);
      // Update local state dynamically
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'read' } : a));
      window.dispatchEvent(new Event('inventai_alerts_refreshed'));
      if (selectedAlert && selectedAlert.id === alertId) {
        setSelectedAlert(prev => ({ ...prev, status: 'read' }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveAlert = async (alertId) => {
    try {
      await axios.patch(`${API_BASE}/alerts/${alertId}/resolve`, {
        resolved_by: user ? user.username : 'Admin'
      });
      // Update local state dynamically
      setAlerts(prev => prev.map(a => a.id === alertId ? { 
        ...a, 
        status: 'resolved', 
        resolved_by: user ? user.username : 'Admin', 
        resolved_at: new Date().toISOString() 
      } : a));
      window.dispatchEvent(new Event('inventai_alerts_refreshed'));
      if (selectedAlert && selectedAlert.id === alertId) {
        setSelectedAlert(prev => ({ 
          ...prev, 
          status: 'resolved',
          resolved_by: user ? user.username : 'Admin',
          resolved_at: new Date().toISOString()
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAlert = async (alertId) => {
    try {
      await axios.delete(`${API_BASE}/alerts/${alertId}`);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      window.dispatchEvent(new Event('inventai_alerts_refreshed'));
      if (selectedAlert && selectedAlert.id === alertId) {
        setSelectedAlert(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_BASE}/alert-rules`, {
        ...ruleForm,
        value: Number(ruleForm.value)
      });
      setRules(prev => [res.data, ...prev]);
      setRuleForm({
        name: '',
        module: 'Inventory',
        metric: 'stock_level',
        operator: '<',
        value: '',
        severity: 'Medium'
      });
      alert('✅ Configuration Rule created successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to configure alert rule.');
    }
  };

  const handleDeleteRule = async (ruleId) => {
    try {
      await axios.delete(`${API_BASE}/alert-rules/${ruleId}`);
      setRules(prev => prev.filter(r => r.id !== ruleId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePreferenceChannel = async (role, moduleName, channelName, isChecked) => {
    try {
      const pref = preferences.find(p => p.user_role === role && p.module === moduleName) || {
        user_role: role,
        module: moduleName,
        channels: [],
        sound_enabled: true
      };

      let newChannels = [...pref.channels];
      if (isChecked) {
        if (!newChannels.includes(channelName)) newChannels.push(channelName);
      } else {
        newChannels = newChannels.filter(c => c !== channelName);
      }

      const res = await axios.put(`${API_BASE}/notification-preferences`, {
        user_role: role,
        module: moduleName,
        channels: newChannels,
        sound_enabled: pref.sound_enabled
      });

      setPreferences(prev => {
        const filtered = prev.filter(p => !(p.user_role === role && p.module === moduleName));
        return [...filtered, res.data];
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePreferenceSound = async (role, moduleName, isEnabled) => {
    try {
      const pref = preferences.find(p => p.user_role === role && p.module === moduleName) || {
        user_role: role,
        module: moduleName,
        channels: [],
        sound_enabled: true
      };

      const res = await axios.put(`${API_BASE}/notification-preferences`, {
        user_role: role,
        module: moduleName,
        channels: pref.channels,
        sound_enabled: isEnabled
      });

      setPreferences(prev => {
        const filtered = prev.filter(p => !(p.user_role === role && p.module === moduleName));
        return [...filtered, res.data];
      });
    } catch (err) {
      console.error(err);
    }
  };

  // KPI Calculations
  const activeAlertsCount = alerts.filter(a => a.status === 'unread').length;
  const criticalCount = alerts.filter(a => a.status === 'unread' && a.severity === 'Critical').length;
  const highCount = alerts.filter(a => a.status === 'unread' && a.severity === 'High').length;
  const systemStatus = criticalCount > 0 ? 'Degraded (Outages)' : (highCount > 0 ? 'Caution (Risks)' : 'Optimal (Healthy)');

  // Filter Alerts logic
  const filteredAlerts = alerts.filter(a => {
    const matchesSeverity = severityFilter === 'All' || a.severity === severityFilter;
    const matchesModule = moduleFilter === 'All' || a.module === moduleFilter;
    
    let matchesSearch = true;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      matchesSearch = a.title.toLowerCase().includes(q) || 
                      a.message.toLowerCase().includes(q) || 
                      (a.description && a.description.toLowerCase().includes(q));
    }

    return matchesSeverity && matchesModule && matchesSearch;
  });

  // --- Chart Setup & Aggregation ---
  // 1. Category/Module Doughnut
  const moduleCounts = {};
  alerts.forEach(a => {
    if (a.status !== 'resolved') {
      moduleCounts[a.module] = (moduleCounts[a.module] || 0) + 1;
    }
  });
  const moduleLabels = Object.keys(moduleCounts);
  const moduleData = Object.values(moduleCounts);

  const doughnutData = {
    labels: moduleLabels.length > 0 ? moduleLabels : ['Clean'],
    datasets: [{
      data: moduleData.length > 0 ? moduleData : [1],
      backgroundColor: moduleLabels.length > 0 
        ? ['#6366F1', '#F59E0B', '#10B981', '#EF4444', '#EC4899', '#8B5CF6', '#3B82F6']
        : ['rgba(16, 185, 129, 0.15)'],
      borderColor: moduleLabels.length > 0 ? 'var(--border)' : 'rgba(16, 185, 129, 0.4)',
      borderWidth: 1
    }]
  };

  const doughnutOptions = {
    plugins: {
      legend: { position: 'bottom', labels: { color: 'var(--text-muted)' } },
      tooltip: { enabled: true }
    },
    responsive: true,
    maintainAspectRatio: false
  };

  // 2. Severity Bar Chart
  const severityCounts = { 'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0 };
  alerts.forEach(a => {
    if (a.status === 'unread') {
      severityCounts[a.severity] = (severityCounts[a.severity] || 0) + 1;
    }
  });

  const barData = {
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [{
      label: 'Alarms Count',
      data: [severityCounts['Critical'], severityCounts['High'], severityCounts['Medium'], severityCounts['Low']],
      backgroundColor: ['#EF4444', '#F59E0B', '#6366F1', '#10B981'],
      borderRadius: 6,
      borderWidth: 0
    }]
  };

  const barOptions = {
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    },
    scales: {
      x: { ticks: { color: 'var(--text-muted)' }, grid: { display: false } },
      y: { ticks: { color: 'var(--text-muted)' } }
    },
    responsive: true,
    maintainAspectRatio: false
  };

  return (
    <div className="view-section active">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div>
          <h2 className="page-title">AI-Powered Systems Alarms & Warnings</h2>
          <p className="page-subtitle">Real-time dynamic monitoring, configurable threshold rules, and sound alerts.</p>
        </div>
        <button 
          className={`btn ${sweepLoading ? 'btn-outline' : 'btn-primary'}`} 
          disabled={sweepLoading} 
          onClick={handleTriggerSweep}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <ArrowClockwise className={sweepLoading ? 'rotating' : ''} />
          {sweepLoading ? 'Sweeping DB...' : '🔁 Trigger Systems Sweep'}
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '28px' }}>
        <div className="kpi-card" style={{ padding: '16px 20px' }}>
          <div className="kpi-header">
            <span className="kpi-title" style={{ fontSize: '0.75rem' }}>Active Alarms</span>
            <div className="kpi-icon bg-gray" style={{ color: 'var(--primary)', width: '36px', height: '36px', fontSize: '18px' }}><Bell weight="fill" /></div>
          </div>
          <div className="kpi-value" style={{ fontSize: '1.75rem', marginBottom: 0 }}>{activeAlertsCount}</div>
        </div>

        <div className="kpi-card" style={{ padding: '16px 20px' }}>
          <div className="kpi-header">
            <span className="kpi-title" style={{ fontSize: '0.75rem' }}>Critical Issues</span>
            <div className="kpi-icon" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', width: '36px', height: '36px', fontSize: '18px' }}><WarningCircle weight="fill" /></div>
          </div>
          <div className="kpi-value" style={{ fontSize: '1.75rem', marginBottom: 0, color: criticalCount > 0 ? '#EF4444' : 'var(--text-main)' }}>{criticalCount}</div>
        </div>

        <div className="kpi-card" style={{ padding: '16px 20px' }}>
          <div className="kpi-header">
            <span className="kpi-title" style={{ fontSize: '0.75rem' }}>Configuration Rules</span>
            <div className="kpi-icon bg-gray" style={{ color: 'var(--success)', width: '36px', height: '36px', fontSize: '18px' }}><Sliders weight="fill" /></div>
          </div>
          <div className="kpi-value" style={{ fontSize: '1.75rem', marginBottom: 0 }}>{rules.length}</div>
        </div>

        <div className="kpi-card" style={{ padding: '16px 20px' }}>
          <div className="kpi-header">
            <span className="kpi-title" style={{ fontSize: '0.75rem' }}>System Integrity</span>
            <div className="kpi-icon bg-gray" style={{ color: criticalCount > 0 ? '#EF4444' : 'var(--success)', width: '36px', height: '36px', fontSize: '18px' }}><ShieldCheck weight="fill" /></div>
          </div>
          <div className="kpi-value" style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '8px', color: criticalCount > 0 ? '#EF4444' : 'var(--success)' }}>
            {systemStatus}
          </div>
        </div>
      </div>

      {/* Tabs Switcher Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', marginBottom: '28px', gap: '8px' }}>
        <button 
          className={`btn ${activeTab === 'alerts' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('alerts')}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: activeTab === 'alerts' ? '2px solid var(--primary)' : 'none', padding: '10px 20px', fontSize: '0.85rem' }}
        >
          🚨 Alerts Inbox ({alerts.filter(a => a.status === 'unread').length})
        </button>
        <button 
          className={`btn ${activeTab === 'rules' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('rules')}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: activeTab === 'rules' ? '2px solid var(--primary)' : 'none', padding: '10px 20px', fontSize: '0.85rem' }}
        >
          ⚙️ Configure Threshold Rules
        </button>
        <button 
          className={`btn ${activeTab === 'preferences' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('preferences')}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottom: activeTab === 'preferences' ? '2px solid var(--primary)' : 'none', padding: '10px 20px', fontSize: '0.85rem' }}
        >
          🔊 Notification Channels
        </button>
      </div>

      {/* Tab 1: Alerts Inbox Feed & Analytics */}
      {activeTab === 'alerts' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '28px', alignItems: 'start' }}>
          
          {/* Main Feed Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Search and Filters Bar */}
            <div className="card" style={{ padding: '16px 20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 2, minWidth: '200px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Search alarm title, description, or SKUs..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <select className="form-input" value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
                  <option value="All">All Severities</option>
                  <option value="Critical">🔴 Critical</option>
                  <option value="High">🟠 High</option>
                  <option value="Medium">🔵 Medium</option>
                  <option value="Low">🟢 Low</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <select className="form-input" value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}>
                  <option value="All">All Categories</option>
                  <option value="Inventory">Inventory</option>
                  <option value="Staff">Staff</option>
                  <option value="Purchase Orders">Replenishments (PO)</option>
                  <option value="AI Forecasting">AI Predictions</option>
                  <option value="Finance">Finance</option>
                  <option value="Security">Security</option>
                  <option value="System Health">System Health</option>
                </select>
              </div>
            </div>

            {/* Alerts Feed Table */}
            <div className="card">
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Module</th>
                      <th>Title</th>
                      <th>Severity</th>
                      <th>Triggered At</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted" style={{ padding: '48px' }}>
                          No warnings matching the selected filter query found.
                        </td>
                      </tr>
                    ) : (
                      filteredAlerts.map(a => (
                        <tr 
                          key={a.id} 
                          onClick={() => setSelectedAlert(a)} 
                          style={{ cursor: 'pointer', background: selectedAlert && selectedAlert.id === a.id ? 'var(--border-light)' : 'none' }}
                        >
                          <td>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                              {a.module}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{a.title}</td>
                          <td>
                            <span className={`status-badge ${
                              a.severity === 'Critical' || a.severity === 'High' ? 'status-high' : 
                              a.severity === 'Medium' ? 'status-low' : 'status-normal'
                            }`}>
                              {a.severity}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {new Date(a.triggered_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td>
                            <span className={`status-badge ${
                              a.status === 'unread' ? 'status-high' : 
                              a.status === 'read' ? 'status-low' : 'status-normal'
                            }`} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                              {a.status}
                            </span>
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {a.status === 'unread' && (
                                <button className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '0.72rem' }} onClick={() => handleMarkRead(a.id)}>
                                  👁️ Read
                                </button>
                              )}
                              {a.status !== 'resolved' && (
                                <button className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '0.72rem', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.2)' }} onClick={() => handleResolveAlert(a.id)}>
                                  ✓ Resolve
                                </button>
                              )}
                              <button 
                                className="btn btn-outline" 
                                style={{ padding: '4px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }} 
                                onClick={() => handleDeleteAlert(a.id)}
                              >
                                <Trash size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Sidebar Drawer Panel: Detailed Alert Info & AI Recommendations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Detailed View Card */}
            {selectedAlert ? (
              <div className="card" style={{ padding: '24px', position: 'relative' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
                  {selectedAlert.title}
                </h3>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <span className={`severity-tag ${selectedAlert.severity.toLowerCase()}`}>{selectedAlert.severity}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', backgroundColor: 'var(--border-light)', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 700 }}>
                    {selectedAlert.module}
                  </span>
                </div>

                <div style={{ fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-main)', margin: '16px 0', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                  <strong>Message:</strong>
                  <p style={{ marginTop: '4px', color: 'var(--text-muted)' }}>{selectedAlert.message}</p>
                  
                  {selectedAlert.description && (
                    <div style={{ marginTop: '12px' }}>
                      <strong>Audit Details:</strong>
                      <p style={{ marginTop: '4px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{selectedAlert.description}</p>
                    </div>
                  )}
                </div>

                {/* SMART AI RESOLUTION RECOMMENDATION CARD */}
                {selectedAlert.action_required && (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    padding: '16px',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    position: 'relative',
                    overflow: 'hidden'
                  }} className="ai-glow">
                    <span style={{ 
                      fontSize: '0.72rem', 
                      fontWeight: 800, 
                      color: '#818CF8', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      textTransform: 'uppercase',
                      marginBottom: '6px'
                    }}>
                      <Sparkle weight="fill" /> Smart AI Auto-Resolution
                    </span>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: '1.45', margin: 0 }}>
                      {selectedAlert.action_required}
                    </p>
                  </div>
                )}

                {/* Audit Resolution Status */}
                {selectedAlert.status === 'resolved' && (
                  <div style={{ backgroundColor: 'var(--border-light)', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Resolved by <strong>{selectedAlert.resolved_by}</strong> on {new Date(selectedAlert.resolved_at).toLocaleDateString()}.
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedAlert.status === 'unread' && (
                    <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => handleMarkRead(selectedAlert.id)}>
                      Mark Read
                    </button>
                  )}
                  {selectedAlert.status !== 'resolved' && (
                    <button className="btn btn-primary" style={{ flex: 1.5 }} onClick={() => handleResolveAlert(selectedAlert.id)}>
                      Resolve Issue
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="card text-center text-muted" style={{ padding: '48px 24px' }}>
                <Bell size={48} style={{ margin: '0 auto 16px auto', color: 'var(--border)' }} />
                <p style={{ fontSize: '0.85rem' }}>Select any alarm row in the inbox feed to view descriptive details and trigger Smart AI Resolution tools.</p>
              </div>
            )}

            {/* Dynamic Charts for Category Alarms Distribution */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 className="card-title" style={{ fontSize: '0.9rem', marginBottom: '16px' }}>Category Alarms Distribution</h3>
              <div style={{ height: '180px', position: 'relative' }}>
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </div>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <h3 className="card-title" style={{ fontSize: '0.9rem', marginBottom: '16px' }}>Active Alarms by Severity</h3>
              <div style={{ height: '180px', position: 'relative' }}>
                <Bar data={barData} options={barOptions} />
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Tab 2: Configurable Threshold Rules */}
      {activeTab === 'rules' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '28px', alignItems: 'start' }}>
          
          {/* Create Alert Rule Form */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 className="card-title" style={{ marginBottom: '20px' }}>⚙️ Register Custom Limit Rule</h3>
            <form onSubmit={handleCreateRule}>
              <div className="form-group">
                <label className="form-label">Rule / Metric Identifier</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  placeholder="e.g. Ludhiana stock minimum threshold" 
                  value={ruleForm.name}
                  onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Category Module</label>
                  <select 
                    className="form-input" 
                    value={ruleForm.module} 
                    onChange={e => setRuleForm({ ...ruleForm, module: e.target.value })}
                  >
                    <option value="Inventory">Inventory</option>
                    <option value="AI Forecasting">AI Forecasting</option>
                    <option value="Suppliers">Suppliers</option>
                    <option value="Staff">Staff</option>
                    <option value="Finance">Finance</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Monitored Metric</label>
                  <select 
                    className="form-input" 
                    value={ruleForm.metric} 
                    onChange={e => setRuleForm({ ...ruleForm, metric: e.target.value })}
                  >
                    {ruleForm.module === 'Inventory' && <option value="stock_level">Stock Carton Level</option>}
                    {ruleForm.module === 'AI Forecasting' && <option value="predicted_stockout">Days to Runout</option>}
                    {ruleForm.module === 'Suppliers' && <option value="reliability_rate">Reliability %</option>}
                    {ruleForm.module === 'Staff' && <option value="absent_count">Absentee Turnout</option>}
                    {ruleForm.module === 'Finance' && <option value="expense_ratio">Expense Budget Ratio</option>}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Operator</label>
                  <select 
                    className="form-input" 
                    value={ruleForm.operator} 
                    onChange={e => setRuleForm({ ...ruleForm, operator: e.target.value })}
                  >
                    <option value="<">&lt; Less than</option>
                    <option value=">">&gt; Greater than</option>
                    <option value="==">== Equal to</option>
                    <option value="<=">&lt;= Less/Equal</option>
                    <option value=">=">&gt;= Greater/Equal</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">Comparison Value</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    required 
                    placeholder="e.g. 15" 
                    value={ruleForm.value}
                    onChange={e => setRuleForm({ ...ruleForm, value: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Triggered Alarm Severity</label>
                <select 
                  className="form-input" 
                  value={ruleForm.severity} 
                  onChange={e => setRuleForm({ ...ruleForm, severity: e.target.value })}
                >
                  <option value="Low">🟢 Low</option>
                  <option value="Medium">🔵 Medium</option>
                  <option value="High">🟠 High</option>
                  <option value="Critical">🔴 Critical</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                Save Limit Threshold Rule
              </button>
            </form>
          </div>

          {/* Active Configured Alert Rules Table */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Registered Systems Configurations ({rules.length})</h3>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rule Identifier</th>
                    <th>Category</th>
                    <th>Logic Parameter</th>
                    <th>Severity</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center text-muted">No custom configuration rules registered.</td>
                    </tr>
                  ) : (
                    rules.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.name}</td>
                        <td>{r.module}</td>
                        <td style={{ fontFamily: 'monospace' }}>
                          {r.metric} {r.operator} {r.value}
                        </td>
                        <td>
                          <span className={`status-badge ${
                            r.severity === 'Critical' || r.severity === 'High' ? 'status-high' : 
                            r.severity === 'Medium' ? 'status-low' : 'status-normal'
                          }`} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                            {r.severity}
                          </span>
                        </td>
                        <td>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '4px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                            onClick={() => handleDeleteRule(r.id)}
                          >
                            <Trash size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Tab 3: Notification Channels Preferences */}
      {activeTab === 'preferences' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Role-Based Alert Broadcast Toggles</h3>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Systems Module</th>
                  <th>Toast Popup (All roles)</th>
                  <th>Bell dropdown (All roles)</th>
                  <th>🔊 Audio Alarm Beep Toggles</th>
                </tr>
              </thead>
              <tbody>
                {['Inventory', 'AI Forecasting', 'Suppliers', 'Purchase Orders', 'Sales', 'Finance', 'Staff', 'Security', 'System Health'].map(mod => {
                  const pref = preferences.find(p => p.user_role === 'admin' && p.module === mod) || {
                    channels: ['toast', 'bell'],
                    sound_enabled: true
                  };

                  const isToastEnabled = pref.channels.includes('toast');
                  const isBellEnabled = pref.channels.includes('bell');
                  const isSoundEnabled = pref.sound_enabled;

                  return (
                    <tr key={mod}>
                      <td style={{ fontWeight: 700 }}>{mod}</td>
                      <td>
                        <label className="switch-toggle" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={isToastEnabled} 
                            onChange={(e) => handleTogglePreferenceChannel('admin', mod, 'toast', e.target.checked)}
                          />
                          <span style={{ fontSize: '0.85rem' }}>{isToastEnabled ? 'ON' : 'OFF'}</span>
                        </label>
                      </td>
                      <td>
                        <label className="switch-toggle" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={isBellEnabled} 
                            onChange={(e) => handleTogglePreferenceChannel('admin', mod, 'bell', e.target.checked)}
                          />
                          <span style={{ fontSize: '0.85rem' }}>{isBellEnabled ? 'ON' : 'OFF'}</span>
                        </label>
                      </td>
                      <td>
                        <button 
                          className="btn btn-outline" 
                          style={{ 
                            padding: '6px 12px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            fontSize: '0.8rem',
                            color: isSoundEnabled ? 'var(--success)' : 'var(--text-muted)',
                            borderColor: isSoundEnabled ? 'rgba(16, 185, 129, 0.3)' : 'var(--border)'
                          }}
                          onClick={() => handleTogglePreferenceSound('admin', mod, !isSoundEnabled)}
                        >
                          {isSoundEnabled ? <SpeakerHigh /> : <SpeakerSlash />}
                          {isSoundEnabled ? 'Sound Alarm Active' : 'Sound Muted'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default Alerts;

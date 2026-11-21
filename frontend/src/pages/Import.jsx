import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  UploadSimple, FileText, CheckCircle, WarningCircle, 
  ArrowClockwise, DownloadSimple, ArrowUpRight, Check, Trash
} from '@phosphor-icons/react';

const API_BASE = 'http://localhost:5000/api';

const Import = () => {
  const [importType, setImportType] = useState('products'); // 'products' or 'sales'
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedData, setParsedData] = useState([]);
  const [validatedData, setValidatedData] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Fetch products catalog for validation/mapping
    const fetchProducts = async () => {
      try {
        const res = await axios.get(`${API_BASE}/products`);
        setProductsList(res.data);
      } catch (err) {
        console.error('Failed to fetch products list', err);
      }
    };
    fetchProducts();
  }, []);

  // CSV parsing logic
  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];
    
    // Normalize headers: lowercase and remove spaces/underscores
    const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    
    return lines.slice(1).map(line => {
      const values = [];
      let currentVal = '';
      let insideQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          values.push(currentVal.trim().replace(/^["']|["']$/g, ''));
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      values.push(currentVal.trim().replace(/^["']|["']$/g, ''));
      
      const obj = {};
      rawHeaders.forEach((header, index) => {
        obj[header] = values[index] !== undefined ? values[index] : '';
      });
      return obj;
    });
  };

  // Perform validation on the parsed rows
  const validateRows = (rows, type) => {
    if (type === 'products') {
      return rows.map((row, index) => {
        const name = row.name || row.Name || row.product_name || '';
        const category = row.category || row.Category || 'Uncategorized';
        const price = Number(row.price || row.Price || 0);
        const current_stock = Number(row.current_stock || row.stock || row.Stock || row.CurrentStock || 0);
        const threshold = Number(row.threshold || row.Threshold || row.limit || 10);
        const product_id = row.product_id || row.id || row.productId || '';

        const errors = [];
        if (!name) errors.push('Product name is required.');
        if (isNaN(price) || price <= 0) errors.push('Price must be a positive number.');
        if (isNaN(current_stock) || current_stock < 0) errors.push('Stock cannot be negative.');
        if (isNaN(threshold) || threshold < 0) errors.push('Threshold cannot be negative.');

        return {
          id: index,
          original: row,
          data: { name, category, price, current_stock, threshold, product_id },
          isValid: errors.length === 0,
          errors
        };
      });
    } else {
      // Importing sales
      return rows.map((row, index) => {
        let pId = row.product_id || row.productId || row.item_id || '';
        const pName = row.product_name || row.productName || row.name || row.Product || '';
        const qty = Number(row.quantity_sold || row.quantity || row.quantitySold || row.volume || 0);
        const date = row.date || row.Date || row.timestamp || new Date().toISOString();

        const errors = [];
        let warning = '';

        // Auto-resolve product name to ID if product_id is missing or if name is provided
        if (!pId && pName) {
          const match = productsList.find(p => p.name.toLowerCase() === pName.toLowerCase());
          if (match) {
            pId = match.product_id;
          } else {
            errors.push(`Product "${pName}" not found in catalog.`);
          }
        } else if (pId) {
          const match = productsList.find(p => p.product_id === pId);
          if (!match) {
            errors.push(`Product ID "${pId}" not found in catalog.`);
          }
        } else {
          errors.push('Either product_id or product_name is required.');
        }

        if (isNaN(qty) || qty <= 0) {
          errors.push('Quantity sold must be a positive number.');
        } else if (pId) {
          // Check if there is enough stock
          const match = productsList.find(p => p.product_id === pId);
          if (match && match.current_stock < qty) {
            warning = `Warning: Sale quantity (${qty}) exceeds current stock (${match.current_stock}).`;
          }
        }

        return {
          id: index,
          original: row,
          data: { product_id: pId, product_name: pName || (productsList.find(p => p.product_id === pId)?.name || 'Unknown'), quantity_sold: qty, date },
          isValid: errors.length === 0,
          errors,
          warning
        };
      });
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      let rawRows = [];

      try {
        if (file.name.endsWith('.json')) {
          const parsedJson = JSON.parse(content);
          rawRows = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
        } else if (file.name.endsWith('.csv')) {
          rawRows = parseCSV(content);
        } else {
          alert('Unsupported file format. Please upload a .csv or .json file.');
          return;
        }

        setParsedData(rawRows);
        const validated = validateRows(rawRows, importType);
        setValidatedData(validated);
      } catch (err) {
        console.error('File reading/parsing failed', err);
        alert('Failed to parse file. Make sure it is correctly formatted JSON or CSV.');
      }
    };
    reader.readAsText(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleImportSubmit = async () => {
    const validPayload = validatedData
      .filter(item => item.isValid)
      .map(item => item.data);

    if (validPayload.length === 0) {
      alert('No valid records to import.');
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const endpoint = importType === 'products' ? '/products/bulk' : '/sales/bulk';
      const res = await axios.post(`${API_BASE}${endpoint}`, validPayload);
      
      setImportResult({
        success: true,
        count: validPayload.length,
        total: validatedData.length,
        type: importType
      });

      // Clear current file/data states
      setFileName('');
      setParsedData([]);
      setValidatedData([]);

      // Refresh products list for future validations
      if (importType === 'products') {
        const prodRes = await axios.get(`${API_BASE}/products`);
        setProductsList(prodRes.data);
      }

      // If imported sales, automatically trigger prediction engine
      if (importType === 'sales') {
        axios.post(`${API_BASE}/trigger-prediction`).catch(console.error);
      }

    } catch (err) {
      console.error(err);
      setImportResult({
        success: false,
        error: err.response?.data?.message || err.message
      });
    } finally {
      setIsImporting(false);
    }
  };

  const clearFile = () => {
    setFileName('');
    setParsedData([]);
    setValidatedData([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Sample template content for copying
  const templates = {
    products: {
      csv: "name,category,price,current_stock,threshold\nClassic Tee,Apparel,499,120,20\nDenim Jacket,Apparel,1899,45,10\nLeather Boots,Footwear,3499,30,5",
      json: `[\n  {\n    "name": "Classic Tee",\n    "category": "Apparel",\n    "price": 499,\n    "current_stock": 120,\n    "threshold": 20\n  }\n]`
    },
    sales: {
      csv: "product_name,quantity_sold,date\nClassic Tee,15,2026-05-18T10:30:00Z\nDenim Jacket,3,2026-05-19T14:45:00Z",
      json: `[\n  {\n    "product_name": "Classic Tee",\n    "quantity_sold": 15,\n    "date": "2026-05-18T10:30:00Z"\n  }\n]`
    }
  };

  const copyTemplate = (format) => {
    const text = templates[importType][format];
    navigator.clipboard.writeText(text);
    alert(`${format.toUpperCase()} template copied to clipboard!`);
  };

  const errorsCount = validatedData.filter(item => !item.isValid).length;
  const readyCount = validatedData.filter(item => item.isValid).length;

  return (
    <div className="view-section active">
      <div className="dashboard-header">
        <div>
          <h2 className="page-title">Data Seeding & Bulk Import</h2>
          <p className="page-subtitle">Seed products and historical sales transactions from CSV or JSON files.</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        <button 
          onClick={() => { setImportType('products'); clearFile(); }}
          className={`btn ${importType === 'products' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '8px 20px', borderRadius: '99px' }}
        >
          Import Products Catalog
        </button>
        <button 
          onClick={() => { setImportType('sales'); clearFile(); }}
          className={`btn ${importType === 'sales' ? 'btn-primary' : 'btn-outline'}`}
          style={{ padding: '8px 20px', borderRadius: '99px' }}
        >
          Import Sales History
        </button>
      </div>

      <div className="charts-grid" style={{ gridTemplateColumns: '1.8fr 1.2fr', alignItems: 'start' }}>
        
        {/* Left: Drag and Drop + Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Upload Box */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              style={{
                padding: '40px 24px',
                textAlign: 'center',
                border: dragActive ? '2px dashed var(--primary)' : '2px dashed var(--border)',
                backgroundColor: dragActive ? 'var(--blue-light)' : 'var(--bg-surface)',
                margin: '16px',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
              onClick={() => fileInputRef.current.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".csv,.json" 
                style={{ display: 'none' }} 
              />
              <UploadSimple size={48} className="text-primary" style={{ margin: '0 auto 16px auto' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>
                {fileName ? fileName : `Drag & Drop your ${importType.toUpperCase()} file here`}
              </h3>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '16px' }}>
                Supports both .csv and .json format files
              </p>
              <button className="btn btn-outline" style={{ fontSize: '0.85rem' }}>
                Browse Files
              </button>
            </div>
          </div>

          {/* Import Result Notification */}
          {importResult && (
            <div className={`card`} style={{ 
              padding: '20px', 
              borderLeft: `5px solid ${importResult.success ? 'var(--success)' : 'var(--danger)'}`,
              backgroundColor: importResult.success ? 'var(--success-light)' : 'var(--danger-light)',
            }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {importResult.success ? (
                  <CheckCircle size={32} style={{ color: 'var(--success-text)' }} />
                ) : (
                  <WarningCircle size={32} style={{ color: 'var(--danger-text)' }} />
                )}
                <div>
                  <h4 style={{ fontWeight: 700, color: importResult.success ? 'var(--success-text)' : 'var(--danger-text)' }}>
                    {importResult.success ? 'Import Completed Successfully!' : 'Import Failed'}
                  </h4>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginTop: '4px' }}>
                    {importResult.success 
                      ? `Successfully imported ${importResult.count} of ${importResult.total} records into the database.`
                      : `Error: ${importResult.error}`
                    }
                  </p>
                  {importResult.success && importResult.type === 'sales' && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                      ✨ Historical sales loaded. Re-training AI prediction engine in background...
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Validation Summary & Action Banner */}
          {validatedData.length > 0 && (
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '24px' }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ready to Import</span>
                    <h4 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{readyCount}</h4>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Errors Blocked</span>
                    <h4 style={{ fontSize: '1.5rem', fontWeight: 700, color: errorsCount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{errorsCount}</h4>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn btn-outline" onClick={clearFile}>
                    <Trash style={{ marginRight: '6px' }} /> Clear File
                  </button>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleImportSubmit} 
                    disabled={isImporting || readyCount === 0}
                  >
                    {isImporting ? (
                      <>
                        <ArrowClockwise className="spinner" style={{ marginRight: '6px' }} /> Importing...
                      </>
                    ) : (
                      <>
                        <Check style={{ marginRight: '6px' }} /> Import {readyCount} Records
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Preview Table */}
          {validatedData.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Data Ingestion Preview</h3>
              </div>
              <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      {importType === 'products' ? (
                        <>
                          <th>Name</th>
                          <th>Category</th>
                          <th>Price</th>
                          <th>Stock</th>
                          <th>Threshold</th>
                        </>
                      ) : (
                        <>
                          <th>Product Name/ID</th>
                          <th>Quantity Sold</th>
                          <th>Date</th>
                        </>
                      )}
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validatedData.map(item => (
                      <tr 
                        key={item.id} 
                        style={{ 
                          backgroundColor: item.isValid 
                            ? 'transparent' 
                            : 'rgba(239, 68, 68, 0.05)'
                        }}
                      >
                        <td>
                          {item.isValid ? (
                            <span className="status-badge status-normal" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle weight="fill" /> Ready
                            </span>
                          ) : (
                            <span className="status-badge status-high" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <WarningCircle weight="fill" /> Error
                            </span>
                          )}
                        </td>
                        
                        {importType === 'products' ? (
                          <>
                            <td style={{ fontWeight: 600 }}>{item.data.name || <em className="text-light">None</em>}</td>
                            <td>{item.data.category}</td>
                            <td>₹{item.data.price}</td>
                            <td>{item.data.current_stock}</td>
                            <td>{item.data.threshold}</td>
                          </>
                        ) : (
                          <>
                            <td style={{ fontWeight: 600 }}>
                              {item.data.product_name || item.data.product_id}
                            </td>
                            <td>{item.data.quantity_sold} Cartons</td>
                            <td style={{ fontSize: '0.85rem' }} className="text-muted">
                              {new Date(item.data.date).toLocaleDateString()}
                            </td>
                          </>
                        )}
                        
                        <td style={{ fontSize: '0.85rem' }}>
                          {item.isValid ? (
                            item.warning ? (
                              <span className="text-orange" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <WarningCircle weight="fill" /> {item.warning}
                              </span>
                            ) : (
                              <span className="text-muted">Will import cleanly</span>
                            )
                          ) : (
                            <span className="text-danger" style={{ fontWeight: 500 }}>
                              {item.errors.join(' ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Right: Formatting Templates & Guidelines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Templates Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">File Templates</h3>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <p className="text-muted" style={{ fontSize: '0.9rem' }}>
                Copy these formatting guidelines to structure your file correctly before uploading.
              </p>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>CSV Template</span>
                  <button className="action-btn text-primary" onClick={() => copyTemplate('csv')} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <DownloadSimple /> Copy CSV
                  </button>
                </div>
                <pre style={{
                  backgroundColor: 'var(--bg-app)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)'
                }}>
                  {templates[importType].csv}
                </pre>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>JSON Template</span>
                  <button className="action-btn text-primary" onClick={() => copyTemplate('json')} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <DownloadSimple /> Copy JSON
                  </button>
                </div>
                <pre style={{
                  backgroundColor: 'var(--bg-app)',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  border: '1px solid var(--border)',
                  color: 'var(--text-main)'
                }}>
                  {templates[importType].json}
                </pre>
              </div>
            </div>
          </div>

          {/* Guidelines Box */}
          <div className="card ai-card" style={{ padding: '24px' }}>
            <h4 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <WarningCircle size={20} className="text-primary" /> Important Guidelines
            </h4>
            <ul style={{ paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {importType === 'products' ? (
                <>
                  <li><strong>Price</strong> must be a positive number representing rupee value (INR).</li>
                  <li><strong>Current Stock</strong> and <strong>Threshold</strong> must be non-negative integers.</li>
                  <li>If the <strong>product_id</strong> column is omitted, the system will automatically generate a unique SKU ID.</li>
                </>
              ) : (
                <>
                  <li>You can reference products by their exact <strong>product_name</strong> or <strong>product_id</strong>.</li>
                  <li>The system will automatically find matching products in the database and link the transaction.</li>
                  <li>The <strong>quantity_sold</strong> represents volume in units/cartons and must be a positive integer.</li>
                  <li>Importing sales data will automatically trigger the AI prediction engine to update future inventory recommendations.</li>
                </>
              )}
            </ul>
          </div>

        </div>

      </div>
    </div>
  );
};

export default Import;

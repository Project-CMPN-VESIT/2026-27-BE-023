import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { 
  Barcode, Printer, FilePdf, CheckSquare, Square, Sliders, ToggleLeft, ToggleRight 
} from '@phosphor-icons/react';

const API_BASE = 'http://localhost:5000/api';

const BarcodeSheet = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pdfCompiling, setPdfCompiling] = useState(false);
  
  // Selection and quantities mapping
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [quantities, setQuantities] = useState({}); // { product_id: quantity }
  
  // Customization Toggles
  const [barcodeFormat, setBarcodeFormat] = useState('CODE128'); // 'CODE128', 'EAN13', 'QR'
  const [includeName, setIncludeName] = useState(true);
  const [includePrice, setIncludePrice] = useState(true);
  const [includeSKU, setIncludeSKU] = useState(true);
  const [includeBrand, setIncludeBrand] = useState(false);

  const activeBrand = localStorage.getItem('inventai_active_brand') || 'Apparel & Fashion';

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/products`);
      setProducts(res.data);
      
      // Auto-select all products and default quantity to 1
      const ids = res.data.map(p => p.product_id);
      setSelectedProductIds(ids);
      
      const q = {};
      res.data.forEach(p => {
        q[p.product_id] = 1; // default to 1 label
      });
      setQuantities(q);
    } catch (err) {
      console.error('Failed to load products in print portal:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    window.addEventListener('inventai_brand_changed', fetchData);
    return () => {
      window.removeEventListener('inventai_brand_changed', fetchData);
    };
  }, []);

  const handleToggleSelect = (productId) => {
    if (selectedProductIds.includes(productId)) {
      setSelectedProductIds(prev => prev.filter(id => id !== productId));
    } else {
      setSelectedProductIds(prev => [...prev, productId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedProductIds.length === products.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(products.map(p => p.product_id));
    }
  };

  const handleQtyChange = (productId, val) => {
    const q = Math.max(0, parseInt(val, 10) || 0);
    setQuantities(prev => ({ ...prev, [productId]: q }));
  };

  // Compile individual label objects list
  const getLabelsList = () => {
    const list = [];
    products.forEach(p => {
      if (selectedProductIds.includes(p.product_id)) {
        const count = quantities[p.product_id] || 0;
        for (let i = 0; i < count; i++) {
          list.push(p);
        }
      }
    });
    return list;
  };

  // Compile PDF Avery 5160 using jsPDF
  const handleCompilePDF = async () => {
    const labels = getLabelsList();
    if (labels.length === 0) {
      alert('Please select at least one product and specify a quantity > 0.');
      return;
    }

    setPdfCompiling(true);
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });

      // Avery 5160 Layout Margins and Sizes (in mm)
      const labelWidth = 66.675;
      const labelHeight = 25.4;
      const topMargin = 12.7;
      const sideMargin = 4.76;
      const horizGap = 3.175;

      for (let index = 0; index < labels.length; index++) {
        const p = labels[index];
        const col = index % 3;
        const row = Math.floor(index / 3) % 10;
        const page = Math.floor(index / 30);

        if (index > 0 && index % 30 === 0) {
          pdf.addPage();
        }

        const x = sideMargin + col * (labelWidth + horizGap);
        const y = topMargin + row * labelHeight;

        // Draw light grey box for alignment boundary helpers (optional, let's keep it clean without borders for real printing)
        // pdf.setDrawColor(240, 240, 240);
        // pdf.rect(x, y, labelWidth, labelHeight);

        // Draw text elements
        let currY = y + 4.5;
        pdf.setTextColor(0, 0, 0);

        if (includeBrand) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(6);
          pdf.text(activeBrand.toUpperCase(), x + 3, currY);
          currY += 2.5;
        }

        if (includeName) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          // Truncate name if too long
          let name = p.name;
          if (name.length > 25) name = name.substring(0, 22) + '...';
          pdf.text(name, x + 3, currY);
          currY += 3.5;
        }

        if (includeSKU) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(6.5);
          pdf.setTextColor(80, 80, 80);
          pdf.text(`SKU: ${p.product_id}`, x + 3, currY);
          pdf.setTextColor(0, 0, 0);
        }

        if (includePrice) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          pdf.text(`₹${p.price.toLocaleString()}`, x + labelWidth - 18, y + 5);
        }

        // Draw Barcode/QR Code
        const barcodeVal = p.barcode || p.product_id;
        const canvas = document.createElement('canvas');

        try {
          if (barcodeFormat === 'QR') {
            // Generate QR Code data URL
            await QRCode.toCanvas(canvas, barcodeVal, { margin: 0, width: 80 });
            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', x + labelWidth - 17, y + labelHeight - 17, 14, 14);
          } else {
            // Generate linear barcode
            let finalFormat = barcodeFormat;
            if (barcodeFormat === 'EAN13') {
              const isNumeric = /^\d+$/.test(barcodeVal);
              if (!isNumeric || barcodeVal.length < 12 || barcodeVal.length > 13) {
                finalFormat = 'CODE128';
              }
            }

            JsBarcode(canvas, barcodeVal, {
              format: finalFormat,
              width: 1.5,
              height: 38,
              displayValue: false,
              margin: 0
            });
            const imgData = canvas.toDataURL('image/png');
            // Center the barcode horizontally inside the label
            pdf.addImage(imgData, 'PNG', x + 3, y + labelHeight - 11, labelWidth - 24, 7);
          }
        } catch (err) {
          console.error('Barcode PDF drawing error:', err);
        }

        // Draw small numeric value under barcode (if not QR)
        if (barcodeFormat !== 'QR') {
          pdf.setFont('monospace', 'normal');
          pdf.setFontSize(6);
          pdf.setTextColor(60, 60, 60);
          pdf.text(barcodeVal, x + 3, y + labelHeight - 2);
        }
      }

      pdf.save(`Barcodes_${activeBrand.replace(/\s+/g, '_')}_Avery5160.pdf`);
      alert('📄 Avery 5160 Barcode PDF sheets downloaded successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to compile PDF labels.');
    } finally {
      setPdfCompiling(false);
    }
  };

  // Direct Print via Styled browser window
  const handleDirectPrint = () => {
    const labels = getLabelsList();
    if (labels.length === 0) {
      alert('Please select products and quantities to print.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=600');
    
    // Build labels html
    let labelsHTML = '';
    labels.forEach(p => {
      const isEan = barcodeFormat === 'EAN13' && /^\d+$/.test(p.barcode || p.product_id) && ((p.barcode || p.product_id).length === 12 || (p.barcode || p.product_id).length === 13);
      const fmt = barcodeFormat === 'EAN13' && !isEan ? 'CODE128' : barcodeFormat;

      labelsHTML += `
        <div class="label-box">
          <div class="label-header">
            <div>
              ${includeBrand ? `<div class="brand">${activeBrand.toUpperCase()}</div>` : ''}
              ${includeName ? `<div class="name">${p.name}</div>` : ''}
              ${includeSKU ? `<div class="sku">SKU: ${p.product_id}</div>` : ''}
            </div>
            ${includePrice ? `<div class="price">₹${p.price.toLocaleString()}</div>` : ''}
          </div>
          <div class="barcode-wrapper" data-val="${p.barcode || p.product_id}" data-fmt="${fmt}">
            <!-- Barcode injected here -->
          </div>
        </div>
      `;
    });

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Avery 5160 - ${activeBrand}</title>
          <style>
            @page {
              size: 8.5in 11in;
              margin: 0;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              margin: 0;
              padding: 0.5in 0.1875in;
              box-sizing: border-box;
              background: #ffffff;
              color: #000000;
            }
            .grid-container {
              display: grid;
              grid-template-columns: repeat(3, 2.625in);
              grid-gap: 0 0.125in;
              grid-auto-rows: 1.0in;
              box-sizing: border-box;
            }
            .label-box {
              width: 2.625in;
              height: 1.0in;
              padding: 5px 10px;
              box-sizing: border-box;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              border: 1px dotted #dddddd; /* helper margins */
              position: relative;
              page-break-inside: avoid;
            }
            @media print {
              .label-box {
                border: none; /* remove borders for real printing */
              }
            }
            .label-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              width: 100%;
            }
            .brand {
              font-size: 5px;
              color: #555555;
              font-weight: bold;
              margin-bottom: 1px;
            }
            .name {
              font-size: 8px;
              font-weight: bold;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              max-width: 1.6in;
            }
            .sku {
              font-size: 6px;
              color: #444444;
            }
            .price {
              font-size: 8px;
              font-weight: 700;
            }
            .barcode-wrapper {
              display: flex;
              justify-content: center;
              align-items: center;
              height: 12mm;
              width: 100%;
              overflow: hidden;
            }
            .qr-canvas {
              width: 12mm;
              height: 12mm;
              position: absolute;
              right: 10px;
              bottom: 8px;
            }
          </style>
        </head>
        <body>
          <div class="grid-container">
            ${labelsHTML}
          </div>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <script>
            window.onload = function() {
              const wrappers = document.querySelectorAll('.barcode-wrapper');
              wrappers.forEach(w => {
                const val = w.getAttribute('data-val');
                const fmt = w.getAttribute('data-fmt');
                
                if (fmt === 'QR') {
                  const canvas = document.createElement('canvas');
                  canvas.className = 'qr-canvas';
                  w.appendChild(canvas);
                  QRCode.toCanvas(canvas, val, { width: 45, margin: 1 });
                } else {
                  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                  w.appendChild(svg);
                  JsBarcode(svg, val, {
                    format: fmt,
                    width: 1.2,
                    height: 25,
                    displayValue: true,
                    fontSize: 8,
                    margin: 1
                  });
                }
              });
              
              setTimeout(() => {
                window.print();
                window.close();
              }, 600);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const previewLabels = getLabelsList();

  return (
    <div className="view-section active">
      {/* Header Banner */}
      <div className="dashboard-header">
        <div>
          <h2 className="page-title">Avery 5160 Barcode Sheet Center</h2>
          <p className="page-subtitle">Compile and export perfect Avery 5160 labels (3 cols x 10 rows) for thermo or sheet printers.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn btn-outline" 
            onClick={handleDirectPrint}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Printer /> Direct Print Layout
          </button>
          <button 
            className="btn btn-primary" 
            disabled={pdfCompiling}
            onClick={handleCompilePDF}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <FilePdf /> {pdfCompiling ? 'Compiling PDF...' : 'Download PDF Sheet'}
          </button>
        </div>
      </div>

      {/* Columns: Selection table (Left) and Live Preview / Toggles (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '28px', alignItems: 'start' }}>
        
        {/* Left Column: Products checklist & quantities */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Select Products for Sheet</h3>
            <button 
              className="btn btn-outline" 
              onClick={handleSelectAll}
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            >
              {selectedProductIds.length === products.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>Print</th>
                  <th>Product Details</th>
                  <th>Barcode</th>
                  <th style={{ width: '100px' }}>Labels Qty</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="text-center text-muted" style={{ padding: '24px' }}>
                      Retrieving inventory lot items...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center text-muted" style={{ padding: '24px' }}>
                      No items registered in active brand context.
                    </td>
                  </tr>
                ) : (
                  products.map(p => {
                    const isSelected = selectedProductIds.includes(p.product_id);
                    return (
                      <tr 
                        key={p.product_id}
                        style={{ background: isSelected ? 'rgba(99, 102, 241, 0.03)' : 'none' }}
                      >
                        <td onClick={() => handleToggleSelect(p.product_id)} style={{ cursor: 'pointer' }}>
                          {isSelected ? (
                            <CheckSquare size={20} className="text-gradient" weight="fill" />
                          ) : (
                            <Square size={20} style={{ color: 'var(--border)' }} />
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.name}</div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SKU: {p.product_id}</span>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.barcode || 'N/A'}</span>
                        </td>
                        <td>
                          <input 
                            type="number"
                            className="form-input"
                            min="0"
                            style={{ padding: '4px 8px', textAlign: 'center', height: 'auto' }}
                            value={quantities[p.product_id] || 0}
                            disabled={!isSelected}
                            onChange={(e) => handleQtyChange(p.product_id, e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Customization Toggles & Mini Live Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Customization Settings Toggles */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Sliders /> Label Content Config
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Barcode Output Format</span>
                <select 
                  className="form-input" 
                  style={{ width: 'auto', padding: '6px 12px' }}
                  value={barcodeFormat}
                  onChange={e => setBarcodeFormat(e.target.value)}
                >
                  <option value="CODE128">Code 128 (Default)</option>
                  <option value="EAN13">EAN-13 (Numeric)</option>
                  <option value="QR">QR Code</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                <span style={{ fontSize: '0.85rem' }}>Include Product Name</span>
                <button 
                  onClick={() => setIncludeName(!includeName)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', padding: 0 }}
                >
                  {includeName ? <ToggleRight size={38} className="text-gradient" weight="fill" /> : <ToggleLeft size={38} style={{ color: 'var(--border)' }} />}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                <span style={{ fontSize: '0.85rem' }}>Include SKU / ID Code</span>
                <button 
                  onClick={() => setIncludeSKU(!includeSKU)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', padding: 0 }}
                >
                  {includeSKU ? <ToggleRight size={38} className="text-gradient" weight="fill" /> : <ToggleLeft size={38} style={{ color: 'var(--border)' }} />}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                <span style={{ fontSize: '0.85rem' }}>Include Wholesale Price</span>
                <button 
                  onClick={() => setIncludePrice(!includePrice)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', padding: 0 }}
                >
                  {includePrice ? <ToggleRight size={38} className="text-gradient" weight="fill" /> : <ToggleLeft size={38} style={{ color: 'var(--border)' }} />}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                <span style={{ fontSize: '0.85rem' }}>Include Corporate Brand Prefix</span>
                <button 
                  onClick={() => setIncludeBrand(!includeBrand)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', padding: 0 }}
                >
                  {includeBrand ? <ToggleRight size={38} className="text-gradient" weight="fill" /> : <ToggleLeft size={38} style={{ color: 'var(--border)' }} />}
                </button>
              </div>
            </div>
          </div>

          {/* Live Sheet Preview Widget */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 className="card-title" style={{ fontSize: '0.9rem', marginBottom: '14px' }}>
              Avery 5160 Live Layout Preview ({previewLabels.length} labels)
            </h3>
            
            {previewLabels.length === 0 ? (
              <div className="text-center text-muted" style={{ padding: '32px', fontSize: '0.85rem' }}>
                No active labels in selection list. Check some boxes on the left to preview!
              </div>
            ) : (
              <div 
                style={{ 
                  maxHeight: '300px', 
                  overflowY: 'auto', 
                  background: 'var(--bg-app)', 
                  padding: '16px', 
                  borderRadius: '12px',
                  border: '1px solid var(--border-light)' 
                }}
              >
                <div 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(3, 1fr)', 
                    gap: '8px', 
                    boxSizing: 'border-box' 
                  }}
                >
                  {previewLabels.slice(0, 15).map((p, i) => (
                    <div 
                      key={`${p.product_id}-${i}`}
                      className="glass-card"
                      style={{ 
                        border: '1px solid var(--border)', 
                        padding: '6px', 
                        borderRadius: '6px',
                        fontSize: '0.58rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        height: '62px',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          {includeBrand && <div style={{ fontSize: '0.38rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>{activeBrand.substring(0,10).toUpperCase()}</div>}
                          {includeName && <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '60px' }}>{p.name}</strong>}
                          {includeSKU && <span style={{ fontSize: '0.45rem', color: 'var(--text-muted)' }}>{p.product_id.substring(0, 10)}</span>}
                        </div>
                        {includePrice && <strong style={{ fontSize: '0.52rem' }}>₹{p.price}</strong>}
                      </div>
                      
                      {/* Barcode Mock visual */}
                      {barcodeFormat === 'QR' ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                          <div style={{ width: '16px', height: '16px', background: '#000000', borderRadius: '2px' }}></div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', marginTop: '2px' }}>
                          <div style={{ display: 'flex', gap: '1px', height: '10px', width: '100%', background: 'linear-gradient(90deg, #000 1px, transparent 1px, #000 3px, transparent 3px, #000 4px, transparent 4px, #000 6px, transparent 6px, #000 7px)' }}></div>
                          <span style={{ fontSize: '0.42rem', color: 'var(--text-muted)', textAlign: 'center', fontFamily: 'monospace' }}>
                            {p.barcode || p.product_id.substring(0, 8)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                  {previewLabels.length > 15 && (
                    <div 
                      colSpan="3" 
                      style={{ 
                        gridColumn: '1 / -1', 
                        textAlign: 'center', 
                        fontSize: '0.72rem', 
                        color: 'var(--text-muted)', 
                        padding: '6px 0',
                        fontWeight: 600
                      }}
                    >
                      ... and {previewLabels.length - 15} more labels previewed.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

export default BarcodeSheet;

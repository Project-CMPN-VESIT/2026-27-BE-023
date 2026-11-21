import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Hexagon, SquaresFour, Package, TrendUp, 
  Stack, Brain, ChartBar, UploadSimple, House, UserCheck, Sparkle, UsersThree, Bell, Barcode
} from '@phosphor-icons/react';

const Sidebar = ({ user }) => {
  const role = user ? user.role : 'admin';

  // Role lists
  const canSeeSales = role === 'admin' || role === 'staff';
  const canSeeImport = role === 'admin' || role === 'staff';
  const canSeePredictions = role === 'admin' || role === 'warehouse_manager';
  const canSeeReports = role === 'admin';
  const canSeeWarehouse = role === 'admin' || role === 'warehouse_manager';
  const canSeeSuppliers = role === 'admin' || role === 'warehouse_manager';
  const canSeeInventory = role === 'admin' || role === 'warehouse_manager';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-icon">
          <Hexagon weight="fill" />
        </div>
        <h1 className="logo-text">Invent<span className="text-gradient">AI</span></h1>
      </div>
      
      <nav className="sidebar-nav">
        <div className="nav-section-title">MAIN MENU</div>
        <ul className="nav-list">
          <li className="nav-item">
            <NavLink to="/dashboard" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
              <SquaresFour />
              <span>Dashboard</span>
            </NavLink>
          </li>
          
          <li className="nav-item">
            <NavLink to="/alerts" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
              <Bell />
              <span>System Alerts</span>
            </NavLink>
          </li>
          
          <li className="nav-item">
            <NavLink to="/products" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
              <Package />
              <span>Products</span>
            </NavLink>
          </li>
          
          <li className="nav-item">
            <NavLink to="/barcodes" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
              <Barcode />
              <span>Print Barcodes</span>
            </NavLink>
          </li>
          
          {canSeeSales && (
            <li className="nav-item">
              <NavLink to="/sales" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
                <TrendUp />
                <span>Sales</span>
              </NavLink>
            </li>
          )}
          
          {canSeeInventory && (
            <li className="nav-item">
              <NavLink to="/inventory" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
                <Stack />
                <span>Inventory</span>
              </NavLink>
            </li>
          )}

          {canSeeWarehouse && (
            <li className="nav-item">
              <NavLink to="/warehouse" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
                <House />
                <span>Warehouse Location</span>
              </NavLink>
            </li>
          )}

          {canSeeSuppliers && (
            <li className="nav-item">
              <NavLink to="/suppliers" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
                <UserCheck />
                <span>Suppliers & PO</span>
              </NavLink>
            </li>
          )}
          
          {canSeePredictions && (
            <li className="nav-item">
              <NavLink to="/predictions" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
                <Brain />
                <span>Predictions</span>
                <span className="badge badge-primary">AI</span>
              </NavLink>
            </li>
          )}
          
          {canSeeReports && (
            <li className="nav-item">
              <NavLink to="/reports" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
                <ChartBar />
                <span>Reports</span>
              </NavLink>
            </li>
          )}
          
          {canSeeImport && (
            <li className="nav-item">
              <NavLink to="/import" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
                <UploadSimple />
                <span>Import Data</span>
              </NavLink>
            </li>
          )}

          {role === 'admin' && (
            <li className="nav-item">
              <NavLink to="/staff" className={({ isActive }) => "nav-link" + (isActive ? " active" : "")}>
                <UsersThree />
                <span>Staff Management</span>
              </NavLink>
            </li>
          )}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="premium-card">
          <div className="premium-icon">
            <Sparkle weight="fill" />
          </div>
          <div className="premium-text">
            <h4>InventAI Portal</h4>
            <p>Access level: {role.toUpperCase()}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

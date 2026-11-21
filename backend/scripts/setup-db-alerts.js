const { Client } = require('pg');
require('dotenv').config({ path: 'd:/college/FinalProject/backend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const DB_PASSWORD = process.env.DB_PASSWORD;

if (!SUPABASE_URL || !DB_PASSWORD) {
  console.error("❌ ERROR: Missing Supabase credentials in .env");
  process.exit(1);
}

const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
const dbHost = `db.${projectRef}.supabase.co`;
const connectionString = `postgresql://postgres:${DB_PASSWORD}@${dbHost}:5432/postgres`;

const client = new Client({
  connectionString,
});

const ddlSQL = `
-- 1. Alter or Recreate Alerts Table to be highly comprehensive
DROP TABLE IF EXISTS alerts CASCADE;

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id TEXT UNIQUE, -- human-readable ID like 'ALT-1002'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL DEFAULT 'Low' CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    module TEXT NOT NULL DEFAULT 'Inventory' CHECK (module IN ('Inventory', 'AI Forecasting', 'Suppliers', 'Purchase Orders', 'Sales', 'Finance', 'Staff', 'Security', 'System Health')),
    entity_id TEXT, -- ID of the affected product, PO, employee, etc.
    entity_type TEXT, -- e.g. 'product', 'purchase_order', 'employee', 'user'
    status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'resolved')),
    action_required TEXT, -- Suggested action details
    resolved_by TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    brand TEXT NOT NULL DEFAULT 'Apparel & Fashion',
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Alert Rules Table (User-Configurable Thresholds)
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    module TEXT NOT NULL,
    metric TEXT NOT NULL, -- e.g. 'stock_level', 'absentee_rate', 'po_delay_days'
    operator TEXT NOT NULL CHECK (operator IN ('<', '>', '==', '<=', '>=')),
    value NUMERIC NOT NULL,
    severity TEXT NOT NULL DEFAULT 'Medium' CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    is_active BOOLEAN DEFAULT TRUE,
    brand TEXT NOT NULL DEFAULT 'Apparel & Fashion',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Notification Preferences Table
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_role TEXT NOT NULL, -- e.g. 'admin', 'staff', 'manager'
    module TEXT NOT NULL,
    channels TEXT[] DEFAULT ARRAY['toast', 'bell'], -- channels enabled
    sound_enabled BOOLEAN DEFAULT TRUE,
    brand TEXT NOT NULL DEFAULT 'Apparel & Fashion',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_role_module_brand UNIQUE(user_role, module, brand)
);
`;

const seedSQL = `
-- Seed default rules for Apparel & Fashion
INSERT INTO alert_rules (name, module, metric, operator, value, severity, brand) VALUES
('Default Low Stock Rule', 'Inventory', 'stock_level', '<', 15, 'High', 'Apparel & Fashion'),
('Dynamic Safety Threshold Guard', 'AI Forecasting', 'predicted_stockout', '<=', 4, 'Critical', 'Apparel & Fashion'),
('Supplier Delivery Guarantee', 'Suppliers', 'reliability_rate', '<', 75, 'Medium', 'Apparel & Fashion'),
('Absentee Staff Threshold', 'Staff', 'absent_count', '>=', 3, 'High', 'Apparel & Fashion'),
('Monthly Budget Cap', 'Finance', 'expense_ratio', '>', 90, 'High', 'Apparel & Fashion')
ON CONFLICT DO NOTHING;

-- Seed default rules for Electronics & Gadgets
INSERT INTO alert_rules (name, module, metric, operator, value, severity, brand) VALUES
('Default Low Stock Rule', 'Inventory', 'stock_level', '<', 20, 'High', 'Electronics & Gadgets'),
('Dynamic Safety Threshold Guard', 'AI Forecasting', 'predicted_stockout', '<=', 5, 'Critical', 'Electronics & Gadgets')
ON CONFLICT DO NOTHING;

-- Seed default Notification Preferences
INSERT INTO notification_preferences (user_role, module, channels, sound_enabled, brand) VALUES
('admin', 'Inventory', ARRAY['toast', 'bell'], TRUE, 'Apparel & Fashion'),
('admin', 'AI Forecasting', ARRAY['toast', 'bell'], TRUE, 'Apparel & Fashion'),
('admin', 'Staff', ARRAY['toast', 'bell'], TRUE, 'Apparel & Fashion'),
('admin', 'Finance', ARRAY['toast', 'bell'], TRUE, 'Apparel & Fashion'),
('admin', 'Security', ARRAY['toast', 'bell'], TRUE, 'Apparel & Fashion'),
('manager', 'Inventory', ARRAY['toast', 'bell'], TRUE, 'Apparel & Fashion'),
('manager', 'Purchase Orders', ARRAY['toast', 'bell'], FALSE, 'Apparel & Fashion'),
('staff', 'Inventory', ARRAY['toast', 'bell'], FALSE, 'Apparel & Fashion')
ON CONFLICT (user_role, module, brand) DO NOTHING;

-- Seed high-fidelity sample alerts
INSERT INTO alerts (alert_id, title, message, description, severity, module, entity_id, entity_type, status, action_required, brand) VALUES
('ALT-1001', 'Critical Low Stock: Joggers', 'Joggers stock has fallen below dynamic safety limit.', 'Current stock is 8 cartons, while the safety threshold is 15. A restock is urgently recommended.', 'Critical', 'Inventory', 'PRD-05', 'product', 'unread', 'Draft a Purchase Order for 24 cartons of Joggers from KnitWear Wholesale.', 'Apparel & Fashion'),
('ALT-1002', 'Staff Absences Peak', 'High absentee rate registered today: 3 employees absent.', ' Sarah D''Souza, Priya Nair are logged as absent today, leading to 25% warehouse capacity reduction.', 'High', 'Staff', 'Staff-Daily', 'employee', 'unread', 'Adjust dispatch schedule or allocate overtime bonuses to available staff.', 'Apparel & Fashion'),
('ALT-1003', 'AI Forecast: Demand Spike Predicted', 'AI model predicts 230% increase in Oversized Hoodie demand.', 'XGBoost forecaster predicts a major sales run during the upcoming Winter Festival peak weekend.', 'Medium', 'AI Forecasting', 'PRD-01', 'product', 'unread', 'Place restock orders of 35 cartons of Hoodies to avoid stockout.', 'Apparel & Fashion'),
('ALT-1004', 'Delayed Supplier Delivery', 'Replenishment order PO-102 is delayed by 3 days.', 'KnitWear Wholesale reported carrier dispatch delays on PO-102 containing 50 cartons.', 'Medium', 'Purchase Orders', 'PO-102', 'purchase_order', 'unread', 'Contact supplier vendor at knitwear@wholesale.com for freight track updates.', 'Apparel & Fashion'),
('ALT-1005', 'Suspicious Login Attempt', 'Multiple failed login attempts detected for Admin account.', '4 failed attempts registered from IP 192.168.1.105 within a 2-minute period.', 'High', 'Security', 'admin', 'user', 'unread', 'Review security audit logs and consider password rotations.', 'Apparel & Fashion');
`;

async function run() {
  try {
    console.log(`Connecting to Supabase PostgreSQL at ${dbHost}...`);
    await client.connect();

    console.log("Applying database migrations for Alerts V2, Rules, and Preferences...");
    await client.query(ddlSQL);
    console.log("✅ Tables successfully upgraded!");

    console.log("Seeding default Alert Rules, Notification Preferences, and high-fidelity Alerts...");
    await client.query(seedSQL);
    console.log("✅ Seed data successfully inserted!");

  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    await client.end();
  }
}

run();

const { Client } = require('pg');
require('dotenv').config();

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
-- Drop tables if they exist to start fresh and clean (ordered by constraints)
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS salary_records CASCADE;
DROP TABLE IF EXISTS work_logs CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS employees CASCADE;

-- 1. Employees Table
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT,
    email TEXT UNIQUE,
    joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
    monthly_salary NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Attendance Table
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Leave', 'Half Day')),
    working_hours NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_date UNIQUE(employee_id, date)
);

-- 3. Work Logs Table
CREATE TABLE work_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    tasks_completed TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_date_work_logs UNIQUE(employee_id, date)
);

-- 4. Salary Records Table
CREATE TABLE salary_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- format 'YYYY-MM'
    base_salary NUMERIC NOT NULL DEFAULT 0,
    bonus NUMERIC NOT NULL DEFAULT 0,
    deductions NUMERIC NOT NULL DEFAULT 0,
    net_salary NUMERIC NOT NULL DEFAULT 0,
    paid_amount NUMERIC NOT NULL DEFAULT 0,
    pending_dues NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (status IN ('Paid', 'Partial', 'Unpaid')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_month UNIQUE(employee_id, month)
);

-- 5. Payments Table (Tracks individual salary transactions)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    salary_record_id UUID REFERENCES salary_records(id) ON DELETE CASCADE,
    amount_paid NUMERIC NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Bank Transfer', 'Cash', 'Cheque', 'UPI')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

async function setupStaffDatabase() {
  try {
    console.log(`Connecting to Supabase PostgreSQL at ${dbHost}...`);
    await client.connect();
    
    console.log("Applying database DDL migrations for Staff & Payroll module...");
    await client.query(ddlSQL);
    console.log("✅ Tables successfully created!");

    console.log("Seeding high-fidelity Staff, Attendance, Work Logs, Salaries, and Payments...");

    // Seed 4 Employees (3 active, 1 inactive)
    const empInsertQuery = `
      INSERT INTO employees (full_name, role, phone, email, joining_date, monthly_salary, status)
      VALUES 
        ('Rohan Sharma', 'Procurement Lead', '+91 98765 43210', 'rohan@inventai.com', '2026-01-10', 45000, 'Active'),
        ('Sarah D''Souza', 'Logistics Coordinator', '+91 87654 32109', 'sarah@inventai.com', '2026-02-15', 35000, 'Active'),
        ('Arjun Patel', 'Warehouse Associate', '+91 76543 21098', 'arjun@inventai.com', '2026-03-01', 25000, 'Active'),
        ('Priya Nair', 'Data Assistant', '+91 65432 10987', 'priya@inventai.com', '2025-11-20', 28000, 'Inactive')
      RETURNING id, full_name;
    `;

    const empRes = await client.query(empInsertQuery);
    const empMap = {};
    empRes.rows.forEach(row => {
      empMap[row.full_name] = row.id;
    });

    const rohanId = empMap['Rohan Sharma'];
    const sarahId = empMap["Sarah D'Souza"];
    const arjunId = empMap['Arjun Patel'];

    // Seed Attendance & Daily Work Logs for the past 5 days: 2026-05-18 to 2026-05-22
    const dates = ['2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21', '2026-05-22'];

    // 1. Rohan Sharma: Present all 5 days
    for (const d of dates) {
      await client.query(`
        INSERT INTO attendance (employee_id, date, status, working_hours, notes)
        VALUES ('${rohanId}', '${d}', 'Present', 8, 'Full Shift completed')
      `);
    }
    await client.query(`
      INSERT INTO work_logs (employee_id, date, tasks_completed, notes) VALUES
      ('${rohanId}', '2026-05-18', 'Completed physical inventory count for active SKU lots', 'Aisles A to C verified'),
      ('${rohanId}', '2026-05-19', 'Drafted two new B2B replenishment purchase orders', 'Orders sent to ElectroMax & Apex Chipset'),
      ('${rohanId}', '2026-05-20', 'Conducted supplier pricing coordination negotiations', 'Procured 15% discount for bulk orders'),
      ('${rohanId}', '2026-05-21', 'Analyzed dead stock list and pricing target recommendations', 'Discounts applied to slow-moving electronics'),
      ('${rohanId}', '2026-05-22', 'Conducted weekly audit log reconciliations and team briefs', 'All systems checked')
    `);

    // 2. Sarah D'Souza: Present 4 days, Absent 1 day (May 20)
    for (const d of dates) {
      const isAbsent = d === '2026-05-20';
      await client.query(`
        INSERT INTO attendance (employee_id, date, status, working_hours, notes)
        VALUES ('${sarahId}', '${d}', '${isAbsent ? 'Absent' : 'Present'}', ${isAbsent ? 0 : 8}, '${isAbsent ? 'Sick Leave' : 'Full Shift completed'}')
      `);
      if (!isAbsent) {
        let task = "Inspected damaged box returns in Aisle A-2";
        if (d === '2026-05-18') task = "Logged returned shipment carton invoices";
        if (d === '2026-05-19') task = "Mapped warehouse lots using barcoding index";
        if (d === '2026-05-21') task = "Coordinated high-velocity dispatch dispatches with Apex";
        if (d === '2026-05-22') task = "Swept warehouse zones and checked safety gears";

        await client.query(`
          INSERT INTO work_logs (employee_id, date, tasks_completed, notes)
          VALUES ('${sarahId}', '${d}', '${task}', 'Good productivity')
        `);
      }
    }

    // 3. Arjun Patel: Present 4 days, Leave 1 day (May 21)
    for (const d of dates) {
      const isLeave = d === '2026-05-21';
      await client.query(`
        INSERT INTO attendance (employee_id, date, status, working_hours, notes)
        VALUES ('${arjunId}', '${d}', '${isLeave ? 'Leave' : 'Present'}', ${isLeave ? 0 : 8}, '${isLeave ? 'Casual Leave Approved' : 'Full Shift completed'}')
      `);
      if (!isLeave) {
        let task = "Loaded 45 cartons onto dispatch delivery trucks";
        if (d === '2026-05-18') task = "Swept loading docks and organized pallets";
        if (d === '2026-05-19') task = "Moped aisle corridors and cleared packaging boxes";
        if (d === '2026-05-20') task = "Scanned incoming supplier deliveries";
        if (d === '2026-05-22') task = "Conducted routine forklift maintenance checks";

        await client.query(`
          INSERT INTO work_logs (employee_id, date, tasks_completed, notes)
          VALUES ('${arjunId}', '${d}', '${task}', 'Work completed on time')
        `);
      }
    }

    // 4. Seed Salary Records (Payroll)
    // April 2026 (All paid)
    const salAprilRohan = await client.query(`
      INSERT INTO salary_records (employee_id, month, base_salary, bonus, deductions, net_salary, paid_amount, pending_dues, status)
      VALUES ('${rohanId}', '2026-04', 45000, 2000, 0, 47000, 47000, 0, 'Paid') RETURNING id;
    `);
    const salAprilSarah = await client.query(`
      INSERT INTO salary_records (employee_id, month, base_salary, bonus, deductions, net_salary, paid_amount, pending_dues, status)
      VALUES ('${sarahId}', '2026-04', 35000, 0, 1000, 34000, 34000, 0, 'Paid') RETURNING id;
    `);
    const salAprilArjun = await client.query(`
      INSERT INTO salary_records (employee_id, month, base_salary, bonus, deductions, net_salary, paid_amount, pending_dues, status)
      VALUES ('${arjunId}', '2026-04', 25000, 500, 0, 25500, 25500, 0, 'Paid') RETURNING id;
    `);

    // May 2026 (Partially paid / Unpaid)
    const salMayRohan = await client.query(`
      INSERT INTO salary_records (employee_id, month, base_salary, bonus, deductions, net_salary, paid_amount, pending_dues, status)
      VALUES ('${rohanId}', '2026-05', 45000, 1500, 0, 46500, 30000, 16500, 'Partial') RETURNING id;
    `);
    const salMaySarah = await client.query(`
      INSERT INTO salary_records (employee_id, month, base_salary, bonus, deductions, net_salary, paid_amount, pending_dues, status)
      VALUES ('${sarahId}', '2026-05', 35000, 0, 1500, 33500, 10000, 23500, 'Partial') RETURNING id;
    `);
    const salMayArjun = await client.query(`
      INSERT INTO salary_records (employee_id, month, base_salary, bonus, deductions, net_salary, paid_amount, pending_dues, status)
      VALUES ('${arjunId}', '2026-05', 25000, 0, 0, 25000, 0, 25000, 'Unpaid') RETURNING id;
    `);

    // 5. Seed Payments Records matching these
    // April payments on 2026-05-02
    await client.query(`
      INSERT INTO payments (employee_id, salary_record_id, amount_paid, payment_date, payment_method, notes) VALUES
      ('${rohanId}', '${salAprilRohan.rows[0].id}', 47000, '2026-05-02', 'Bank Transfer', 'April salary full settlement'),
      ('${sarahId}', '${salAprilSarah.rows[0].id}', 34000, '2026-05-02', 'Bank Transfer', 'April salary, including leave deduction'),
      ('${arjunId}', '${salAprilArjun.rows[0].id}', 25500, '2026-05-02', 'Cash', 'April salary with overtime bonus')
    `);

    // May partial payments on 2026-05-15 and 2026-05-18
    await client.query(`
      INSERT INTO payments (employee_id, salary_record_id, amount_paid, payment_date, payment_method, notes) VALUES
      ('${rohanId}', '${salMayRohan.rows[0].id}', 30000, '2026-05-15', 'Bank Transfer', 'May mid-month advance pay'),
      ('${sarahId}', '${salMaySarah.rows[0].id}', 10000, '2026-05-18', 'UPI', 'Emergency salary advance request')
    `);

    console.log("✅ Seeding of Staff Management Relational Database Tables complete!");

  } catch (err) {
    console.error("❌ Seeding failed:", err.message);
  } finally {
    await client.end();
  }
}

setupStaffDatabase();

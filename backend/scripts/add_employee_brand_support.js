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
-- Drop tables if they exist to apply fresh schema (ordered by constraints)
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS salary_records CASCADE;
DROP TABLE IF EXISTS work_logs CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS employees CASCADE;

-- 1. Employees Table with brand column and index
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT,
    email TEXT UNIQUE,
    joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
    monthly_salary NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    brand TEXT NOT NULL DEFAULT 'Apparel & Fashion',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_employees_brand ON employees(brand);

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

const industryEmployees = {
  'Apparel & Fashion': [
    { name: 'Rohan Sharma', role: 'Procurement Lead', phone: '+91 98765 43210', email: 'rohan.apparel@inventai.com', salary: 45000, date: '2026-01-10', status: 'Active' },
    { name: "Sarah D'Souza", role: 'Logistics Coordinator', phone: '+91 87654 32109', email: 'sarah.apparel@inventai.com', salary: 35000, date: '2026-02-15', status: 'Active' },
    { name: 'Arjun Patel', role: 'Warehouse Associate', phone: '+91 76543 21098', email: 'arjun.apparel@inventai.com', salary: 25000, date: '2026-03-01', status: 'Active' },
    { name: 'Priya Nair', role: 'Data Assistant', phone: '+91 65432 10987', email: 'priya.apparel@inventai.com', salary: 28000, date: '2025-11-20', status: 'Inactive' }
  ],
  'Electronics & Gadgets': [
    { name: 'Vikram Malhotra', role: 'Technical Operations', phone: '+91 99999 12345', email: 'vikram.electronics@inventai.com', salary: 55000, date: '2026-01-15', status: 'Active' },
    { name: 'Neha Gupta', role: 'Quality Inspector', phone: '+91 88888 23456', email: 'neha.electronics@inventai.com', salary: 40000, date: '2026-02-20', status: 'Active' },
    { name: 'Rahul Verma', role: 'Inventory Analyst', phone: '+91 77777 34567', email: 'rahul.electronics@inventai.com', salary: 30000, date: '2026-03-05', status: 'Active' },
    { name: 'Tanya Sen', role: 'Support Agent', phone: '+91 66666 45678', email: 'tanya.electronics@inventai.com', salary: 27000, date: '2025-12-01', status: 'Inactive' }
  ],
  'FMCG & Pantry': [
    { name: 'Amit Patel', role: 'Supply Chain Manager', phone: '+91 95555 11111', email: 'amit.fmcg@inventai.com', salary: 48000, date: '2026-01-05', status: 'Active' },
    { name: 'Pooja Sharma', role: 'Freshness Supervisor', phone: '+91 94444 22222', email: 'pooja.fmcg@inventai.com', salary: 32000, date: '2026-02-10', status: 'Active' },
    { name: 'Kabir Sen', role: 'Logistics Planner', phone: '+91 93333 33333', email: 'kabir.fmcg@inventai.com', salary: 28000, date: '2026-02-28', status: 'Active' },
    { name: 'Maya Roy', role: 'Product Assistant', phone: '+91 92222 44444', email: 'maya.fmcg@inventai.com', salary: 25000, date: '2025-10-15', status: 'Inactive' }
  ],
  'Pharma & Cosmetics': [
    { name: 'Dr. Ananya Rao', role: 'Regulatory Compliance', phone: '+91 99999 55555', email: 'ananya.pharma@inventai.com', salary: 65000, date: '2025-09-01', status: 'Active' },
    { name: 'Divya Teja', role: 'Storage Safety Lead', phone: '+91 88888 66666', email: 'divya.pharma@inventai.com', salary: 42000, date: '2026-01-20', status: 'Active' },
    { name: 'Sandeep Singh', role: 'Cold Chain Operator', phone: '+91 77777 77777', email: 'sandeep.pharma@inventai.com', salary: 29000, date: '2026-02-18', status: 'Active' },
    { name: 'Riya Sen', role: 'Lab Assistant', phone: '+91 66666 88888', email: 'riya.pharma@inventai.com', salary: 31000, date: '2025-11-01', status: 'Inactive' }
  ],
  'Hardware & Power Tools': [
    { name: 'Baldev Singh', role: 'Heavy Lot Inspector', phone: '+91 91111 99999', email: 'baldev.hardware@inventai.com', salary: 43000, date: '2026-01-08', status: 'Active' },
    { name: 'Gurpreet Kaur', role: 'B2B Tool Specialist', phone: '+91 92222 88888', email: 'gurpreet.hardware@inventai.com', salary: 38000, date: '2026-02-12', status: 'Active' },
    { name: 'Maninder Gill', role: 'Warehouse Overseer', phone: '+91 93333 77777', email: 'maninder.hardware@inventai.com', salary: 26000, date: '2026-03-10', status: 'Active' },
    { name: 'Simran Sandhu', role: 'Logistics Assistant', phone: '+91 94444 66666', email: 'simran.hardware@inventai.com', salary: 24000, date: '2025-11-15', status: 'Inactive' }
  ]
};

const mockTasks = {
  'Apparel & Fashion': [
    "Completed physical inventory count for active SKU clothing lots",
    "Drafted two new B2B replenishment purchase orders for sweaters",
    "Conducted supplier pricing coordination negotiations with Knitwear",
    "Analyzed dead stock list and pricing discount targets for crop tops",
    "Conducted weekly audit log reconciliations and team briefs"
  ],
  'Electronics & Gadgets': [
    "Verified voltage stability calibration on new smartphone batches",
    "Drafted bulk imports of laptop components from APEX Corp",
    "Resolved warranty repair return tickets for Bluetooth audio lots",
    "Updated dynamic safety thresholds for hot-selling smartwatches",
    "Ran diagnostic analytics reports on dead stock SSD inventories"
  ],
  'FMCG & Pantry': [
    "Inspected cold-storage temperature logs for yogurt consignments",
    "Coordinated quick dispatch loading with Heritage Farms logistics",
    "Inspected expiry date labels across dry food beverage aisles",
    "Updated B2B delivery schedules for organic almond milk cartons",
    "Completed weekly cleanliness audits across grain silos"
  ],
  'Pharma & Cosmetics': [
    "Verified regulatory safety compliance seals on vaccine shipment",
    "Logged temperature readings in chemical compound deep freezers",
    "Conducted quality checks on cosmetics lot batch stampings",
    "Coordinated regulatory audit clearance logs with PureShield team",
    "Conducted weekly sterile sanitation procedures in dispatch zone"
  ],
  'Hardware & Power Tools': [
    "Verified load tests on high-impact rotary hammer drill lot",
    "Inspected protective safety gear lot dispatch certifications",
    "Sorted high-tensile steel fasteners in bin locations Rack F-2",
    "Negotiated steel volume replenishment rates with Ludhiana steel",
    "Conducted structural checks on forklift loading platforms"
  ]
};

async function migrate() {
  try {
    console.log(`Connecting to Supabase PostgreSQL at ${dbHost}...`);
    await client.connect();

    console.log("Applying database schema DDL migrations for brand-scoped Employees registry...");
    await client.query(ddlSQL);
    console.log("✅ Tables successfully created!");

    console.log("Seeding unique employee rosters, attendance, tasks, and payrolls for all 5 industries...");
    const dates = ['2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21', '2026-05-22'];

    for (const [brand, employees] of Object.entries(industryEmployees)) {
      console.log(`\n🌱 Seeding brand registry: '${brand}'...`);

      // 1. Insert Employees
      for (const emp of employees) {
        const empInsert = await client.query(`
          INSERT INTO employees (full_name, role, phone, email, joining_date, monthly_salary, status, brand)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, full_name
        `, [emp.name, emp.role, emp.phone, emp.email, emp.date, emp.salary, emp.status, brand]);

        const empId = empInsert.rows[0].id;
        const name = empInsert.rows[0].full_name;

        // Skip other seed records for inactive employee
        if (emp.status === 'Inactive') continue;

        // 2. Seed Attendance & Work Logs
        for (let i = 0; i < dates.length; i++) {
          const d = dates[i];
          
          // Custom attendance status distributions
          let status = 'Present';
          let hours = 8;
          let attNote = 'Full Shift completed';
          
          if (name.includes('Sarah') && d === '2026-05-20') {
            status = 'Absent'; hours = 0; attNote = 'Sick Leave';
          } else if (name.includes('Arjun') && d === '2026-05-21') {
            status = 'Leave'; hours = 0; attNote = 'Casual Leave Approved';
          } else if (name.includes('Neha') && d === '2026-05-19') {
            status = 'Half Day'; hours = 4; attNote = 'Doctor appointment';
          } else if (name.includes('Pooja') && d === '2026-05-21') {
            status = 'Absent'; hours = 0; attNote = 'Family emergency';
          } else if (name.includes('Sandeep') && d === '2026-05-18') {
            status = 'Half Day'; hours = 4; attNote = 'Personal commitment';
          } else if (name.includes('Gurpreet') && d === '2026-05-22') {
            status = 'Leave'; hours = 0; attNote = 'Approved day off';
          }

          // Save Attendance
          await client.query(`
            INSERT INTO attendance (employee_id, date, status, working_hours, notes)
            VALUES ($1, $2, $3, $4, $5)
          `, [empId, d, status, hours, attNote]);

          // Save Work Log (if present or half-day)
          if (status === 'Present' || status === 'Half Day') {
            const taskList = mockTasks[brand];
            const task = taskList[i % taskList.length];
            await client.query(`
              INSERT INTO work_logs (employee_id, date, tasks_completed, notes)
              VALUES ($1, $2, $3, $4)
            `, [empId, d, task, 'Satisfactory operational standards']);
          }
        }

        // 3. Seed Salary Records (April & May 2026)
        // April: Paid fully
        const base = Number(emp.salary);
        const bonusApr = name.includes('Rohan') || name.includes('Vikram') || name.includes('Ananya') ? 2000 : 0;
        const dedApr = name.includes('Sarah') || name.includes('Neha') ? 1000 : 0;
        const netApr = base + bonusApr - dedApr;

        const salAprInsert = await client.query(`
          INSERT INTO salary_records (employee_id, month, base_salary, bonus, deductions, net_salary, paid_amount, pending_dues, status)
          VALUES ($1, '2026-04', $2, $3, $4, $5, $6, 0, 'Paid')
          RETURNING id
        `, [empId, base, bonusApr, dedApr, netApr, netApr]);

        const salAprId = salAprInsert.rows[0].id;

        // Add April Payment
        await client.query(`
          INSERT INTO payments (employee_id, salary_record_id, amount_paid, payment_date, payment_method, notes)
          VALUES ($1, $2, $3, '2026-05-02', 'Bank Transfer', 'April salary full settlement')
        `, [empId, salAprId, netApr]);

        // May: Partially Paid
        const bonusMay = name.includes('Rohan') || name.includes('Amit') ? 1500 : 0;
        const dedMay = name.includes('Sarah') || name.includes('Divya') ? 1500 : 0;
        const netMay = base + bonusMay - dedMay;
        
        let paidMay = 0;
        let statusMay = 'Unpaid';
        
        if (name.includes('Rohan') || name.includes('Vikram') || name.includes('Amit') || name.includes('Ananya') || name.includes('Baldev')) {
          paidMay = Math.round(netMay * 0.65);
          statusMay = 'Partial';
        } else if (name.includes('Sarah') || name.includes('Pooja') || name.includes('Divya') || name.includes('Gurpreet')) {
          paidMay = Math.round(netMay * 0.3);
          statusMay = 'Partial';
        }

        const pendingMay = netMay - paidMay;

        const salMayInsert = await client.query(`
          INSERT INTO salary_records (employee_id, month, base_salary, bonus, deductions, net_salary, paid_amount, pending_dues, status)
          VALUES ($1, '2026-05', $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `, [empId, base, bonusMay, dedMay, netMay, paidMay, pendingMay, statusMay]);

        const salMayId = salMayInsert.rows[0].id;

        // Add May Payment if partially paid
        if (paidMay > 0) {
          const method = name.includes('Sarah') || name.includes('Divya') ? 'UPI' : 'Bank Transfer';
          await client.query(`
            INSERT INTO payments (employee_id, salary_record_id, amount_paid, payment_date, payment_method, notes)
            VALUES ($1, $2, $3, '2026-05-18', $4, 'Emergency mid-month advance pay')
          `, [empId, salMayId, paidMay, method]);
        }
      }
    }

    console.log("\n✅ ALL brand-scoped employees databases fully migrated and seeded simultaneously!");

  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    await client.end();
  }
}

migrate();

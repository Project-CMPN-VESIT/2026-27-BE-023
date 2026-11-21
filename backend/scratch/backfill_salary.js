require('dotenv').config();
const supabase = require('../config/db');

async function backfill() {
  try {
    // Find nileshh
    const { data: employee, error: empErr } = await supabase
      .from('employees')
      .select('*')
      .eq('full_name', 'nileshh')
      .single();

    if (empErr || !employee) {
      console.error("Failed to find employee nileshh:", empErr);
      return;
    }

    console.log("Found nileshh:", employee);

    // Check if salary record already exists for 2026-05
    const { data: existing, error: existErr } = await supabase
      .from('salary_records')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('month', '2026-05')
      .maybeSingle();

    if (existing) {
      console.log("Salary record for 2026-05 already exists:", existing);
      return;
    }

    // Insert salary record
    const base = employee.monthly_salary || 0;
    const { data: inserted, error: insErr } = await supabase
      .from('salary_records')
      .insert([
        {
          employee_id: employee.id,
          month: '2026-05',
          base_salary: base,
          bonus: 0,
          deductions: 0,
          net_salary: base,
          paid_amount: 0,
          pending_dues: base,
          status: 'Unpaid'
        }
      ])
      .select()
      .single();

    if (insErr) {
      console.error("Failed to insert salary record:", insErr);
      return;
    }

    console.log("Successfully inserted salary record:", inserted);
  } catch (err) {
    console.error(err);
  }
}

backfill();

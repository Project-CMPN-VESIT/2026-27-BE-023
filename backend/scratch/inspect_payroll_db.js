require('dotenv').config();
const supabase = require('../config/db');

async function inspect() {
  try {
    const { data: employees, error: empErr } = await supabase.from('employees').select('*').limit(10);
    console.log("Employees in DB:", employees);
    if (empErr) console.error("Employees Err:", empErr);

    const { data: salaryRecords, error: salErr } = await supabase.from('salary_records').select('*').limit(10);
    console.log("Salary records in DB:", salaryRecords);
    if (salErr) console.error("Salary Records Err:", salErr);
  } catch (err) {
    console.error(err);
  }
}

inspect();

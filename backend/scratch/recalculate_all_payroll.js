require('dotenv').config();
const supabase = require('../config/db');

async function recalculate() {
  try {
    const { data: records, error: recErr } = await supabase
      .from('salary_records')
      .select('*');

    if (recErr) {
      console.error("Failed to fetch salary records:", recErr);
      return;
    }

    console.log(`Found ${records.length} salary records to recalculate.`);

    for (const rec of records) {
      const base = Number(rec.base_salary);
      const bon = Number(rec.bonus);
      const ded = Number(rec.deductions);
      const paid = Number(rec.paid_amount) || 0;
      const employee_id = rec.employee_id;
      const month = rec.month;

      // 1. Calculate days in month
      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const monthIdx = parseInt(monthStr, 10);
      const daysInMonth = new Date(year, monthIdx, 0).getDate();

      // 2. Fetch absent count
      const { data: attList } = await supabase
        .from('attendance')
        .select('date')
        .eq('employee_id', employee_id)
        .eq('status', 'Absent');

      const absentCount = attList ? attList.filter(a => a.date && a.date.startsWith(month)).length : 0;
      const dailyRate = daysInMonth > 0 ? (base / daysInMonth) : 0;
      const absentDeduction = Math.round(absentCount * dailyRate);

      const net = Math.max(0, base + bon - ded - absentDeduction);
      const pending = Math.max(0, net - paid);
      
      let status = 'Unpaid';
      if (pending === 0) {
        status = 'Paid';
      } else if (paid > 0) {
        status = 'Partial';
      }

      const { data: updated, error: upErr } = await supabase
        .from('salary_records')
        .update({
          absent_days: absentCount,
          absent_deduction: absentDeduction,
          net_salary: net,
          pending_dues: pending,
          status: status
        })
        .eq('id', rec.id)
        .select()
        .single();

      if (upErr) {
        console.error(`Failed to update record ID ${rec.id}:`, upErr.message);
      } else {
        console.log(`Recalculated record ID ${rec.id} for Employee ${rec.employee_id}: absents=${absentCount}, cut=${absentDeduction}, net=${net}`);
      }
    }
    console.log("✅ All payroll records successfully recalculated!");
  } catch (err) {
    console.error(err);
  }
}

recalculate();

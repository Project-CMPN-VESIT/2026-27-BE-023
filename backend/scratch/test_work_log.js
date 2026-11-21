const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabase = require('../config/db');

async function testWorkLog() {
  try {
    const employee_id = 'c3d6e0ff-a5fd-4bd7-adf5-be61d51e45b1';
    const date = '2026-05-22';
    const tasks_completed = 'Testing work log insert from script';
    const notes = 'Test notes';

    console.log("Inserting work log...");
    const { data, error } = await supabase.from('work_logs').insert([
      { employee_id, date, tasks_completed, notes }
    ]).select();

    if (error) {
      console.error("❌ INSERT ERROR:", error);
    } else {
      console.log("✅ INSERT SUCCESS:", data);
    }
  } catch (err) {
    console.error("System error:", err.message);
  }
}

testWorkLog();

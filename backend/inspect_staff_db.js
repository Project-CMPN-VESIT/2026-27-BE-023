const path = require('path');
require('dotenv').config();
const supabase = require('./config/db');

async function inspect() {
  console.log("\nLatest Attendance Records:");
  const { data: attendance } = await supabase.from('attendance').select('*').order('created_at', { ascending: false }).limit(5);
  console.log(attendance);

  console.log("\nLatest Work Logs:");
  const { data: workLogs } = await supabase.from('work_logs').select('*').order('created_at', { ascending: false }).limit(5);
  console.log(workLogs);
}

inspect();

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const supabase = require('./config/db');

async function test() {
  const payload = {
    full_name: 'raghav chhada',
    role: 'salesman',
    phone: '8797974597',
    email: 'k@gmail.com', // duplicate email
    joining_date: '2026-05-22', // correct format
    monthly_salary: 4500,
    status: 'Active'
  };

  console.log("Trying to insert duplicate employee payload:", payload);
  const { data, error } = await supabase.from('employees').insert([payload]).select().single();
  if (error) {
    console.error("❌ ERROR DETECTED:", error);
  } else {
    console.log("✅ SUCCESS:", data);
  }
}

test();

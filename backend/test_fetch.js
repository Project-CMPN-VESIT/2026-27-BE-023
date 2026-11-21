const axios = require('axios');

async function testFetch() {
  try {
    const attRes = await axios.get('http://localhost:5000/api/staff/attendance');
    console.log("Attendance from API (first 2):");
    console.log(attRes.data.slice(0, 2));

    const logRes = await axios.get('http://localhost:5000/api/staff/work-logs');
    console.log("\nWork Logs from API (first 2):");
    console.log(logRes.data.slice(0, 2));
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

testFetch();

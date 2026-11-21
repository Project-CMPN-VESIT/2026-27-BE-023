const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'd:/college/FinalProject/backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function inspectAuditLogs() {
  try {
    console.log("Fetching last 5 audit logs...");
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .limit(1);

    if (error) {
      console.error("❌ Supabase Error:", error);
      return;
    }

    console.log("\nKeys in audit_logs:");
    if (data && data.length > 0) {
      console.log(Object.keys(data[0]));
      console.log("\nSample entry:", data[0]);
    } else {
      console.log("No audit logs found.");
    }

  } catch (err) {
    console.error("❌ Inspector error:", err.message);
  }
}

inspectAuditLogs();

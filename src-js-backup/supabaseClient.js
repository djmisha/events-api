const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY"
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;

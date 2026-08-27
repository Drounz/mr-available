// One-time loader: writes products.json into Supabase.
// Usage:
//   1) Supabase dashboard > Project settings > API > "service_role" key
//      (NOT the anon key — this one bypasses Row Level Security).
//   2) export SUPABASE_URL="https://xxxx.supabase.co"
//      export SUPABASE_SERVICE_ROLE_KEY="..."
//   3) npm install
//   4) node seed.js
const { createClient } = require("@supabase/supabase-js");
const products = require("./products.json");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url || !key){
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables first.");
  process.exit(1);
}

const client = createClient(url, key);

(async () => {
  const { error } = await client.from("products").upsert(products, { onConflict: "id" });
  if(error){ console.error(error); process.exit(1); }
  console.log(`Seeded ${products.length} products into Supabase.`);
})();

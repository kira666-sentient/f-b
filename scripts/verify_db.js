const fs = require('fs');
const path = require('path');

// Manual env loader to avoid needing 'dotenv' dependency
const loadEnv = (file) => {
  const envPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
        if (key && !process.env[key]) process.env[key] = value;
      }
    });
  }
};

loadEnv('.env.local');
loadEnv('.env');

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key in .env or .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLatency(tableName, queryName, queryPromise) {
  const start = performance.now();
  const { data, error } = await queryPromise;
  const end = performance.now();
  const latency = (end - start).toFixed(2);
  
  if (error) {
    console.error(`❌ [${tableName}] ${queryName}: FAILED (${latency}ms) - ${error.message}`);
    return false;
  } else {
    console.log(`✅ [${tableName}] ${queryName}: OK (${latency}ms)`);
    return true;
  }
}

async function verifyDB() {
  console.log('Starting Complete Database Verification...\n');

  console.log('--- 1. SPEED CHECKS (Indexes & Routing) ---');
  // Profiles
  await checkLatency('profiles', 'Select single by ID', 
    supabase.from('profiles').select('*').limit(1)
  );
  
  // Shared_items
  await checkLatency('shared_items', 'Filter by owner_id (testing shared_items_owner_idx)', 
    supabase.from('shared_items').select('*').eq('owner_id', '00000000-0000-0000-0000-000000000000')
  );

  await checkLatency('shared_items', 'Filter by friend_id (testing shared_items_friend_idx)', 
    supabase.from('shared_items').select('*').eq('friend_id', '00000000-0000-0000-0000-000000000000')
  );

  // Settlements
  await checkLatency('settlements', 'Fetch recent settlements', 
    supabase.from('settlements').select('*').order('created_at', { ascending: false }).limit(10)
  );

  console.log('\n--- 2. SCHEMA & RLS ENFORCEMENT CHECKS ---');
  // Test RLS enforces without Auth
  console.log('Testing unauthenticated inserts (should fail due to RLS)...');
  await checkLatency('shared_items', 'Anonymous Insert block check', 
    supabase.from('shared_items').insert({ item_name: 'test', type: 'gave' })
  ).then(passed => {
    // We WANT it to fail, so if it failed (returned false), it means RLS works!
    if (!passed) console.log('✅ RLS successfully blocked anonymous insert.');
    else console.log('❌ ALERT: Anonymous insert succeeded! RLS is broken.');
  });
  
  console.log('\nVerification Script Finished.');
  console.log('Note: To test the PL/pgSQL triggers thoroughly, please run the SQL tests manually in the Supabase SQL Editor as triggers apply to DML operations.');
}

verifyDB();

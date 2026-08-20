const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://fbgkvhtbquxacakahbno.supabase.co', 'sb_publishable_MytZR7jdwuZ4KYqMpk1V9Q_Mj6aS4gi');

async function test() {
  const { data, error } = await supabase.rpc('get_columns'); 
  // Wait, I can't query information_schema easily through the data API without a custom RPC or using the Postgres secret, which I don't have.
}
test();

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://fbgkvhtbquxacakahbno.supabase.co', 'sb_publishable_MytZR7jdwuZ4KYqMpk1V9Q_Mj6aS4gi');

async function test() {
  const { data, error } = await supabase.from('question_bank').select('correct_answer').limit(1);
  console.log('Error:', error);
}
test();

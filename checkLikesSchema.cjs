const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supTs = fs.readFileSync('src/lib/supabase.ts', 'utf-8');
const urlMatch = supTs.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = supTs.match(/supabaseAnonKey\s*=\s*['"]([^'"]+)['"]/);

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1]);
  // Try inserting a test like
  supabase.from('likes').insert({
    id: '00000000-0000-0000-0000-000000000001',
    user_id: '00000000-0000-0000-0000-000000000001',
    item_id: '00000000-0000-0000-0000-000000000001',
    item_type: 'study_note'
  }).select().then(async ({ data, error }) => {
    console.log('Likes insert result:', data, error);
    await supabase.from('likes').delete().eq('id', '00000000-0000-0000-0000-000000000001');
  });

  // Check notifications table as well
  supabase.from('notifications').insert({
    id: '00000000-0000-0000-0000-000000000001',
    user_id: '00000000-0000-0000-0000-000000000001',
    title: 'Test',
    message: 'Test message',
    type: 'comment',
    is_read: false
  }).select().then(async ({ data, error }) => {
    console.log('Notifications insert result:', data, error);
    await supabase.from('notifications').delete().eq('id', '00000000-0000-0000-0000-000000000001');
  });
}

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const [,, username, password] = process.argv;

if (!username || !password) {
  console.error('Usage: tsx scripts/create-user.ts <username> <password>');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const password_hash = await bcrypt.hash(password, 12);

const { data, error } = await supabase
  .from('users')
  .insert({ username, password_hash })
  .select()
  .single();

if (error) {
  console.error('Failed to create user:', error.message);
  process.exit(1);
}

console.log(`✓ Created user: ${data.username} (id: ${data.id})`);

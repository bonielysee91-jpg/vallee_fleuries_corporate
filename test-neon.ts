import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);
(async () => {
  try {
    const r = await sql`SELECT 1 as ok`;
    console.log('Result', r);
  } catch (e) {
    console.error('Error', e);
  }
})();
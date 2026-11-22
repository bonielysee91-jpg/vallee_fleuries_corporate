import 'dotenv/config';
import { prisma } from './src/server/prisma.ts';
(async()=>{
  try {
    const result = await prisma.$queryRaw`SELECT 1 as ok`;
    console.log('Prisma query result', result);
  } catch(e){
    console.error('Prisma query error', e);
  } finally {
    await prisma.$disconnect();
  }
})();

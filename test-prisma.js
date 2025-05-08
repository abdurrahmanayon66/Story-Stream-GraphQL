const { prisma } = require('./config/db');
async function test() {
  try {
    await prisma.$connect();
    console.log('Database connected');
    console.log('Prisma user model:', prisma.user ? 'Exists' : 'Undefined');
    const users = await prisma.user.findMany();
    console.log('Users:', users);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}
test();
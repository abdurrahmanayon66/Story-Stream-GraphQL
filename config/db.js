const { PrismaClient } = require('@prisma/client');

let prisma;

if (!global.prisma) {
  global.prisma = new PrismaClient({
  });
}

prisma = global.prisma;

const connectDB = async () => {
  try {
    await prisma.$connect();
    console.log('PostgreSQL connected via Prisma');
  } catch (err) {
    console.log('PostgreSQL connection error:', err);
    process.exit(1);
  }
};

module.exports = { prisma, connectDB };

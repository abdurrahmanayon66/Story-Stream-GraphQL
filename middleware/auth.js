const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  console.log('Authorization header:', authHeader);

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized: User not found' });
      }

      req.user = user;
      return next();
    } catch (err) {
      console.error('Token verification error:', err.message);
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  }

  // No token provided – allow access as unauthenticated user
  req.user = null;
  return next();
};

module.exports = authMiddleware;

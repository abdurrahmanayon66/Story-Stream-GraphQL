const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("authHeader:", authHeader);
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  console.log("token:", token);
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("decoded:", decoded);
    console.log("decoded.id:", decoded.id);

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      req.user = null;
      return next();
    }

    // Set req.user to full user object
    req.user = user;
    console.log("req.user:", req.user);
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    req.user = null;
    next();
  }
};

module.exports = authMiddleware;
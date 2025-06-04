const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { parse, getOperationAST } = require('graphql');

const prisma = new PrismaClient();
const PUBLIC_OPERATIONS = ['login', 'register', 'oauthLogin', 'isUsernameAvailable'];

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

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

  try {
    const document = parse(req.body.query);
    const operationAST = getOperationAST(document, req.body.operationName);

    if (!operationAST) {
      return res.status(400).json({ error: 'Invalid operation' });
    }

    const operationNames = operationAST.selectionSet.selections.map(sel => sel.name.value);
    const isPublic = operationNames.every(name => PUBLIC_OPERATIONS.includes(name));

    if (isPublic) {
      req.user = null;
      return next();
    }

    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  } catch (err) {
    console.error('GraphQL parsing error:', err.message);
    return res.status(400).json({ error: 'Bad request: Failed to parse query' });
  }
};

module.exports = authMiddleware;

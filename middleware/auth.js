const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { parse, getOperationAST } = require('graphql');

const prisma = new PrismaClient();

const PUBLIC_MUTATIONS = ['login', 'register', 'oauthLogin'];
const PUBLIC_QUERIES = ['isUsernameAvailable'];

const authMiddleware = async (req, res, next) => {
  // If there's no query, just continue
  if (!req.body || !req.body.query) {
    req.user = null;
    return next();
  }

  try {
    const document = parse(req.body.query);
    const operationAST = getOperationAST(document, req.body.operationName);

    if (!operationAST) {
      req.user = null;
      return next();
    }

    // Check if the operation is a query or mutation
    const operationType = operationAST.operation;

    if (operationType === 'query') {
      // Collect query names in this operation
      const queries = operationAST.selectionSet.selections.map(sel => sel.name.value);

      // If any query is public, skip auth check
      const isPublicQuery = queries.some(query => PUBLIC_QUERIES.includes(query));

      if (isPublicQuery) {
        req.user = null; // Public query, no user needed
        return next();
      }
    }

    if (operationType === 'mutation') {
      // Collect mutation names in this operation
      const mutations = operationAST.selectionSet.selections.map(sel => sel.name.value);

      // If any mutation is public, skip auth check
      const isPublicMutation = mutations.some(mutation => PUBLIC_MUTATIONS.includes(mutation));

      if (isPublicMutation) {
        req.user = null; // Public mutation, no user needed
        return next();
      }
    }

    // Perform token verification for protected operations
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      req.user = null;
      return next();
    }

    req.user = user;
    return next();

  } catch (err) {
    console.error('Auth middleware error:', err.message);
    req.user = null;
    next();
  }
};

module.exports = authMiddleware;
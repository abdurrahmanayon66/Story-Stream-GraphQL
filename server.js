const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { check, validationResult } = require('express-validator');
const dotenv = require('dotenv');
const { graphqlUploadExpress, GraphQLUpload } = require('graphql-upload');

const typeDefs = require('./schemas');
const resolvers = require('./resolvers');
const authMiddleware = require('./middleware/auth');

// Load environment variables
dotenv.config();
console.log('JWT_SECRET:', process.env.JWT_SECRET);
console.log('JWT_REFRESH_SECRET:', process.env.JWT_REFRESH_SECRET);

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Limit each IP to 100 requests per windowMs
}));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error(`MongoDB connection error: ${err.message}`));

// Combine resolvers with Upload scalar
const serverResolvers = {
  Upload: GraphQLUpload,
  ...resolvers
};

// Apollo Server setup for v4
const server = new ApolloServer({
  typeDefs,
  resolvers: serverResolvers,
  context: ({ req }) => ({
    user: req.user
  })
});

// Apply middleware and start server
async function startServer() {
  await server.start();

  // Apply graphql-upload middleware for file uploads
  app.use('/graphql', graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }));

  // Apply Apollo Server as Express middleware
  app.use(
    '/graphql',
    express.json(),
    authMiddleware,
    expressMiddleware(server)
  );

  // Global error handler
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen({ port: process.env.PORT || 4000 }, () =>
    console.log(`Server running at ${process.env.PORT || 4000}/graphql`)
  );
}

startServer();
const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const mongoose = require('mongoose');
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

async function startServer() {
  await server.start();

  // Only apply graphqlUploadExpress ONCE — and DO NOT use express.json()
  app.use(
    '/graphql',
    authMiddleware,
    graphqlUploadExpress({ maxFileSize: 10_000_000, maxFiles: 1 }),
    expressMiddleware(server)
  );

  // Global error handler
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen({ port: process.env.PORT || 4000 }, () =>
    console.log(`Server running at http://localhost:${process.env.PORT || 4000}/graphql`)
  );
}

startServer();
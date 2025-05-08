const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { graphqlUploadExpress, GraphQLUpload } = require('graphql-upload');
const typeDefs = require('./schemas');
const resolvers = require('./resolvers');
const authMiddleware = require('./middleware/auth');
const { prisma, connectDB } = require('./config/db');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL}));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
  })
);

// Combine resolvers with Upload scalar
const serverResolvers = {
  Upload: GraphQLUpload,
  ...resolvers,
};

// Apollo Server setup for v4
const server = new ApolloServer({
  typeDefs,
  resolvers: serverResolvers,
  // Updated to fix context handling
  formatError: (error) => {
    console.error('GraphQL Error:', error);
    return error;
  },
});

async function startServer() {
  await connectDB();
  await server.start();

  // Apply JSON parsing middleware before GraphQL middleware
  app.use('/graphql', express.json());

  // Apply auth middleware and graphqlUploadExpress for file uploads
  app.use(
    '/graphql',
    authMiddleware,
    graphqlUploadExpress({ maxFileSize: 10_000_000, maxFiles: 1 }),
    expressMiddleware(server, {
      // Move context function here for expressMiddleware
      context: async ({ req }) => {
        const context = {
          user: req.user,
          prisma,
        };
        return context;
      }
    })
  );

  // Global error handler
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () =>
    console.log(`Server running at http://localhost:${PORT}/graphql`)
  );
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
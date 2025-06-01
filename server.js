const express = require('express');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { graphqlUploadExpress, GraphQLUpload } = require('graphql-upload');
const typeDefs = require('./schemas');
const resolvers = require('./resolvers/index');
const authMiddleware = require('./middleware/auth');
const { prisma, connectDB } = require('./config/db');

dotenv.config();

const app = express();


app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL}));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
  })
);


const serverResolvers = {
  Upload: GraphQLUpload,
  ...resolvers,
};


const server = new ApolloServer({
  typeDefs,
  resolvers: serverResolvers,
  formatError: (error) => {
    console.error('GraphQL Error:', error);
    return error;
  },
});

async function startServer() {
  await connectDB();
  await server.start();

  app.use('/graphql', express.json());

  app.use(
    '/graphql',
    authMiddleware,
    graphqlUploadExpress({ maxFileSize: 10_000_000, maxFiles: 1 }),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const context = {
          user: req.user,
          prisma,
        };
        return context;
      }
    })
  );

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
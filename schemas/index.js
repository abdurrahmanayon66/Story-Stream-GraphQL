const { mergeTypeDefs } = require('@graphql-tools/merge');
const scalars = require('./scalars');
const user = require('./user');
const blog = require('./blog');
const comment = require('./comment');
const auth = require('./auth');
const like = require('./like');
const bookmark = require('./bookmark');
const follower = require('./follower');

const root = `
  type Query {
    _empty: String
  }

  type Mutation {
    _empty: String
  }
`;

const typeDefs = mergeTypeDefs([
  root,
  scalars,
  user,
  blog,
  comment,
  auth,
  like,
  bookmark,
  follower
]);

module.exports = typeDefs;
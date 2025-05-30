// resolvers/index.js
const { mergeResolvers } = require('@graphql-tools/merge');

const scalars = require('./scalars');
const auth = require('./auth');
const user = require('./user');
const blog = require('./blog');
const comment = require('./comment');

module.exports = mergeResolvers([
  scalars,
  auth,
  user,
  blog,
  comment
]);

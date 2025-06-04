const { mergeResolvers } = require('@graphql-tools/merge');

const scalars = require('./scalars');
const auth = require('./auth');
const user = require('./user');
const blog = require('./blog');
const comment = require('./comment');
const like = require('./like'); 

module.exports = mergeResolvers([
  scalars,
  auth,
  user,
  blog,
  comment,
  like,
]);

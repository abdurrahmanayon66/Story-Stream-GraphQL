const { gql } = require('graphql-tag');

module.exports = gql`
  type Like {
    id: Int!
    blog: Blog!
    user: User!
    createdAt: DateTime!
  }

  extend type Mutation {
    toggleLike(blogId: Int!): Like!
  }
`;
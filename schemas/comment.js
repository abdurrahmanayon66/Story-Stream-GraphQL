const { gql } = require('graphql-tag');

module.exports = gql`
  type Comment {
    id: Int!
    content: String!
    blog: Blog!
    author: User!
    createdAt: DateTime!
  }

  extend type Mutation {
    createComment(blogId: Int!, content: String!): Comment!
  }
`;
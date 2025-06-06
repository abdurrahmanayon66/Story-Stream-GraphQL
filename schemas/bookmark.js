const { gql } = require('graphql-tag');

module.exports = gql`
  type Bookmark {
    id: Int!
    user: User!
    blog: Blog!
  }

  extend type Mutation {
    toggleBookmark(blogId: Int!): Bookmark!
  }
`;
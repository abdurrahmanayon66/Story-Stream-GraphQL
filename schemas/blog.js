const { gql } = require('graphql-tag');

module.exports = gql`
  type Blog {
    id: Int!
    title: String!
    slug: String!
    content: JSON!
    image: String!
    genre: [String!]!
    author: User!
    createdAt: DateTime!
    comments: [Comment!]!
    likes: [Like!]!
    bookmarks: [Bookmark!]!
  }

  extend type Query {
    blogs: [Blog!]!
    blog(id: Int!): Blog
  }

  extend type Mutation {
    createBlog(
      title: String!
      content: JSON!
      image: Upload!
      genre: [String!]!
    ): Blog!
  }
`;

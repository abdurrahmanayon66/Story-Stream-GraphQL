const { gql } = require("graphql-tag");
module.exports = gql`
  type Blog {
    id: Int!
    title: String!
    slug: String!
    description: String!
    content: String!
    image: String
    genre: [String!]!
    author: User!
    createdAt: DateTime!
    likesCount: Int!
    commentsCount: Int!
    bookmarksCount: Int!
    hasLiked: Boolean!
    hasBookmarked: Boolean!
  }

  extend type Query {
    blogs: [Blog!]!
    blog(id: Int!): Blog
    forYouBlogs: [Blog!]!
    mostLikedBlogs: [Blog!]!
    myBlogs: [Blog!]!
  }

  extend type Mutation {
    createBlog(
      title: String!
      description: String!
      content: String!
      image: Upload
      genre: [String!]!
    ): Blog!
  }
`;

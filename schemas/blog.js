const { gql } = require('graphql-tag');
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
  comments: [Comment!]!
  likes: [Like!]!
  bookmarks: [Bookmark!]!
  likesCount: Int!
  commentsCount: Int!
  bookmarksCount: Int!
}

type ForYouBlogsResponse {
  blogs: [Blog!]!
}

extend type Query {
  blogs: [Blog!]!
  blog(id: Int!): Blog
  forYouBlogs: ForYouBlogsResponse!
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

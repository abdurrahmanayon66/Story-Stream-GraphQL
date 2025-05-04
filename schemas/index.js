const gql = require('graphql-tag');

const typeDefs = gql`
  scalar Upload

  type User {
    id: ID!
    username: String!
    email: String!
    image: String! # Base64-encoded image data
    createdAt: String!
  }

  type Blog {
    id: ID!
    title: String!
    content: String!
    image: String! # Base64 string
    author: User!
    createdAt: String!
    comments: [Comment!]!
    likes: [Like!]!
  }

  type Comment {
    id: ID!
    content: String!
    blog: Blog!
    author: User!
    createdAt: String!
  }

  type Like {
    id: ID!
    blog: Blog!
    user: User!
    createdAt: String!
  }

  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    user: User!
  }

  input RegisterInput {
    username: String!
    email: String!
    password: String!
    image: Upload! # Changed to Upload for form-data
  }

  type Query {
    currentUser: User # Renamed from 'me' to 'currentUser'
    blogs: [Blog!]!
    blog(id: ID!): Blog
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    refreshToken(refreshToken: String!): AuthPayload!
    createBlog(title: String!, content: String!, image: Upload!): Blog!
    createComment(blogId: ID!, content: String!): Comment!
    likeBlog(blogId: ID!): Like!
  }
`;

module.exports = typeDefs;
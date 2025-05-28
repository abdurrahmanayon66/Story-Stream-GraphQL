const { gql } = require('graphql-tag');

const typeDefs = gql`
  scalar Upload
  scalar DateTime
  scalar JSON

  type User {
    id: Int!
    username: String!
    email: String!
    image: String
    profileImage: String
    createdAt: DateTime!
  }

  type Blog {
    id: Int!
    title: String!
    content: JSON! # Changed from String! to JSON!
    image: String!  # Base64 string
    genre: [String!]! # New field
    author: User!
    createdAt: DateTime!
    comments: [Comment!]!
    likes: [Like!]!
  }

  type Comment {
    id: Int!
    content: String!
    blog: Blog!
    author: User!
    createdAt: DateTime!
  }

  type Like {
    id: Int!
    blog: Blog!
    user: User!
    createdAt: DateTime!
  }

  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    user: User!
  }

  type AuthError {
    message: String!
    code: String
  }

  union AuthResult = AuthPayload | AuthError

  input RegisterInput {
    username: String!
    email: String!
    password: String!
    image: Upload!
  }

  input OAuthInput {
    provider: String!
    providerId: String!
    email: String!
    name: String
    profileImage: String
  }

  type Query {
    currentUser: User
    blogs: [Blog!]!
    blog(id: Int!): Blog
  }

  type Mutation {
    register(input: RegisterInput!): AuthResult!
    login(email: String!, password: String!): AuthResult!
    oauthLogin(input: OAuthInput!): AuthResult!
    refreshToken(refreshToken: String!): AuthPayload!
    createBlog(title: String!, content: JSON!, image: Upload!, genre: [String!]!): Blog!
    createComment(blogId: Int!, content: String!): Comment!
    likeBlog(blogId: Int!): Like!
  }
`;

module.exports = typeDefs;

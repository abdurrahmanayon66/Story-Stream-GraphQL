const { gql } = require('graphql-tag');

const typeDefs = gql`
  scalar Upload
  scalar DateTime
  scalar JSON

  type User {
    id: Int!
    username: String!
    fullName: String
    userBio: String
    email: String!
    image: String
    profileImage: String
    createdAt: DateTime!
    followers: [Follower!]!
    following: [Follower!]!
    bookmarks: [Bookmark!]!
  }

  type Blog {
    id: Int!
    title: String!
    slug: String!
    content: JSON!
    image: String!         # Base64-encoded image
    genre: [String!]!
    author: User!
    createdAt: DateTime!
    comments: [Comment!]!
    likes: [Like!]!
    bookmarks: [Bookmark!]!
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

  type Follower {
    id: Int!
    user: User!         # The user who is being followed
    follower: User!     # The user who follows
  }

  type Bookmark {
    id: Int!
    user: User!
    blog: Blog!
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

  type UsernameAvailability {
    exists: Boolean!
  }

  type Query {
    currentUser: User
    blogs: [Blog!]!
    blog(id: Int!): Blog

    # New query to check username availability
    isUsernameAvailable(username: String!): UsernameAvailability!
  }

  type Mutation {
    register(input: RegisterInput!): AuthResult!
    login(email: String!, password: String!): AuthResult!
    oauthLogin(input: OAuthInput!): AuthResult!
    refreshToken(refreshToken: String!): AuthPayload!

    createBlog(
      title: String!
      content: JSON!
      image: Upload!
      genre: [String!]!
    ): Blog!

    createComment(blogId: Int!, content: String!): Comment!
    likeBlog(blogId: Int!): Like!
    bookmarkBlog(blogId: Int!): Bookmark!
    followUser(userId: Int!): Follower!
  }
`;

module.exports = typeDefs;

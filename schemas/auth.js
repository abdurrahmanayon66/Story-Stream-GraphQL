const { gql } = require('graphql-tag');

module.exports = gql`
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
    fullName: String!
    userBio: String
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

  extend type Mutation {
    register(input: RegisterInput!): AuthResult!
    login(email: String!, password: String!): AuthResult!
    oauthLogin(input: OAuthInput!): AuthResult!
    refreshToken(refreshToken: String!): AuthPayload!
  }
`;
const { gql } = require("graphql-tag");

module.exports = gql`

  type Like {
    id: Int!
    blogId: Int!
    userId: Int!
    createdAt: DateTime!
    user: User!
    blog: Blog!
  }

  input LikeInput {
    blogId: Int!
  }

  type ToggleLikePayload {
    success: Boolean!
    message: String!
    isLiked: Boolean!
    like: Like
  }

  type Query {
    likes: [Like!]!
    like(id: Int!): Like
  }

  type Mutation {
    createLike(input: LikeInput!): Like!
    deleteLike(id: Int!): Boolean!
    toggleLike(blogId: Int!): ToggleLikePayload!
  }
`;

const { gql } = require('graphql-tag');

module.exports = gql`
  type Follower {
    id: Int!
    user: User!
    follower: User!
  }

  type ToggleFollowResponse {
  success: Boolean!
  message: String!
  isFollowing: Boolean!
}

extend type Mutation {
  toggleFollow(followerId: Int!): ToggleFollowResponse!
}
`;
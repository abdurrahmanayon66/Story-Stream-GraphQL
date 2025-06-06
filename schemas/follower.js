const { gql } = require('graphql-tag');

module.exports = gql`
  type Follower {
    id: Int!
    user: User!
    follower: User!
  }

  extend type Mutation {
    toggleFollow(followerId: Int!): Follower!
  }
`;
const { gql } = require("graphql-tag");

module.exports = gql`
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
    sentNotifications: [Notification!]!
    receivedNotifications: [Notification!]!
    lastSeenNotification: Notification
    isFollowing: Boolean
  }

  type UsernameAvailability {
    exists: Boolean!
  }

  extend type Query {
    currentUser: User
    isUsernameAvailable(username: String!): UsernameAvailability!
    followerSuggestions: [User!]!
  }

  extend type Mutation {
    followUser(userId: Int!): Follower!
    toggleBookmark(blogId: Int!): Bookmark!
  }
`;

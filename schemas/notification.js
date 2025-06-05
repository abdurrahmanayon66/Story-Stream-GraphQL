const { gql } = require("graphql-tag");

module.exports = gql`
  type Notification {
    id: Int!
    recipientId: Int!
    senderId: Int!
    type: String!
    blogId: Int
    createdAt: DateTime!
  }
`;

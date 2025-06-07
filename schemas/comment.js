const { gql } = require('graphql-tag');

module.exports = gql`
type Comment {
  id: Int!
  content: String!
  blogId: Int!
  userId: Int!
  parentCommentId: Int
  createdAt: DateTime!
  blog: Blog
  user: User
  parentComment: Comment
  replies: [Comment!]!
  likeCount: Int!
  hasLiked: Boolean!
}

  type CommentLike {
    id: Int!
    commentId: Int!
    userId: Int!
    comment: Comment!
    user: User!
    createdAt: DateTime!
  }

  extend type Query {
    commentsByBlogId(blogId: Int!): [Comment!]!
  }

  extend type Mutation {
    createComment(blogId: Int!, content: String!, parentCommentId: Int): Comment!
    deleteComment(commentId: Int!): Boolean!
    toggleCommentLike(commentId: Int!): Boolean!
  }
`;
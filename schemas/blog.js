const { gql } = require('graphql-tag');

module.exports = gql`
  type Blog {
    id: Int!
    title: String!
    slug: String!
    content: JSON!
    image: String
    genre: [String!]!
    author: User!
    createdAt: DateTime!
    updatedAt: DateTime!
    comments: [Comment!]!
    likes: [Like!]!
    bookmarks: [Bookmark!]!
    likesCount: Int!
    commentsCount: Int!
    bookmarksCount: Int!
  }

  type BlogConnection {
    blogs: [Blog!]!
    pagination: PaginationInfo!
  }

  type PaginationInfo {
    currentPage: Int!
    totalPages: Int!
    totalCount: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  input BlogsInput {
    page: Int = 1
    limit: Int = 10
    sortBy: BlogSortBy = LATEST
    filters: BlogFilters
  }

  input BlogFilters {
    genre: [String!]
    search: String
    authorId: Int
    dateFrom: DateTime
    dateTo: DateTime
  }

  enum BlogSortBy {
    LATEST
    OLDEST
    MOST_LIKED
    MOST_COMMENTED
    TRENDING
  }

  type MutationResponse {
    success: Boolean!
    message: String!
  }

  extend type Query {
    # Get paginated blogs with filters and sorting
    blogs(input: BlogsInput): BlogConnection!
    
    # Get personalized feed for authenticated users (now uses reusable functions)
    forYouBlogs(input: BlogsInput): BlogConnection!
    
    # Get blogs from followed authors
    followingBlogs(input: BlogsInput): BlogConnection!
    
    # Get single blog by ID
    blog(id: Int!): Blog
    
    # Get single blog by slug
    blogBySlug(slug: String!): Blog
    
    # Get trending blogs
    trendingBlogs(input: BlogsInput): BlogConnection!
    
    # Get most liked blogs
    mostLikedBlogs(input: BlogsInput): BlogConnection!
    
    # NEW: Get random blogs with pagination
    randomBlogs(input: BlogsInput): BlogConnection!
    
    # NEW: Get blogs filtered by specific genres
    blogsByGenres(genres: [String!]!, input: BlogsInput): BlogConnection!
  }

  extend type Mutation {
    createBlog(
      title: String!
      content: JSON!
      image: Upload
      genre: [String!]!
    ): Blog!
    
    updateBlog(
      id: Int!
      title: String
      content: JSON
      image: Upload
      genre: [String!]
    ): Blog!
    
    deleteBlog(id: Int!): MutationResponse!
    
    likeBlog(blogId: Int!): Like!
    unlikeBlog(blogId: Int!): MutationResponse!
    
    bookmarkBlog(blogId: Int!): Bookmark!
    unbookmarkBlog(blogId: Int!): MutationResponse!
  }
`;
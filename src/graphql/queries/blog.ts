import { gql } from "@apollo/client";

// FRAGMENTS
export const BLOG_FRAGMENT = gql`
  fragment BlogFields on Blog {
    id
    title
    slug
    description
    content
    image
    genre
    createdAt
    likesCount
    commentsCount
    bookmarksCount
    hasLiked
    hasBookmarked
    author {
      id
      username
      image
      profileImage
    }
  }
`;

// QUERIES
export const GET_ALL_BLOGS = gql`
  query GetAllBlogs {
    blogs {
      ...BlogFields
    }
  }
  ${BLOG_FRAGMENT}
`;

export const GET_BLOG_BY_ID = gql`
  query GetBlogById($id: Int!) {
    blog(id: $id) {
      ...BlogFields
    }
  }
  ${BLOG_FRAGMENT}
`;

export const GET_FOR_YOU_BLOGS = gql`
  query GetForYouBlogs {
    forYouBlogs {
      ...BlogFields
    }
  }
  ${BLOG_FRAGMENT}
`;

export const GET_MOST_LIKED_BLOGS = gql`
  query GetMostLikedBlogs {
    mostLikedBlogs {
      ...BlogFields
    }
  }
  ${BLOG_FRAGMENT}
`;

export const GET_MY_BLOGS = gql`
  query GetMyBlogs {
    myBlogs {
      ...BlogFields
    }
  }
  ${BLOG_FRAGMENT}
`;

export const GET_BLOGS_BY_AUTHOR_ID = gql`
  query GetBlogsByAuthorId($authorId: Int!) {
    blogsByAuthorId(authorId: $authorId) {
      ...BlogFields
    }
  }
  ${BLOG_FRAGMENT}
`;

export const GET_AUTHOR_BY_BLOG_ID = gql`
  query GetAuthorByBlogId($blogId: Int!) {
    authorByBlogId(blogId: $blogId) {
      id
      username
      image
      profileImage
      followerCount
      followingCount
    }
  }
`;

// MUTATIONS
export const CREATE_BLOG = gql`
  mutation CreateBlog(
    $title: String!
    $description: String!
    $content: String!
    $image: Upload
    $genre: [String!]!
  ) {
    createBlog(
      title: $title
      description: $description
      content: $content
      image: $image
      genre: $genre
    ) {
      ...BlogFields
    }
  }
  ${BLOG_FRAGMENT}
`;

// INTERFACES
export interface User {
  id: number;
  username: string;
  image?: string;
  profileImage?: string;
}

export interface Blog {
  id: number;
  title: string;
  slug: string;
  description: string;
  content: string;
  image?: string;
  genre: string[];
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  bookmarksCount: number;
  hasLiked: boolean;
  hasBookmarked: boolean;
  author: User;
}

// QUERY VARIABLES
export interface GetBlogByIdVariables {
  id: number;
}

export interface CreateBlogVariables {
  title: string;
  description: string;
  content: string;
  image?: File;
  genre: string[];
}

export interface GetBlogsByAuthorIdVariables {
  authorId: number;
}

export interface GetAuthorByBlogIdVariables {
  blogId: number;
}

// RESPONSE INTERFACES
export interface GetAllBlogsResponse {
  blogs: Blog[];
}

export interface GetBlogByIdResponse {
  blog: Blog;
}

export interface GetForYouBlogsResponse {
  forYouBlogs: Blog[];
}

export interface GetMostLikedBlogsResponse {
  mostLikedBlogs: Blog[];
}

export interface GetMyBlogsResponse {
  myBlogs: Blog[];
}

export interface GetBlogsByAuthorIdResponse {
  blogsByAuthorId: Blog[];
}

export interface CreateBlogResponse {
  createBlog: Blog;
}

export interface GetAuthorByBlogIdResponse {
  authorByBlogId: User;
} 
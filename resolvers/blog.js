const { parseResolveInfo } = require("graphql-parse-resolve-info");
const generateSlug = require("../utils/generateSlug");

// Helper function to build dynamic include based on GraphQL fields
const buildIncludeFromFields = (fields) => {
  const include = {};
  if (fields.author) include.author = true;
  if (fields.comments) include.comments = { include: { user: true } };
  if (fields.likes) include.likes = { include: { user: true } };
  if (fields.bookmarks) include.bookmarks = { include: { user: true } };
  return include;
};

// Helper function to transform blog data with base64 images
const transformBlogData = (blog, fields) => {
  if (!blog) return null;
  
  return {
    ...blog,
    image: fields.image && blog.image ? Buffer.from(blog.image).toString("base64") : null,
    author: blog.author ? {
      ...blog.author,
      image: fields.author?.image && blog.author.image 
        ? Buffer.from(blog.author.image).toString("base64") 
        : null,
      profileImage: fields.author?.profileImage ? blog.author.profileImage : null,
    } : null,
    comments: blog.comments || [],
    likes: blog.likes || [],
    bookmarks: blog.bookmarks || [],
  };
};

// Helper function to build where clause based on filters
const buildWhereClause = (filters) => {
  const where = {};
  
  if (filters.genre && filters.genre.length > 0) {
    where.genre = { hasSome: filters.genre };
  }
  
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { content: { path: ['blocks'], array_contains: [{ text: { contains: filters.search } }] } }
    ];
  }
  
  if (filters.authorId) {
    where.authorId = filters.authorId;
  }
  
  return where;
};

// Helper function to build orderBy clause
const buildOrderBy = (sortBy) => {
  const orderByMap = {
    'latest': { createdAt: 'desc' },
    'oldest': { createdAt: 'asc' },
    'most_liked': { likes: { _count: 'desc' } },
    'most_commented': { comments: { _count: 'desc' } },
    'trending': [
      { likes: { _count: 'desc' } },
      { comments: { _count: 'desc' } },
      { createdAt: 'desc' }
    ]
  };
  
  return orderByMap[sortBy] || { createdAt: 'desc' };
};

module.exports = {
  Query: {
    // Get paginated blogs with filters and sorting
    blogs: async (_, { input = {} }, { prisma, user }, info) => {
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};
      
      const {
        page = 1,
        limit = 10,
        sortBy = 'latest',
        filters = {}
      } = input;
      
      const skip = (page - 1) * limit;
      const where = buildWhereClause(filters);
      const orderBy = buildOrderBy(sortBy);
      const include = buildIncludeFromFields(fields);
      
      try {
        const [blogs, totalCount] = await Promise.all([
          prisma.blog.findMany({
            where,
            include,
            orderBy,
            skip,
            take: limit,
          }),
          prisma.blog.count({ where })
        ]);
        
        const transformedBlogs = blogs.map(blog => transformBlogData(blog, fields));
        
        return {
          blogs: transformedBlogs,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            hasNextPage: page < Math.ceil(totalCount / limit),
            hasPreviousPage: page > 1
          }
        };
      } catch (error) {
        throw new Error(`Failed to fetch blogs: ${error.message}`);
      }
    },

    // Get blogs for "For You" feed (personalized)
    forYouBlogs: async (_, { input = {} }, { prisma, user }, info) => {
      if (!user) {
        // Fallback to trending for non-authenticated users
        return module.exports.Query.blogs(_, { 
          input: { ...input, sortBy: 'trending' } 
        }, { prisma, user }, info);
      }
      
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};
      
      const { page = 1, limit = 10 } = input;
      const skip = (page - 1) * limit;
      const include = buildIncludeFromFields(fields);
      
      try {
        // Get user's liked genres and followed authors
        const userPreferences = await prisma.user.findUnique({
          where: { id: user.id },
          include: {
            likes: { select: { blog: { select: { genre: true } } } },
            following: { select: { followingId: true } }
          }
        });
        
        const likedGenres = [...new Set(
          userPreferences.likes.flatMap(like => like.blog.genre)
        )];
        const followedAuthorIds = userPreferences.following.map(f => f.followingId);
        
        const where = {
          OR: [
            { genre: { hasSome: likedGenres } },
            { authorId: { in: followedAuthorIds } }
          ]
        };
        
        const [blogs, totalCount] = await Promise.all([
          prisma.blog.findMany({
            where,
            include,
            orderBy: [
              { likes: { _count: 'desc' } },
              { createdAt: 'desc' }
            ],
            skip,
            take: limit,
          }),
          prisma.blog.count({ where })
        ]);
        
        const transformedBlogs = blogs.map(blog => transformBlogData(blog, fields));
        
        return {
          blogs: transformedBlogs,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            hasNextPage: page < Math.ceil(totalCount / limit),
            hasPreviousPage: page > 1
          }
        };
      } catch (error) {
        throw new Error(`Failed to fetch personalized blogs: ${error.message}`);
      }
    },

    // Get blogs from followed authors
    followingBlogs: async (_, { input = {} }, { prisma, user }, info) => {
      if (!user) throw new Error("Authentication required");
      
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};
      
      const { page = 1, limit = 10 } = input;
      const skip = (page - 1) * limit;
      const include = buildIncludeFromFields(fields);
      
      try {
        const followedUsers = await prisma.follow.findMany({
          where: { followerId: user.id },
          select: { followingId: true }
        });
        
        const followedIds = followedUsers.map(f => f.followingId);
        
        if (followedIds.length === 0) {
          return {
            blogs: [],
            pagination: {
              currentPage: 1,
              totalPages: 0,
              totalCount: 0,
              hasNextPage: false,
              hasPreviousPage: false
            }
          };
        }
        
        const where = { authorId: { in: followedIds } };
        
        const [blogs, totalCount] = await Promise.all([
          prisma.blog.findMany({
            where,
            include,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
          prisma.blog.count({ where })
        ]);
        
        const transformedBlogs = blogs.map(blog => transformBlogData(blog, fields));
        
        return {
          blogs: transformedBlogs,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            hasNextPage: page < Math.ceil(totalCount / limit),
            hasPreviousPage: page > 1
          }
        };
      } catch (error) {
        throw new Error(`Failed to fetch following blogs: ${error.message}`);
      }
    },

    // Get single blog by ID
    blog: async (_, { id }, { prisma }, info) => {
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};
      const include = buildIncludeFromFields(fields);
      
      try {
        const blog = await prisma.blog.findUnique({
          where: { id: parseInt(id) },
          include,
        });
        
        if (!blog) throw new Error("Blog not found");
        
        return transformBlogData(blog, fields);
      } catch (error) {
        throw new Error(`Failed to fetch blog: ${error.message}`);
      }
    },

    // Get blog by slug
    blogBySlug: async (_, { slug }, { prisma }, info) => {
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};
      const include = buildIncludeFromFields(fields);
      
      try {
        const blog = await prisma.blog.findUnique({
          where: { slug },
          include,
        });
        
        if (!blog) throw new Error("Blog not found");
        
        return transformBlogData(blog, fields);
      } catch (error) {
        throw new Error(`Failed to fetch blog: ${error.message}`);
      }
    },
  },

  Mutation: {
    createBlog: async (_, { title, content, image, genre }, { user, prisma }, info) => {
      if (!user) throw new Error("Unauthorized");

      let imageBuffer = null;

      try {
        if (image) {
          const imageFile = await (image.file || image);
          if (!imageFile || typeof imageFile.createReadStream !== "function") {
            throw new Error("A valid image file is required");
          }

          const stream = imageFile.createReadStream();
          const chunks = [];
          for await (const chunk of stream) chunks.push(chunk);
          imageBuffer = Buffer.concat(chunks);
          
          if (!imageBuffer.length) throw new Error("Image file is empty");
        }
      } catch (error) {
        throw new Error(`Image processing failed: ${error.message}`);
      }

      const slug = await generateSlug(title, async (slug) => {
        const existing = await prisma.blog.findUnique({ where: { slug } });
        return !!existing;
      });

      try {
        const blog = await prisma.blog.create({
          data: {
            title,
            slug,
            content,
            image: imageBuffer,
            genre,
            authorId: user.id,
          },
          include: {
            author: true,
            comments: { include: { user: true } },
            likes: { include: { user: true } },
            bookmarks: { include: { user: true } }
          }
        });

        const resolveInfo = parseResolveInfo(info);
        const fields = resolveInfo.fieldsByTypeName.Blog || {};

        return transformBlogData(blog, fields);
      } catch (err) {
        throw new Error(`Database operation failed: ${err.message}`);
      }
    },

    likeBlog: async (_, { blogId }, { user, prisma }, info) => {
      if (!user) throw new Error("Unauthorized");

      const blog = await prisma.blog.findUnique({ where: { id: blogId } });
      if (!blog) throw new Error("Blog not found");

      const existingLike = await prisma.like.findUnique({
        where: { blogId_userId: { blogId, userId: user.id } },
      });
      
      if (existingLike) throw new Error("Blog already liked");

      try {
        const like = await prisma.like.create({
          data: { blogId, userId: user.id },
          include: {
            user: true,
            blog: { include: { author: true } }
          }
        });

        const resolveInfo = parseResolveInfo(info);
        const fields = resolveInfo.fieldsByTypeName.Like || {};

        return {
          ...like,
          user: like.user && fields.user ? {
            ...like.user,
            image: fields.user?.image && like.user.image 
              ? Buffer.from(like.user.image).toString("base64") 
              : null,
            profileImage: fields.user?.profileImage ? like.user.profileImage : null,
          } : null,
          blog: like.blog && fields.blog ? {
            ...like.blog,
            image: fields.blog?.image && like.blog.image 
              ? Buffer.from(like.blog.image).toString("base64") 
              : null,
          } : null,
        };
      } catch (error) {
        throw new Error(`Failed to like blog: ${error.message}`);
      }
    },

    unlikeBlog: async (_, { blogId }, { user, prisma }) => {
      if (!user) throw new Error("Unauthorized");

      try {
        const existingLike = await prisma.like.findUnique({
          where: { blogId_userId: { blogId, userId: user.id } },
        });

        if (!existingLike) throw new Error("Blog not liked yet");

        await prisma.like.delete({
          where: { blogId_userId: { blogId, userId: user.id } },
        });

        return { success: true, message: "Blog unliked successfully" };
      } catch (error) {
        throw new Error(`Failed to unlike blog: ${error.message}`);
      }
    },
  },
};
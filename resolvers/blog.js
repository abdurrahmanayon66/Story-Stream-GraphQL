const { parseResolveInfo } = require("graphql-parse-resolve-info");
const generateSlug = require("../utils/generateSlug");

const buildIncludeFromFields = (fields) => {
  return {
    author: true,
    comments: fields.comments ? { include: { user: true } } : undefined,
    likes: fields.likes ? { include: { user: true } } : undefined,
    bookmarks: fields.bookmarks ? { include: { user: true } } : undefined,
  };
};

const transformBlogData = (blog, fields) => {
  if (!blog) return null;

  console.log("Original blog data:", blog);

  const transformedData = {
    ...blog,
    image: blog.image ? Buffer.from(blog?.image).toString("base64") : null,
    author: blog.author
      ? {
          ...blog.author,
          image: blog.author.image
            ? Buffer.from(blog.author.image).toString("base64")
            : null,
          profileImage: blog.author.profileImage || null,
        }
      : null,
    comments: blog.comments || [],
    likes: blog.likes || [],
    bookmarks: blog.bookmarks || [],
  };

  console.log("Transformed blog data:", transformedData);
  return transformedData;
};

const buildWhereClause = (filters) => {
  const where = {};

  if (filters.genre && filters.genre.length > 0) {
    where.genre = { hasSome: filters.genre };
  }

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      {
        content: {
          path: ["blocks"],
          array_contains: [{ text: { contains: filters.search } }],
        },
      },
    ];
  }

  if (filters.authorId) {
    where.authorId = filters.authorId;
  }

  return where;
};

const buildOrderBy = (sortBy) => {
  const orderByMap = {
    latest: { createdAt: "desc" },
    oldest: { createdAt: "asc" },
    most_liked: { likes: { _count: "desc" } },
    most_commented: { comments: { _count: "desc" } },
    trending: [
      { likes: { _count: "desc" } },
      { comments: { _count: "desc" } },
      { createdAt: "desc" },
    ],
  };

  return orderByMap[sortBy] || { createdAt: "desc" };
};

// Reusable function to get blogs by genres with pagination
const getBlogsByGenres = async (
  prisma,
  genres,
  { page = 1, limit = 10, include = {}, orderBy = { createdAt: "desc" } }
) => {
  const skip = (page - 1) * limit;
  const where = { genre: { hasSome: genres } };

  const [blogs, totalCount] = await Promise.all([
    prisma.blog.findMany({
      where,
      include,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.blog.count({ where }),
  ]);

  return {
    blogs,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPreviousPage: page > 1,
    },
  };
};

// Reusable function to get random blogs with pagination
const getRandomBlogs = async (
  prisma,
  { page = 1, limit = 10, include = {}, orderBy = { createdAt: "desc" } }
) => {
  const skip = (page - 1) * limit;

  // Get total count first for proper pagination
  const totalCount = await prisma.blog.count();

  // For truly random results, we'll use a random offset within bounds
  const maxSkip = Math.max(0, totalCount - limit);
  const randomSkip = Math.floor(Math.random() * (maxSkip + 1));

  const blogs = await prisma.blog.findMany({
    include,
    orderBy,
    skip: randomSkip,
    take: limit,
  });

  return {
    blogs,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPreviousPage: page > 1,
    },
  };
};

// Helper function to get user's liked blog genres
const getUserLikedGenres = async (prisma, userId) => {
  const userLikes = await prisma.like.findMany({
    where: { userId },
    include: { blog: { select: { genre: true } } },
  });

  const likedGenres = [
    ...new Set(userLikes.flatMap((like) => like.blog.genre)),
  ];

  return likedGenres;
};

module.exports = {
  Query: {
    blogs: async (_, { input = {} }, { prisma, user }, info) => {
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};

      const { page = 1, limit = 10, sortBy = "latest", filters = {} } = input;

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
          prisma.blog.count({ where }),
        ]);

        const transformedBlogs = blogs.map((blog) =>
          transformBlogData(blog, fields)
        );

        return {
          blogs: transformedBlogs,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            hasNextPage: page < Math.ceil(totalCount / limit),
            hasPreviousPage: page > 1,
          },
        };
      } catch (error) {
        throw new Error(`Failed to fetch blogs: ${error.message}`);
      }
    },

    // Refactored forYouBlogs resolver using reusable functions
    forYouBlogs: async (_, { input = {} }, { prisma, user }, info) => {
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};
      const include = buildIncludeFromFields(fields);
      const { page = 1, limit = 10 } = input;

      try {
        let result;

        if (!user) {
          // Guest user - show random blogs
          result = await getRandomBlogs(prisma, {
            page,
            limit,
            include,
            orderBy: buildOrderBy("trending"),
          });
        } else {
          // Get user's liked blog genres
          const likedGenres = await getUserLikedGenres(prisma, user.id);

          if (likedGenres.length === 0) {
            // New user with no likes - show random blogs
            result = await getRandomBlogs(prisma, {
              page,
              limit,
              include,
              orderBy: buildOrderBy("trending"),
            });
          } else {
            // User has liked blogs - show blogs with similar genres
            result = await getBlogsByGenres(prisma, likedGenres, {
              page,
              limit,
              include,
              orderBy: [{ likes: { _count: "desc" } }, { createdAt: "desc" }],
            });
          }
        }

        console.log("Raw blog:", result);

        const transformedBlogs = result.blogs.map((blog) =>
          transformBlogData(blog, fields)
        );

        return {
          blogs: transformedBlogs,
          pagination: result.pagination,
        };
      } catch (error) {
        throw new Error(`Failed to fetch personalized blogs: ${error.message}`);
      }
    },

    // New query for random blogs
    randomBlogs: async (_, { input = {} }, { prisma }, info) => {
      console.log("getting called!");
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};
      const include = buildIncludeFromFields(fields);
      const { page = 1, limit = 10, sortBy = "latest" } = input;

      try {
        const result = await getRandomBlogs(prisma, {
          page,
          limit,
          include,
          orderBy: buildOrderBy(sortBy),
        });

        const transformedBlogs = result.blogs.map((blog) =>
          transformBlogData(blog, fields)
        );

        return {
          blogs: transformedBlogs,
          pagination: result.pagination,
        };
      } catch (error) {
        throw new Error(`Failed to fetch random blogs: ${error.message}`);
      }
    },

    // New query for blogs by genres
    blogsByGenres: async (_, { genres, input = {} }, { prisma }, info) => {
      if (!genres || genres.length === 0) {
        throw new Error("At least one genre must be provided");
      }

      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};
      const include = buildIncludeFromFields(fields);
      const { page = 1, limit = 10, sortBy = "latest" } = input;

      try {
        const result = await getBlogsByGenres(prisma, genres, {
          page,
          limit,
          include,
          orderBy: buildOrderBy(sortBy),
        });

        const transformedBlogs = result.blogs.map((blog) =>
          transformBlogData(blog, fields)
        );

        return {
          blogs: transformedBlogs,
          pagination: result.pagination,
        };
      } catch (error) {
        throw new Error(`Failed to fetch blogs by genres: ${error.message}`);
      }
    },

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
          select: { followingId: true },
        });

        const followedIds = followedUsers.map((f) => f.followingId);

        if (followedIds.length === 0) {
          return {
            blogs: [],
            pagination: {
              currentPage: 1,
              totalPages: 0,
              totalCount: 0,
              hasNextPage: false,
              hasPreviousPage: false,
            },
          };
        }

        const where = { authorId: { in: followedIds } };

        const [blogs, totalCount] = await Promise.all([
          prisma.blog.findMany({
            where,
            include,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          prisma.blog.count({ where }),
        ]);

        const transformedBlogs = blogs.map((blog) =>
          transformBlogData(blog, fields)
        );

        return {
          blogs: transformedBlogs,
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            hasNextPage: page < Math.ceil(totalCount / limit),
            hasPreviousPage: page > 1,
          },
        };
      } catch (error) {
        throw new Error(`Failed to fetch following blogs: ${error.message}`);
      }
    },

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
    createBlog: async (
      _,
      { title, content, image, genre },
      { user, prisma },
      info
    ) => {
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
            bookmarks: { include: { user: true } },
          },
        });

        const resolveInfo = parseResolveInfo(info);
        const fields = resolveInfo.fieldsByTypeName.Blog || {};

        return transformBlogData(blog, fields);
      } catch (err) {
        throw new Error(`Database operation failed: ${err.message}`);
      }
    },
  },
};

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

  return {
    ...blog,
    image: blog.image ? Buffer.from(blog.image).toString("base64") : null,
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
    // Add counts if they're not coming from Prisma directly
    likesCount: blog.likes?.length || 0,
    commentsCount: blog.comments?.length || 0,
    bookmarksCount: blog.bookmarks?.length || 0,
  };
};

module.exports = {
  Query: {
    blogs: async (_, __, { prisma }, info) => {
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};
      const include = buildIncludeFromFields(fields);

      const blogs = await prisma.blog.findMany({
        include,
        orderBy: { createdAt: "desc" },
      });

      // Return the array directly - this matches your GET_BLOGS query structure
      return blogs.map((blog) => transformBlogData(blog, fields));
    },

    blog: async (_, { id }, { prisma }, info) => {
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};
      const include = buildIncludeFromFields(fields);

      const blog = await prisma.blog.findUnique({
        where: { id: parseInt(id) },
        include,
      });

      if (!blog) throw new Error("Blog not found");

      return transformBlogData(blog, fields);
    },

    // FIXED: Return object with blogs property to match GraphQL query structure
    forYouBlogs: async (_, __, { user, prisma }, info) => {
      if (!user) {
        throw new Error("User is not authenticated!");
      }

      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};
      const include = buildIncludeFromFields(fields);

      try {
        // Step 1: Get the user's liked blogs
        const userLikes = await prisma.like.findMany({
          where: { userId: user.id },
          include: { blog: true },
        });

        if (userLikes.length === 0) {
          return { blogs: [] }; // Return object with blogs property
        }

        // Step 2: Extract genres from liked blogs
        const likedGenres = _.flatMap(userLikes, (like) => like.blog.genre);
        const uniqueGenres = _.uniq(likedGenres);

        // Step 3: Find blogs with similar genres
        const recommendedBlogs = await prisma.blog.findMany({
          where: {
            AND: [
              { genre: { hasSome: uniqueGenres } },
              { id: { notIn: userLikes.map((like) => like.blogId) } },
            ],
          },
          include,
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        if (recommendedBlogs.length === 0) {
          // Fallback to popular blogs
          const fallbackBlogs = await prisma.blog.findMany({
            where: {
              id: { notIn: userLikes.map((like) => like.blogId) },
            },
            include,
            orderBy: { likesCount: "desc" },
            take: 10,
          });
          return { 
            blogs: fallbackBlogs.map((blog) => transformBlogData(blog, fields)) 
          };
        }

        return { 
          blogs: recommendedBlogs.map((blog) => transformBlogData(blog, fields)) 
        };
      } catch (error) {
        console.error("Error in forYouBlogs resolver:", error);
        return { blogs: [] };
      }
    },
  },

  Mutation: {
    createBlog: async (
      _,
      { title, content, image, genre, description },
      { user, prisma },
      info
    ) => {
      if (!user) throw new Error("Unauthorized");

      let imageBuffer = null;

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

      const slug = await generateSlug(title, async (slug) => {
        const existing = await prisma.blog.findUnique({ where: { slug } });
        return !!existing;
      });

      const blog = await prisma.blog.create({
        data: {
          title,
          slug,
          content,
          description,
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
    },
  },
};

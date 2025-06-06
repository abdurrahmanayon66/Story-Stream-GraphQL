const { parseResolveInfo } = require("graphql-parse-resolve-info");
const generateSlug = require("../utils/generateSlug");

const buildIncludeFromFields = (fields, user) => {
  return {
    author: true,
    comments: user ? true : undefined,
    likes: user ? true : undefined,
    bookmarks: user ? true : undefined,
    _count: {
      select: {
        comments: true,
        likes: true,
        bookmarks: true,
      },
    },
  };
};

const transformBlogData = (blog, fields, user) => {
  if (!blog) return null;

  // Check if user has liked or bookmarked the blog
  let hasLiked = false;
  let hasBookmarked = false;

  if (user && blog.likes) {
    hasLiked = blog.likes.some((like) => like.userId === user.id);
  }

  if (user && blog.bookmarks) {
    hasBookmarked = blog.bookmarks.some(
      (bookmark) => bookmark.userId === user.id
    );
  }

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
    comments: undefined,
    likes: undefined,
    bookmarks: undefined,
    likesCount: blog._count?.likes || blog.likes?.length || 0,
    commentsCount: blog._count?.comments || blog.comments?.length || 0,
    bookmarksCount: blog._count?.bookmarks || blog.bookmarks?.length || 0,
    hasLiked,
    hasBookmarked,
  };
};

module.exports = {
  Query: {
    blogs: async (_, __, { prisma, user }, info) => {
      console.log("Fetching all blogs...");
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};
      const include = buildIncludeFromFields(fields, user);

      const blogs = await prisma.blog.findMany({
        include,
        orderBy: { createdAt: "desc" },
      });
      return blogs.map((blog) => transformBlogData(blog, fields, user));
    },

    blog: async (_, { id }, { prisma, user }, info) => {
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};
      const include = buildIncludeFromFields(fields, user);

      const blog = await prisma.blog.findUnique({
        where: { id: parseInt(id) },
        include,
      });

      if (!blog) throw new Error("Blog not found");

      return transformBlogData(blog, fields, user);
    },

    forYouBlogs: async (_, __, { user, prisma }, info) => {
      console.log("Fetching blogs for you:");
      if (!user) {
        throw new Error("User is not authenticated!");
      }

      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};
      const include = buildIncludeFromFields(fields, user);

      try {
        const userLikes = await prisma.like.findMany({
          where: { userId: user.id },
          include: { blog: true },
        });

        const likedGenres = userLikes.flatMap((like) => like.blog?.genre || []);
        const uniqueGenres = [...new Set(likedGenres)];
        const likedBlogIds = userLikes.map((like) => like.blogId);

        let blogsToReturn;

        if (uniqueGenres.length > 0) {
          const recommendedBlogs = await prisma.blog.findMany({
            where: {
              AND: [
                { genre: { hasSome: uniqueGenres } },
                { id: { notIn: likedBlogIds } },
              ],
            },
            include,
            orderBy: { createdAt: "desc" },
            take: 10,
          });

          blogsToReturn = recommendedBlogs;
        }

        if (!blogsToReturn || blogsToReturn.length === 0) {
          blogsToReturn = await prisma.blog.findMany({
            include,
            orderBy: { createdAt: "desc" },
            take: 10,
          });
        }

        console.log(`Found ${blogsToReturn.length}`);

        return blogsToReturn.map((blog) =>
          transformBlogData(blog, fields, user)
        );
      } catch (error) {
        console.error("Error in forYouBlogs resolver:", error);
        return [];
      }
    },

    mostLikedBlogs: async (_, __, { prisma, user }, info) => {
      console.log("Fetching most liked blogs...");
      if (!user) {
        throw new Error("User is not authenticated!");
      }
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};
      const include = buildIncludeFromFields(fields, user);

      const blogs = await prisma.blog.findMany({
        include: {
          ...include,
          _count: {
            select: {
              likes: true,
              comments: true,
              bookmarks: true,
            },
          },
        },
      });

      const blogsWithLikes = blogs.filter((blog) => blog._count.likes > 0);

      blogsWithLikes.sort((a, b) => {
        if (b._count.likes === a._count.likes) {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        return b._count.likes - a._count.likes;
      });

      return blogsWithLikes.map((blog) =>
        transformBlogData(blog, fields, user)
      );
    },
    myBlogs: async (_, __, { user, prisma }, info) => {
      console.log("Fetching my blogs...");
      if (!user) {
        throw new Error("User is not authenticated!");
      }

      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};
      const include = buildIncludeFromFields(fields, user);

      const myBlogs = await prisma.blog.findMany({
        where: { authorId: user.id },
        include,
        orderBy: { createdAt: "desc" },
      });

      return myBlogs.map((blog) => transformBlogData(blog, fields, user));
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
          likes: true,
          bookmarks: true,
          _count: {
            select: {
              comments: true,
              likes: true,
              bookmarks: true,
            },
          },
        },
      });

      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};

      return transformBlogData(blog, fields, user);
    },
  },
};

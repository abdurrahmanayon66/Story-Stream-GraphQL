const { parseResolveInfo } = require("graphql-parse-resolve-info");
const generateSlug = require("../utils/generateSlug");

module.exports = {
  Query: {
    blogs: async (_, __, { prisma }, info) => {
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};

      const include = {};
      if (fields.author) include.author = true;
      if (fields.comments) include.comments = true;
      if (fields.likes) include.likes = true;

      const blogs = await prisma.blog.findMany({ include });

      return blogs.map((blog) => ({
        ...blog,
        image: fields.image ? Buffer.from(blog.image).toString("base64") : null,
        author: blog.author
          ? {
              ...blog.author,
              image:
                fields.author?.image && blog.author.image
                  ? Buffer.from(blog.author.image).toString("base64")
                  : null,
              profileImage: fields.author?.profileImage
                ? blog.author.profileImage
                : null,
            }
          : null,
      }));
    },

    blog: async (_, { id }, { prisma }, info) => {
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};

      const include = {};
      if (fields.author) include.author = true;
      if (fields.comments) include.comments = true;
      if (fields.likes) include.likes = true;

      const blog = await prisma.blog.findUnique({
        where: { id: parseInt(id) },
        include,
      });

      if (!blog) throw new Error("Blog not found");

      return {
        ...blog,
        image: fields.image ? Buffer.from(blog.image).toString("base64") : null,
        author: blog.author
          ? {
              ...blog.author,
              image:
                fields.author?.image && blog.author.image
                  ? Buffer.from(blog.author.image).toString("base64")
                  : null,
              profileImage: fields.author?.profileImage
                ? blog.author.profileImage
                : null,
            }
          : null,
      };
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

      let imageFile = null;
      let imageBuffer = null;

      try {
        if (image?.file) imageFile = await image.file;
        else if (image?.createReadStream) imageFile = image;
        else if (typeof image?.then === "function") imageFile = await image;
        else if (image) imageFile = image;

        if (!imageFile || typeof imageFile.createReadStream !== "function") {
          throw new Error("A valid image file is required");
        }

        const stream = imageFile.createReadStream();
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        imageBuffer = Buffer.concat(chunks);
        if (!imageBuffer.length) throw new Error("Image file is empty");
      } catch (error) {
        throw new Error(`Image processing failed: ${error.message}`);
      }

      // Generate unique slug
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
        });

        const resolveInfo = parseResolveInfo(info);
        const fields = resolveInfo.fieldsByTypeName.Blog || {};

        let author = null;
        if (fields.author) {
          author = await prisma.user.findUnique({
            where: { id: blog.authorId },
          });
        }

        return {
          ...blog,
          image: fields.image ? Buffer.from(blog.image).toString("base64") : null,
          author: author
            ? {
                ...author,
                image:
                  fields.author?.image && author.image
                    ? Buffer.from(author.image).toString("base64")
                    : null,
                profileImage: fields.author?.profileImage
                  ? author.profileImage
                  : null,
              }
            : null,
          comments: [],
          likes: [],
        };
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

      const like = await prisma.like.create({
        data: { blogId, userId: user.id },
      });

      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Like || {};

      let likeUser = null;
      let likeBlog = null;

      if (fields.user) {
        likeUser = await prisma.user.findUnique({
          where: { id: like.userId },
        });
      }
      if (fields.blog) {
        likeBlog = await prisma.blog.findUnique({
          where: { id: like.blogId },
        });
      }

      return {
        ...like,
        user: likeUser
          ? {
              ...likeUser,
              image:
                fields.user?.image && likeUser.image
                  ? Buffer.from(likeUser.image).toString("base64")
                  : null,
              profileImage: fields.user?.profileImage
                ? likeUser.profileImage
                : null,
            }
          : null,
        blog: likeBlog
          ? {
              ...likeBlog,
              image: fields.blog?.image
                ? Buffer.from(likeBlog.image).toString("base64")
                : null,
            }
          : null,
      };
    },
  },
};

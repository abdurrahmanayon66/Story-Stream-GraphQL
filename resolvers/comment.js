// resolvers/comment.js
const { parseResolveInfo } = require("graphql-parse-resolve-info");

module.exports = {
  Mutation: {
      createComment: async (_, { blogId, content }, { user, prisma }, info) => {
      if (!user) throw new Error("Unauthorized");

      const blog = await prisma.blog.findUnique({ where: { id: blogId } });
      if (!blog) throw new Error("Blog not found");

      const comment = await prisma.comment.create({
        data: {
          content,
          blogId,
          authorId: user.id,
        },
      });

      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Comment || {};

      let author = null;
      let blogData = null;
      if (fields.author) {
        author = await prisma.user.findUnique({
          where: { id: comment.authorId },
        });
      }
      if (fields.blog) {
        blogData = await prisma.blog.findUnique({
          where: { id: comment.blogId },
        });
      }

      return {
        ...comment,
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
        blog: blogData
          ? {
              ...blogData,
              image: fields.blog?.image
                ? Buffer.from(blogData.image).toString("base64")
                : null,
            }
          : null,
      };
    },
  },
};

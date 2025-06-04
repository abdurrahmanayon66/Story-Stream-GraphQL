const { parseResolveInfo } = require("graphql-parse-resolve-info");

module.exports = {
  Mutation: {
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

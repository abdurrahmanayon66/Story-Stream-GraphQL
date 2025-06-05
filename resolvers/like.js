const { parseResolveInfo } = require("graphql-parse-resolve-info");

module.exports = {
  Mutation: {
    toggleLike: async (_, { blogId }, { user, prisma }, info) => {
      if (!user) throw new Error("Unauthorized");

      try {
        const existingLike = await prisma.like.findUnique({
          where: { blogId_userId: { blogId, userId: user.id } },
        });
        if (existingLike) {
          await prisma.like.delete({
            where: { blogId_userId: { blogId, userId: user.id } },
          });
          return { success: true, message: "Blog unliked successfully" };
        } else {
          const like = await prisma.like.create({
            data: { blogId, userId: user.id },
            include: {
              user: true,
              blog: true
            }
          });

          return like;
        }
      } catch (error) {
        throw new Error(`Failed to toggle like: ${error.message}`);
      }
    },
  },
};
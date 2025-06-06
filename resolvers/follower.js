const { parseResolveInfo } = require("graphql-parse-resolve-info");

module.exports = {
  Mutation: {
    toggleFollow: async (_, { followerId }, { user, prisma }) => {
      if (!user) throw new Error("Unauthorized");

      const existingFollow = await prisma.follower.findUnique({
        where: { userId_followerId: { userId: user.id, followerId } },
      });

      if (existingFollow) {
        await prisma.follower.delete({
          where: { userId_followerId: { userId: user.id, followerId } },
        });
        return {
          success: true,
          message: "User unfollowed successfully",
          isFollowing: false,
        };
      } else {
        await prisma.follower.create({
          data: { userId: user.id, followerId },
        });
        return {
          success: true,
          message: "User followed successfully",
          isFollowing: true,
        };
      }
    },
  },
};

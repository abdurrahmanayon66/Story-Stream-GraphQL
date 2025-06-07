const { parseResolveInfo } = require("graphql-parse-resolve-info");

module.exports = {
  Mutation: {
    toggleFollow: async (_, { followerId }, { user, prisma }) => {
      if (!user) throw new Error("Unauthorized");

      const existingFollow = await prisma.follower.findUnique({
        where: {
          userId_followerId: { userId: followerId, followerId: user.id },
        },
      });

      if (existingFollow) {
        await prisma.follower.delete({
          where: {
            userId_followerId: { userId: followerId, followerId: user.id },
          },
        });
        return {
          success: true,
          message: "User unfollowed successfully",
          isFollowing: false,
        };
      } else {
        await prisma.follower.create({
          data: { userId: followerId, followerId: user.id },
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

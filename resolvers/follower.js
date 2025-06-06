const { parseResolveInfo } = require("graphql-parse-resolve-info");

module.exports = {
  Mutation: {
    toggleFollow: async (_, { followerId }, { user, prisma }, info) => {
      if (!user) throw new Error("Unauthorized");

      try {
        const existingFollow = await prisma.follower.findUnique({
          where: { userId_followerId: { userId: user.id, followerId } },
        });

        if (existingFollow) {
          // Unfollow
          await prisma.follower.delete({
            where: { userId_followerId: { userId: user.id, followerId } },
          });
          return { success: true, message: "User unfollowed successfully" };
        } else {
          // Follow
          const follow = await prisma.follower.create({
            data: { userId: user.id, followerId },
            include: {
              user: true,
              follower: true
            }
          });

          return follow;
        }
      } catch (error) {
        throw new Error(`Failed to toggle follow: ${error.message}`);
      }
    },
  },
};
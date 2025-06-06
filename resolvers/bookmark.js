const { parseResolveInfo } = require("graphql-parse-resolve-info"); 

module.exports = {
  Mutation: {
    toggleBookmark: async (_, { blogId }, { user, prisma }, info) => {
      if (!user) throw new Error("Unauthorized");

      try {
        const existingBookmark = await prisma.bookmark.findUnique({
          where: { userId_blogId: { userId: user.id, blogId } },
        });

        if (existingBookmark) {
          // Unbookmark
          await prisma.bookmark.delete({
            where: { userId_blogId: { userId: user.id, blogId } },
          });
          return { success: true, message: "Blog unbookmarked successfully" };
        } else {
          // Bookmark
          const bookmark = await prisma.bookmark.create({
            data: { userId: user.id, blogId },
            include: {
              user: true,
              blog: true
            }
          });

          return bookmark;
        }
      } catch (error) {
        throw new Error(`Failed to toggle bookmark: ${error.message}`);
      }
    },
  },
};
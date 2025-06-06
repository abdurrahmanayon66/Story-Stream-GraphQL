const { parseResolveInfo } = require("graphql-parse-resolve-info");

module.exports = {
  Mutation: {
    toggleLike: async (_, { blogId }, { user, prisma }, info) => {
      if (!user) throw new Error("Unauthorized");

      try {
        // Check if blog exists first
        const blogExists = await prisma.blog.findUnique({
          where: { id: blogId }
        });
        
        if (!blogExists) {
          throw new Error("Blog not found");
        }

        // Check for existing like
        const existingLike = await prisma.like.findUnique({
          where: { 
            blogId_userId: { 
              blogId, 
              userId: user.id 
            } 
          },
          include: {
            user: true,
            blog: true
          }
        });

        if (existingLike) {
          // Unlike the blog
          await prisma.like.delete({
            where: { 
              blogId_userId: { 
                blogId, 
                userId: user.id 
              } 
            }
          });
          
          return { 
            success: true, 
            message: "Blog unliked successfully",
            isLiked: false,
            like: null
          };
        } else {
          // Like the blog
          const newLike = await prisma.like.create({
            data: { 
              blogId, 
              userId: user.id 
            },
            include: {
              user: true,
              blog: true
            }
          });

          return { 
            success: true, 
            message: "Blog liked successfully",
            isLiked: true,
            like: newLike
          };
        }
      } catch (error) {
        console.error("Like toggle error:", error);
        throw new Error(`Failed to toggle like: ${error.message}`);
      }
    },
  },
};
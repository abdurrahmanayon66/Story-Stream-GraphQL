const { parseResolveInfo } = require("graphql-parse-resolve-info");

module.exports = {
  Query: {
    currentUser: async (_, __, { user, prisma }, info) => {
      if (!user) throw new Error("Unauthorized");
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.User || {};

      const foundUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      if (!foundUser) throw new Error("User not found");

      return {
        ...foundUser,
        image:
          fields.image && foundUser.image
            ? Buffer.from(foundUser.image).toString("base64")
            : null,
        profileImage: fields.profileImage ? foundUser.profileImage : null,
      };
    },

     followerSuggestions: async (_, __, { user, prisma }, info) => {
      if (!user) throw new Error("Unauthorized");
      
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.User || {};

      // Get all users except the current user
      const allUsers = await prisma.user.findMany({
        where: {
          id: { not: user.id }
        },
        include: {
          followers: {
            where: {
              followerId: user.id
            }
          }
        }
      });

      // Transform users with isFollowing flag and image conversion
      return allUsers.map(userData => ({
        ...userData,
        image: fields.image && userData.image 
          ? Buffer.from(userData.image).toString("base64") 
          : null,
        profileImage: fields.profileImage ? userData.profileImage : null,
        isFollowing: userData.followers.length > 0, // If there's any follower record, it means current user is following
        followers: undefined // Remove the included followers data as we don't need it in the response
      }));
    },

    isUsernameAvailable: async (_, { username }, { prisma }) => {
      console.log("username", username);
      if (!username || typeof username !== 'string') {
        throw new Error("Invalid or missing username");
      }

      const existingUser = await prisma.user.findUnique({
        where: { username },
      });

      return {
        exists: existingUser ? true : false,
      };
    },
  },
};

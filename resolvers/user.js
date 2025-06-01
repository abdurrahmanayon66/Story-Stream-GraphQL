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
    
    isUsernameAvailable: async (_, { username }, { prisma }) => {
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

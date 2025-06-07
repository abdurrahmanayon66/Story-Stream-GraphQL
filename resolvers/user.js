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

    followerSuggestions: async (
      _,
      { cursor, limit = 5 },
      { user, prisma },
      info
    ) => {
      if (!user) throw new Error("Unauthorized");

      const resolveInfo = parseResolveInfo(info);

      // Top-level fields from FollowerSuggestionsResponse
      const topLevelFields =
      resolveInfo.fieldsByTypeName.FollowerSuggestionsResponse || {};
      const usersField = topLevelFields.users;

      // Parse nested User fields if they exist
      let userFields = {};
      if (
        usersField &&
        usersField.fieldsByTypeName &&
        usersField.fieldsByTypeName.User
      ) {
        fields = usersField.fieldsByTypeName.User;
      }

      // Build where clause for pagination
      const whereClause = {
        id: { not: user.id },
      };

      // Add cursor condition if provided
      if (cursor) {
        whereClause.id = {
          ...whereClause.id,
          gt: cursor, // Get users with id greater than cursor
        };
      }

      // Get users with limit + 1 to check if there are more
      const users = await prisma.user.findMany({
        where: whereClause,
        include: {
          followers: {
            where: {
              followerId: user.id,
            },
          },
        },
        orderBy: {
          id: "asc", // Ensure consistent ordering
        },
        take: limit + 1, // Take one extra to determine if there are more
      });

      // Check if there are more users
      const hasMore = users.length > limit;

      // Remove the extra user if it exists
      const usersToReturn = hasMore ? users.slice(0, limit) : users;

      // Get the next cursor (last user's id)
      const nextCursor = hasMore
        ? usersToReturn[usersToReturn.length - 1]?.id
        : null;

      // Transform users with isFollowing flag and image conversion
      const transformedUsers = usersToReturn.map((userData) => ({
        ...userData,
        image:
          fields.image && userData.image
            ? Buffer.from(userData.image).toString("base64")
            : null,
        profileImage: fields.profileImage ? userData.profileImage : null,
        isFollowing: userData.followers.length > 0, // If there's any follower record, it means current user is following
        followers: undefined,
      }));

      return {
        users: transformedUsers,
        nextCursor,
        hasMore,
      };
    },

    isUsernameAvailable: async (_, { username }, { prisma }) => {
      console.log("username", username);
      if (!username || typeof username !== "string") {
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

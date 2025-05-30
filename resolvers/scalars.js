// resolvers/scalars.js
module.exports = {
  DateTime: {
    serialize: (value) => new Date(value).toISOString(),
  },
  AuthResult: {
    __resolveType(obj) {
      if (obj.accessToken && obj.refreshToken) return "AuthPayload";
      if (obj.message && obj.code) return "AuthError";
      return null;
    },
  },
};

// resolvers/auth.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { parseResolveInfo } = require("graphql-parse-resolve-info");

module.exports = {
  Mutation: {
    register: async (_, { input }, { prisma }) => {
      try {
        const { username, email, password, image, fullName, userBio } =
          input || {};

        const file = image ? await image : null;

        if (!file || typeof file.createReadStream !== "function") {
          return {
            message: "A valid image file is required",
            code: "INVALID_IMAGE",
          };
        }

        if (!email.includes("@")) {
          return {
            message: "Invalid email format",
            code: "INVALID_EMAIL",
          };
        }

        if (password.length < 6) {
          return {
            message: "Password must be at least 6 characters long",
            code: "INVALID_PASSWORD",
          };
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          return {
            message: "Email already in use",
            code: "EMAIL_TAKEN",
          };
        }

        const stream = file.createReadStream();
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const imageBuffer = Buffer.concat(chunks);

        const hashedPassword = await bcrypt.hash(password, 12);

        const createdUser = await prisma.user.create({
          data: {
            username,
            email,
            password: hashedPassword,
            image: imageBuffer,
            fullName: fullName || null,
            userBio: userBio || null,
          },
        });

        const accessToken = jwt.sign(
          { id: createdUser.id },
          process.env.JWT_SECRET,
          {
            expiresIn: "1h",
          }
        );
        const refreshToken = jwt.sign(
          { id: createdUser.id },
          process.env.JWT_REFRESH_SECRET,
          {
            expiresIn: "7d",
          }
        );

        return {
          accessToken,
          refreshToken,
          user: {
            id: createdUser.id,
            username: createdUser.username,
            email: createdUser.email,
            fullName: createdUser.fullName,
            userBio: createdUser.userBio,
            createdAt: createdUser.createdAt,
          },
        };
      } catch (err) {
        return {
          message: `Internal server error: ${err.message}`,
          code: "INTERNAL_ERROR",
        };
      }
    },

    login: async (_, { email, password }, { prisma }) => {
      try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          return {
            message: "Invalid credentials",
            code: "INVALID_CREDENTIALS",
          };
        }

        if (!user.password) {
          return {
            message: "Account linked to OAuth provider",
            code: "OAUTH_ACCOUNT",
          };
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return {
            message: "Invalid credentials",
            code: "INVALID_CREDENTIALS",
          };
        }

        const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
          expiresIn: "1h",
        });
        const refreshToken = jwt.sign(
          { id: user.id },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: "7d" }
        );

        return {
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            userBio: user.userBio,
            createdAt: user.createdAt,
          },
        };
      } catch (err) {
        return {
          message: `Internal server error: ${err.message}`,
          code: "INTERNAL_ERROR",
        };
      }
    },

    oauthLogin: async (_, { input }, { prisma }) => {
      try {
        const { provider, providerId, email, name, profileImage } = input;

        if (!provider || !providerId || !email) {
          return {
            message: "Provider, providerId, and email are required",
            code: "INVALID_INPUT",
          };
        }

        // Generate username from email
        const emailUsername = email.split("@")[0];

        let user = await prisma.user.findFirst({
          where: {
            OR: [{ providerId: `${provider}:${providerId}` }, { email }],
          },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              providerId: `${provider}:${providerId}`,
              email,
              username: emailUsername,
              fullName: name || emailUsername,
              userBio: "",
              profileImage: profileImage || null,
              password: null,
              image: null,
            },
          });
        } else if (!user.providerId && user.email === email) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              providerId: `${provider}:${providerId}`,
            },
          });
        }

        const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
          expiresIn: "1h",
        });
        const refreshToken = jwt.sign(
          { id: user.id },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: "7d" }
        );

        return {
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.fullName || null,
            userBio: user.userBio || "",
            createdAt: user.createdAt,
          },
        };
      } catch (err) {
        return {
          message: `Internal server error: ${err.message}`,
          code: "INTERNAL_ERROR",
        };
      }
    },

    refreshToken: async (_, { refreshToken }, { prisma }, info) => {
      try {
        const decoded = jwt.verify(
          refreshToken,
          process.env.JWT_REFRESH_SECRET
        );

        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
        });
        if (!user) throw new Error("Invalid refresh token");

        const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
          expiresIn: "1h",
        });
        const newRefreshToken = jwt.sign(
          { id: user.id },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: "7d" }
        );

        const resolveInfo = parseResolveInfo(info);
        const fields = resolveInfo.fieldsByTypeName.AuthPayload?.user || {};

        return {
          accessToken,
          refreshToken: newRefreshToken,
          user: {
            ...user,
            image:
              fields.image && user.image
                ? Buffer.from(user.image).toString("base64")
                : null,
            profileImage: fields.profileImage ? user.profileImage : null,
          },
        };
      } catch (err) {
        throw new Error("Invalid refresh token");
      }
    },
  },
};

const { parseResolveInfo } = require('graphql-parse-resolve-info');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');

const resolvers = {
  DateTime: {
    serialize: (value) => new Date(value).toISOString(),
  },
  AuthResult: {
    __resolveType(obj) {
      if (obj.accessToken && obj.refreshToken) {
        return 'AuthPayload';
      }
      if (obj.message && obj.code) {
        return 'AuthError';
      }
      return null;
    },
  },
  Query: {
    currentUser: async (_, __, { user, prisma }, info) => {
      if (!user) throw new Error('Unauthorized');

      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.User || {};

      const foundUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      if (!foundUser) throw new Error('User not found');

      return {
        ...foundUser,
        image: fields.image && foundUser.image
          ? Buffer.from(foundUser.image).toString('base64')
          : null,
        profileImage: fields.profileImage ? foundUser.profileImage : null,
      };
    },
    blogs: async (_, __, { prisma }, info) => {
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};

      const include = {};
      if (fields.author) include.author = true;
      if (fields.comments) include.comments = true;
      if (fields.likes) include.likes = true;

      const blogs = await prisma.blog.findMany({ include });

      return blogs.map((blog) => ({
        ...blog,
        image: fields.image ? Buffer.from(blog.image).toString('base64') : null,
        author: blog.author
          ? {
              ...blog.author,
              image: fields.author?.image && blog.author.image
                ? Buffer.from(blog.author.image).toString('base64')
                : null,
              profileImage: fields.author?.profileImage ? blog.author.profileImage : null,
            }
          : null,
      }));
    },
    blog: async (_, { id }, { prisma }, info) => {
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};

      const include = {};
      if (fields.author) include.author = true;
      if (fields.comments) include.comments = true;
      if (fields.likes) include.likes = true;

      const blog = await prisma.blog.findUnique({
        where: { id: parseInt(id) },
        include,
      });
      if (!blog) throw new Error('Blog not found');

      return {
        ...blog,
        image: fields.image ? Buffer.from(blog.image).toString('base64') : null,
        author: blog.author
          ? {
              ...blog.author,
              image: fields.author?.image && blog.author.image
                ? Buffer.from(blog.author.image).toString('base64')
                : null,
              profileImage: fields.author?.profileImage ? blog.author.profileImage : null,
            }
          : null,
      };
    },
  },
  Mutation: {
    register: async (_, { input }, { prisma }) => {
      try {
        const { username, email, password, image } = input || {};
  
        const file = image ? await image : null;
    
        if (!file || !file.createReadStream || typeof file.createReadStream !== 'function') {
          console.log('Image validation failed:', { file });
          return {
            message: 'A valid image file is required',
            code: 'INVALID_IMAGE',
          };
        }
    
        if (!email.includes('@')) {
          return {
            message: 'Invalid email format',
            code: 'INVALID_EMAIL',
          };
        }
    
        if (password.length < 6) {
          return {
            message: 'Password must be at least 6 characters long',
            code: 'INVALID_PASSWORD',
          };
        }
    
        try {
          const existingUser = await prisma.user.findUnique({ where: { email } });
          if (existingUser) {
            return {
              message: 'Email already in use',
              code: 'EMAIL_TAKEN',
            };
          }
        } catch (err) {
          console.error('Error checking existing user:', err);
          return {
            message: `Database error while checking email: ${err.message}`,
            code: 'DATABASE_ERROR',
          };
        }
    
        const stream = file.createReadStream();
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const imageBuffer = Buffer.concat(chunks);
    
        const hashedPassword = await bcrypt.hash(password, 12);
    
        let createdUser;
        try {
          createdUser = await prisma.user.create({
            data: {
              username,
              email,
              password: hashedPassword,
              image: imageBuffer,
            },
          });
        } catch (createErr) {
          console.error('User creation error:', createErr);
          return {
            message: `Failed to create user: ${createErr.message}`,
            code: 'USER_CREATION_FAILED',
          };
        }
    
        if (!createdUser || !createdUser.id) {
          console.error('User creation failed: No valid user returned');
          return {
            message: 'Failed to create user: No user returned',
            code: 'USER_CREATION_FAILED',
          };
        }
    
        const accessToken = jwt.sign({ id: createdUser.id }, process.env.JWT_SECRET, {
          expiresIn: '15m',
        });
        const refreshToken = jwt.sign(
          { id: createdUser.id },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: '7d' }
        );
    
        return {
          accessToken,
          refreshToken,
          user: {
            id: createdUser.id,
            username: createdUser.username,
            email: createdUser.email,
            image: Buffer.from(createdUser.image).toString('base64'),
            profileImage: null,
          },
        };
      } catch (err) {
        console.error('Registration error:', err);
        return {
          message: `Internal server error: ${err.message}`,
          code: 'INTERNAL_ERROR',
        };
      }
    },
    login: async (_, { email, password }, { prisma }) => {
      try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          return {
            message: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS',
          };
        }
    
        if (!user.password) {
          return {
            message: 'Account linked to OAuth provider',
            code: 'OAUTH_ACCOUNT',
          };
        }
    
        const isValid = await bcrypt.compare(password, user.password);     
        if (!isValid) {
          return {
            message: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS',
          };
        }
    
        const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
          expiresIn: '15m',
        });
        const refreshToken = jwt.sign(
          { id: user.id },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: '7d' }
        );
    
        return {
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            image: user.image ? Buffer.from(user.image).toString('base64') : null,
            profileImage: user.profileImage,
          },
        };
      } catch (err) {
        console.error('Login error:', err);
        return {
          message: `Internal server error: ${err.message}`,
          code: 'INTERNAL_ERROR',
        };
      }
    },
    oauthLogin: async (_, { input }, { prisma }) => {
      try {
        const { provider, providerId, email, name, profileImage } = input;

        if (!provider || !providerId || !email) {
          return {
            message: 'Provider, providerId, and email are required',
            code: 'INVALID_INPUT',
          };
        }

        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { providerId: `${provider}:${providerId}` },
              { email },
            ],
          },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              providerId: `${provider}:${providerId}`,
              email,
              username: name || email.split('@')[0],
              profileImage,
              password: null,
              image: null,
            },
          });
        } else if (!user.providerId && user.email === email) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { providerId: `${provider}:${providerId}` },
          });
        }

        const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
          expiresIn: '15m',
        });
        const refreshToken = jwt.sign(
          { id: user.id },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: '7d' }
        );

        return {
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            image: user.image ? Buffer.from(user.image).toString('base64') : null,
            profileImage: user.profileImage,
          },
        };
      } catch (err) {
        console.error('OAuth login error:', err);
        return {
          message: `Internal server error: ${err.message}`,
          code: 'INTERNAL_ERROR',
        };
      }
    },
    refreshToken: async (_, { refreshToken }, { prisma }, info) => {
      try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });
        if (!user) throw new Error('Invalid refresh token');
  
        const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
          expiresIn: '15m',
        });
        const newRefreshToken = jwt.sign(
          { id: user.id },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: '7d' }
        );
  
        const resolveInfo = parseResolveInfo(info);
        const fields = resolveInfo.fieldsByTypeName.AuthPayload?.user || {};
  
        return {
          accessToken,
          refreshToken: newRefreshToken,
          user: {
            ...user,
            image: fields.image && user.image
              ? Buffer.from(user.image).toString('base64')
              : null,
            profileImage: fields.profileImage ? user.profileImage : null,
          },
        };
      } catch (err) {
        console.error('Refresh token error:', err);
        throw new Error('Invalid refresh token');
      }
    },
    createBlog: async (_, { title, content, image }, { user, prisma }, info) => {
      if (!user) throw new Error('Unauthorized');

      if (!image || !image.file) {
        throw new Error('A valid image file is required');
      }

      const { createReadStream } = await image.file;
      if (!createReadStream) throw new Error('A valid image file is required');

      const chunks = [];
      const stream = createReadStream();
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const imageBuffer = Buffer.concat(chunks);

      const blog = await prisma.blog.create({
        data: {
          title,
          content,
          image: imageBuffer,
          authorId: user.id,
        },
      });

      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};

      let author = null;
      if (fields.author) {
        author = await prisma.user.findUnique({
          where: { id: blog.authorId },
        });
      }

      return {
        ...blog,
        image: fields.image ? Buffer.from(blog.image).toString('base64') : null,
        author: author
          ? {
              ...author,
              image: fields.author?.image && author.image
                ? Buffer.from(author.image).toString('base64')
                : null,
              profileImage: fields.author?.profileImage ? author.profileImage : null,
            }
          : null,
        comments: [],
        likes: [],
      };
    },
    createComment: async (_, { blogId, content }, { user, prisma }, info) => {
      if (!user) throw new Error('Unauthorized');

      const blog = await prisma.blog.findUnique({ where: { id: blogId } });
      if (!blog) throw new Error('Blog not found');

      const comment = await prisma.comment.create({
        data: {
          content,
          blogId,
          authorId: user.id,
        },
      });

      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Comment || {};

      let author = null;
      let blogData = null;
      if (fields.author) {
        author = await prisma.user.findUnique({
          where: { id: comment.authorId },
        });
      }
      if (fields.blog) {
        blogData = await prisma.blog.findUnique({
          where: { id: comment.blogId },
        });
      }

      return {
        ...comment,
        author: author
          ? {
              ...author,
              image: fields.author?.image && author.image
                ? Buffer.from(author.image).toString('base64')
                : null,
              profileImage: fields.author?.profileImage ? author.profileImage : null,
            }
          : null,
        blog: blogData
          ? {
              ...blogData,
              image: fields.blog?.image
                ? Buffer.from(blogData.image).toString('base64')
                : null,
            }
          : null,
      };
    },
    likeBlog: async (_, { blogId }, { user, prisma }, info) => {
      if (!user) throw new Error('Unauthorized');

      const blog = await prisma.blog.findUnique({ where: { id: blogId } });
      if (!blog) throw new Error('Blog not found');

      const existingLike = await prisma.like.findUnique({
        where: { blogId_userId: { blogId, userId: user.id } },
      });
      if (existingLike) throw new Error('Blog already liked');

      const like = await prisma.like.create({
        data: {
          blogId,
          userId: user.id,
        },
      });

      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Like || {};

      let likeUser = null;
      let likeBlog = null;
      if (fields.user) {
        likeUser = await prisma.user.findUnique({
          where: { id: like.userId },
        });
      }
      if (fields.blog) {
        likeBlog = await prisma.blog.findUnique({
          where: { id: like.blogId },
        });
      }

      return {
        ...like,
        user: likeUser
          ? {
              ...likeUser,
              image: fields.user?.image && likeUser.image
                ? Buffer.from(likeUser.image).toString('base64')
                : null,
              profileImage: fields.user?.profileImage ? likeUser.profileImage : null,
            }
          : null,
        blog: likeBlog
          ? {
              ...likeBlog,
              image: fields.blog?.image
                ? Buffer.from(likeBlog.image).toString('base64')
                : null,
            }
          : null,
      };
    },
  },
};

module.exports = resolvers;
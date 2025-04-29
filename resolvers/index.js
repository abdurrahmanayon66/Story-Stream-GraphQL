const User = require('../models/User');
const Blog = require('../models/Blog');
const Comment = require('../models/Comment');
const Like = require('../models/Like');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');

const resolvers = {
  Query: {
    me: async (_, __, { user }) => {
      if (!user) throw new Error('Unauthorized');
      return await User.findById(user.id);
    },
    blogs: async () => {
      const blogs = await Blog.find().populate('author').populate('comments').populate('likes');
      return blogs.map(blog => ({
        ...blog._doc,
        image: `data:${blog.imageMimeType};base64,${blog.image.toString('base64')}`
      }));
    },
    blog: async (_, { id }) => {
      const blog = await Blog.findById(id).populate('author').populate('comments').populate('likes');
      if (!blog) throw new Error('Blog not found');
      return {
        ...blog._doc,
        image: `data:${blog.imageMimeType};base64,${blog.image.toString('base64')}`
      };
    }
  },
  Mutation: {
    register: async (_, { username, email, password }) => {
      await check('email').isEmail().run({ body: { email } });
      await check('password').isLength({ min: 6 }).run({ body: { password } });
      const errors = validationResult({ body: { email, password } });
      if (!errors.isEmpty()) throw new Error(errors.array().map(e => e.msg).join(', '));

      const existingUser = await User.findOne({ email });
      if (existingUser) throw new Error('Email already in use');

      const hashedPassword = await bcrypt.hash(password, 12);
      const user = new User({ username, email, password: hashedPassword });
      await user.save();

      const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
      const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

      return { accessToken, refreshToken, user };
    },
    login: async (_, { email, password }) => {
      const user = await User.findOne({ email });
      if (!user) throw new Error('Invalid credentials');

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) throw new Error('Invalid credentials');

      const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
      const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

      return { accessToken, refreshToken, user };
    },
    refreshToken: async (_, { refreshToken }) => {
      try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) throw new Error('Invalid refresh token');

        const accessToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
        const newRefreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

        return { accessToken, refreshToken: newRefreshToken, user };
      } catch (err) {
        throw new Error('Invalid refresh token');
      }
    },
    createBlog: async (_, { title, content, image }, { user }) => {
      if (!user) throw new Error('Unauthorized');

      const { file } = await image;
      if (!file) throw new Error('Image is required');

      const blog = new Blog({
        title,
        content,
        image: file.buffer,
        imageMimeType: file.mimetype,
        author: user.id
      });
      await blog.save();

      return {
        ...blog._doc,
        image: `data:${blog.imageMimeType};base64,${blog.image.toString('base64')}`
      };
    },
    createComment: async (_, { blogId, content }, { user }) => {
      if (!user) throw new Error('Unauthorized');

      const blog = await Blog.findById(blogId);
      if (!blog) throw new Error('Blog not found');

      const comment = new Comment({
        content,
        blog: blogId,
        author: user.id
      });
      await comment.save();

      blog.comments.push(comment.id);
      await blog.save();

      return comment;
    },
    likeBlog: async (_, { blogId }, { user }) => {
      if (!user) throw new Error('Unauthorized');

      const blog = await Blog.findById(blogId);
      if (!blog) throw new Error('Blog not found');

      const existingLike = await Like.findOne({ blog: blogId, user: user.id });
      if (existingLike) throw new Error('Blog already liked');

      const like = new Like({
        blog: blogId,
        user: user.id
      });
      await like.save();

      blog.likes.push(like.id);
      await blog.save();

      return like;
    }
  }
};

module.exports = resolvers;
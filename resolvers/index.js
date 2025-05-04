const { parseResolveInfo } = require("graphql-parse-resolve-info");
const User = require("../models/User");
const Blog = require("../models/Blog");
const Comment = require("../models/Comment");
const Like = require("../models/Like");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");

const resolvers = {
  Query: {
    currentUser: async (_, __, { user }, info) => {
      if (!user) throw new Error("Unauthorized");

      // Parse requested fields
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.User || {};

      // Fetch user with lean for efficiency
      const foundUser = await User.findById(user.id).lean();
      if (!foundUser) throw new Error("User not found");

      // Convert image to base64 only if requested
      return {
        ...foundUser,
        id: foundUser._id,
        image: fields.image
          ? Buffer.from(foundUser.image).toString("base64")
          : null,
        createdAt: foundUser.createdAt.toISOString(),
      };
    },
    blogs: async (_, __, ___, info) => {
      // Parse requested fields
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};

      // Build query based on requested fields
      let query = Blog.find().lean();
      if (fields.author) query = query.populate("author");
      if (fields.comments) query = query.populate("comments");
      if (fields.likes) query = query.populate("likes");

      const blogs = await query;

      // Convert image to base64 only if requested
      return blogs.map((blog) => ({
        ...blog,
        id: blog._id,
        image: fields.image ? Buffer.from(blog.image).toString("base64") : null,
        createdAt: blog.createdAt.toISOString(),
        author: blog.author
          ? {
              ...blog.author,
              id: blog.author._id,
              image: fields.author?.image
                ? Buffer.from(blog.author.image).toString("base64")
                : null,
              createdAt: blog.author.createdAt.toISOString(),
            }
          : null,
      }));
    },
    blog: async (_, { id }, ___, info) => {
      // Parse requested fields
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};

      // Build query based on requested fields
      let query = Blog.findById(id).lean();
      if (fields.author) query = query.populate("author");
      if (fields.comments) query = query.populate("comments");
      if (fields.likes) query = query.populate("likes");

      const blog = await query;
      if (!blog) throw new Error("Blog not found");

      // Convert image to base64 only if requested
      return {
        ...blog,
        id: blog._id,
        image: fields.image ? Buffer.from(blog.image).toString("base64") : null,
        createdAt: blog.createdAt.toISOString(),
        author: blog.author
          ? {
              ...blog.author,
              id: blog.author._id,
              image: fields.author?.image
                ? Buffer.from(blog.author.image).toString("base64")
                : null,
              createdAt: blog.author.createdAt.toISOString(),
            }
          : null,
      };
    },
  },
  Mutation: {
    register: async (_, { input }, ___, info) => {
      const { username, email, password, image } = input;
    
      // Validation
      await check("email").isEmail().run({ body: { email } });
      await check("password").isLength({ min: 6 }).run({ body: { password } });
      await check("username").isLength({ min: 3 }).run({ body: { username } });
    
      const errors = validationResult({ body: { email, password, username } });
      if (!errors.isEmpty())
        throw new Error(
          errors
            .array()
            .map((e) => e.msg)
            .join(", ")
        );
    
      const existingUser = await User.findOne({ email });
      if (existingUser) throw new Error("Email already in use");
    
      // Process image upload
      if (!image) {
        throw new Error("A valid image file is required");
      }
    
      // Await the image promise first
      const upload = await image;
      
      if (!upload.createReadStream) {
        throw new Error("A valid image file is required");
      }
    
      const { createReadStream, mimetype, filename } = upload;
    
      const chunks = [];
      const stream = createReadStream();
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const imageBuffer = Buffer.concat(chunks);
    
      // Hash password and save user
      const hashedPassword = await bcrypt.hash(password, 12);
      const user = new User({
        username,
        email,
        password: hashedPassword,
        image: imageBuffer,
      });
      
      try {
        await user.save();
      } catch (err) {
        console.error("Error saving user:", err);
        throw new Error("Failed to register user");
      }
    
      // Generate tokens
      const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "15m",
      });
      const refreshToken = jwt.sign(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: "7d" }
      );
    
      // Parse requested fields for user
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.AuthPayload?.user || {};
    
      // Return lean user object
      return {
        accessToken,
        refreshToken,
        user: {
          ...user.toObject(),
          id: user._id,
          image: fields.image
            ? Buffer.from(user.image).toString("base64")
            : null,
          createdAt: user.createdAt.toISOString(),
        },
      };
    },
    login: async (_, { email, password }, ___, info) => {
      const user = await User.findOne({ email }).lean();
      if (!user) throw new Error("Invalid credentials");

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) throw new Error("Invalid credentials");

      const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "15m",
      });
      const refreshToken = jwt.sign(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: "7d" }
      );

      // Parse requested fields for user
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.AuthPayload?.user || {};

      return {
        accessToken,
        refreshToken,
        user: {
          ...user,
          id: user._id,
          image: fields.image
            ? Buffer.from(user.image).toString("base64")
            : null,
          createdAt: user.createdAt.toISOString(),
        },
      };
    },
    refreshToken: async (_, { refreshToken }, ___, info) => {
      try {
        // Verify refresh token using JWT_REFRESH_SECRET
        const decoded = jwt.verify(
          refreshToken,
          process.env.JWT_REFRESH_SECRET
        );

        // Fetch user with lean
        const user = await User.findById(decoded.id).lean();
        if (!user) throw new Error("Invalid refresh token");

        // Generate new tokens
        const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
          expiresIn: "15m",
        });
        const newRefreshToken = jwt.sign(
          { id: user._id },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: "7d" }
        );

        // Parse requested fields for user
        const resolveInfo = parseResolveInfo(info);
        const fields = resolveInfo.fieldsByTypeName.AuthPayload?.user || {};

        // Return response with conditional image conversion
        return {
          accessToken,
          refreshToken: newRefreshToken,
          user: {
            ...user,
            id: user._id,
            image: fields.image
              ? Buffer.from(user.image).toString("base64")
              : null,
            createdAt: user.createdAt.toISOString(),
          },
        };
      } catch (err) {
        throw new Error("Invalid refresh token");
      }
    },
    createBlog: async (_, { title, content, image }, { user }, info) => {
      if (!user) throw new Error("Unauthorized");

      // Debug: Log the image object
      console.log("Blog image received:", image);

      // Process image upload
      if (!image || typeof image.createReadStream !== "function") {
        throw new Error("A valid image file is required");
      }

      const { createReadStream } = image;
      const chunks = [];
      const stream = createReadStream();
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const imageBuffer = Buffer.concat(chunks);

      // Debug: Log buffer size
      console.log("Blog image buffer size:", imageBuffer.length);

      // Save blog
      const blog = new Blog({
        title,
        content,
        image: imageBuffer,
        author: user.id,
      });
      await blog.save();

      // Parse requested fields
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Blog || {};

      // Convert to lean and return
      const leanBlog = blog.toObject();
      return {
        ...leanBlog,
        id: leanBlog._id,
        image: fields.image
          ? Buffer.from(leanBlog.image).toString("base64")
          : null,
        createdAt: leanBlog.createdAt.toISOString(),
      };
    },
    createComment: async (_, { blogId, content }, { user }, info) => {
      if (!user) throw new Error("Unauthorized");

      const blog = await Blog.findById(blogId);
      if (!blog) throw new Error("Blog not found");

      const comment = new Comment({
        content,
        blog: blogId,
        author: user.id,
      });
      await comment.save();

      blog.comments.push(comment.id);
      await blog.save();

      // Parse requested fields
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Comment || {};

      // Optionally populate author or blog if requested
      let leanComment = comment.toObject();
      if (fields.author) {
        const author = await User.findById(comment.author).lean();
        leanComment.author = {
          ...author,
          id: author._id,
          image: fields.author?.image
            ? Buffer.from(author.image).toString("base64")
            : null,
          createdAt: author.createdAt.toISOString(),
        };
      }
      if (fields.blog) {
        const blog = await Blog.findById(comment.blog).lean();
        leanComment.blog = {
          ...blog,
          id: blog._id,
          image: fields.blog?.image
            ? Buffer.from(blog.image).toString("base64")
            : null,
          createdAt: blog.createdAt.toISOString(),
        };
      }

      return {
        ...leanComment,
        id: leanComment._id,
        createdAt: leanComment.createdAt.toISOString(),
      };
    },
    likeBlog: async (_, { blogId }, { user }, info) => {
      if (!user) throw new Error("Unauthorized");

      const blog = await Blog.findById(blogId);
      if (!blog) throw new Error("Blog not found");

      const existingLike = await Like.findOne({ blog: blogId, user: user.id });
      if (existingLike) throw new Error("Blog already liked");

      const like = new Like({
        blog: blogId,
        user: user.id,
      });
      await like.save();

      blog.likes.push(like.id);
      await blog.save();

      // Parse requested fields
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo.fieldsByTypeName.Like || {};

      // Optionally populate user or blog if requested
      let leanLike = like.toObject();
      if (fields.user) {
        const user = await User.findById(like.user).lean();
        leanLike.user = {
          ...user,
          id: user._id,
          image: fields.user?.image
            ? Buffer.from(user.image).toString("base64")
            : null,
          createdAt: user.createdAt.toISOString(),
        };
      }
      if (fields.blog) {
        const blog = await Blog.findById(like.blog).lean();
        leanLike.blog = {
          ...blog,
          id: blog._id,
          image: fields.blog?.image
            ? Buffer.from(blog.image).toString("base64")
            : null,
          createdAt: blog.createdAt.toISOString(),
        };
      }

      return {
        ...leanLike,
        id: leanLike._id,
        createdAt: leanLike.createdAt.toISOString(),
      };
    },
  },
};

module.exports = resolvers;

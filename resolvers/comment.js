const { parseResolveInfo } = require("graphql-parse-resolve-info");

module.exports = {
  Query: {
    commentsByBlogId: async (_, { blogId }, { prisma }, info) => {
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo?.fieldsByTypeName?.Comment || {};

      const comments = await prisma.comment.findMany({
        where: { blogId },
        orderBy: { createdAt: "asc" },
        include: {
          user: !!fields.user,
          parentComment: !!fields.parentCommentId,
        },
      });

      return comments.map((comment) => ({
        ...comment,
        user: comment.user
          ? {
              ...comment.user,
              image:
                fields.user?.image && comment.user.image
                  ? Buffer.from(comment.user.image).toString("base64")
                  : null,
              profileImage: fields.user?.profileImage
                ? comment.user.profileImage
                : null,
            }
          : null,
      }));
    },
  },
  Mutation: {
    createComment: async (
      _,
      { blogId, content, parentCommentId },
      { user, prisma },
      info
    ) => {
      if (!user) throw new Error("Unauthorized");

      const blog = await prisma.blog.findUnique({ where: { id: blogId } });
      if (!blog) throw new Error("Blog not found");

      if (parentCommentId) {
        const parent = await prisma.comment.findUnique({
          where: { id: parentCommentId },
        });
        if (!parent) throw new Error("Parent comment not found");
      }

      const comment = await prisma.comment.create({
        data: {
          content,
          blogId,
          userId: user.id,
          parentCommentId: parentCommentId || null,
        },
      });

      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo?.fieldsByTypeName?.Comment || {};

      const likeCount = fields.likeCount
        ? await prisma.commentLike.count({ where: { commentId: comment.id } })
        : 0;

      const hasLiked = fields.hasLiked
        ? !!(await prisma.commentLike.findFirst({
            where: {
              commentId: comment.id,
              userId: user.id,
            },
          }))
        : false;

      let userData = null;
      let blogData = null;

      if (fields.user) {
        userData = await prisma.user.findUnique({
          where: { id: comment.userId },
        });
      }
      if (fields.blog) {
        blogData = await prisma.blog.findUnique({
          where: { id: comment.blogId },
        });
      }

      return {
        ...comment,
        user: userData
          ? {
              ...userData,
              image:
                fields.user?.image && userData.image
                  ? Buffer.from(userData.image).toString("base64")
                  : null,
              profileImage: fields.user?.profileImage
                ? userData.profileImage
                : null,
            }
          : null,
        blog: blogData
          ? {
              ...blogData,
              image: fields.blog?.image
                ? Buffer.from(blogData.image).toString("base64")
                : null,
            }
          : null,
        likeCount,
        hasLiked,
      };
    },

    deleteComment: async (_, { commentId }, { user, prisma }) => {
      if (!user) throw new Error("Unauthorized");

      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
      });

      if (!comment) throw new Error("Comment not found");
      if (comment.userId !== user.id)
        throw new Error("Not authorized to delete this comment");

      await prisma.comment.delete({ where: { id: commentId } });
      return true;
    },

    toggleCommentLike: async (_, { commentId }, { user, prisma }) => {
      if (!user) throw new Error("Unauthorized");

      const existingLike = await prisma.commentLike.findUnique({
        where: {
          commentId_userId: {
            commentId,
            userId: user.id,
          },
        },
      });

      if (existingLike) {
        await prisma.commentLike.delete({
          where: {
            commentId_userId: {
              commentId,
              userId: user.id,
            },
          },
        });
        return false;
      } else {
        await prisma.commentLike.create({
          data: {
            commentId,
            userId: user.id,
          },
        });
        return true;
      }
    },
  },
};

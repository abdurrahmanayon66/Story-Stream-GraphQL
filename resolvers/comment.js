const { parseResolveInfo } = require("graphql-parse-resolve-info");

module.exports = {
  Query: {
   commentsByBlogId: async (_, { blogId }, { prisma, user }, info) => {
      const resolveInfo = parseResolveInfo(info);
      const fields = resolveInfo?.fieldsByTypeName?.Comment || {};
      const allComments = await prisma.comment.findMany({
        where: { blogId },
        orderBy: { createdAt: "asc" },
        include: {
          user: true,
        },
      });

      const parentComments = allComments.filter(comment => comment.parentCommentId === null);
      const childComments = allComments.filter(comment => comment.parentCommentId !== null);

      const childrenByParentId = {};
      childComments.forEach(child => {
        if (!childrenByParentId[child.parentCommentId]) {
          childrenByParentId[child.parentCommentId] = [];
        }
        childrenByParentId[child.parentCommentId].push(child);
      });

      const allCommentIds = allComments.map(comment => comment.id);

      const likeCounts = await prisma.commentLike.groupBy({
        by: ['commentId'],
        where: {
          commentId: { in: allCommentIds }
        },
        _count: {
          commentId: true
        }
      });

      const likeCountMap = {};
      likeCounts.forEach(item => {
        likeCountMap[item.commentId] = item._count.commentId;
      });

      let userLikedComments = [];
      if (user && fields.hasLiked) {
        const userLikes = await prisma.commentLike.findMany({
          where: {
            commentId: { in: allCommentIds },
            userId: user.id
          },
          select: { commentId: true }
        });
        userLikedComments = userLikes.map(like => like.commentId);
      }

      const formatComment = (comment, isParent = false) => {
        const formattedComment = {
          ...comment,
          user: comment.user
            ? {
                ...comment.user,
                image: comment.user.image ? Buffer.from(comment.user.image).toString("base64") : null,
                profileImage: comment.user.profileImage || null,
              }
            : null,
          likeCount: likeCountMap[comment.id] || 0,
          hasLiked: userLikedComments.includes(comment.id),
          replies: [],
          replyCount: 0
        };

        if (isParent && childrenByParentId[comment.id]) {
          formattedComment.replies = childrenByParentId[comment.id].map(child => 
            formatComment(child, false)
          );
          formattedComment.replyCount = formattedComment.replies.length;
        }

        return formattedComment;
      };

      const formattedParentComments = parentComments.map(parent => 
        formatComment(parent, true)
      );

      return formattedParentComments;
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

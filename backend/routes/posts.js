const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Post = require("../models/Post");
const User = require("../models/User");
const Comment = require("../models/Comment");

const JWT_SECRET = process.env.JWT_SECRET || "college_media_secret_key";

/* ---------------- AUTH MIDDLEWARE ---------------- */
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId || decoded.id;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

// Optional auth - sets userId if token is valid, but doesn't reject if missing
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.userId || decoded.id;
    } catch {
      // Invalid token, continue without auth
    }
  }
  next();
};

/**
 * @route   GET /api/posts
 * @desc    Get feed posts with pagination
 * @access  Public (but shows more to authenticated users)
 */
router.get("/", optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build query
    const query = {
      isDeleted: false,
      visibility: 'public'
    };

    // If authenticated, include posts from followed users
    if (req.userId) {
      const user = await User.findById(req.userId).select('following');
      if (user && user.following && user.following.length > 0) {
        query.$or = [
          { visibility: 'public' },
          { user: req.userId },
          { user: { $in: user.following }, visibility: { $in: ['public', 'followers'] } }
        ];
        delete query.visibility;
      }
    }

    // Get total count
    const total = await Post.countDocuments(query);

    // Fetch posts
    const posts = await Post.find(query)
      .populate('user', 'username firstName lastName profilePicture isVerified')
      .populate({
        path: 'sharedPost',
        populate: { path: 'user', select: 'username firstName lastName profilePicture' }
      })
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Add isLiked field for authenticated users
    posts.forEach(post => {
      if (req.userId) {
        post.isLiked = post.likes.some(
          like => like.user.toString() === req.userId
        );
      } else {
        post.isLiked = false;
      }
      delete post.likes; // Remove full likes array for privacy
    });

    res.json({
      success: true,
      data: {
        posts,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalPosts: total,
          hasMore: skip + posts.length < total
        }
      },
      message: "Posts fetched successfully",
    });
  } catch (error) {
    console.error("Fetch posts error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching posts",
    });
  }
});

/**
 * @route   GET /api/posts/:id
 * @desc    Get single post with details
 * @access  Public
 */
router.get("/:id", optionalAuth, async (req, res) => {
  try {
    const postId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID",
      });
    }

    const post = await Post.findById(postId)
      .populate('user', 'username firstName lastName profilePicture isVerified')
      .populate({
        path: 'sharedPost',
        populate: { path: 'user', select: 'username firstName lastName profilePicture' }
      })
      .lean();

    if (!post || post.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Check if user has access to this post
    if (post.visibility === 'private' && (!req.userId || post.user._id.toString() !== req.userId)) {
      return res.status(403).json({
        success: false,
        message: "You don't have access to this post",
      });
    }

    // Check if current user liked this post
    if (req.userId) {
      post.isLiked = post.likes.some(
        like => like.user.toString() === req.userId
      );
    } else {
      post.isLiked = false;
    }

    // Increment view count (but not if it's the author)
    if (!req.userId || post.user._id.toString() !== req.userId) {
      await Post.findByIdAndUpdate(postId, { $inc: { viewsCount: 1 } });
      post.viewsCount += 1;
    }

    // Remove sensitive data
    delete post.likes;

    res.json({
      success: true,
      data: post,
      message: "Post fetched successfully",
    });
  } catch (error) {
    console.error("Fetch post error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching post",
    });
  }
});

/**
 * @route   PUT /api/posts/:id
 * @desc    Update a post
 * @access  Private (owner only)
 */
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const { content, media, tags, visibility } = req.body;

    const post = await Post.findById(postId);

    if (!post || post.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Check if user is the owner
    if (post.user.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own posts",
      });
    }

    // Update fields
    if (content !== undefined) {
      if (!content.trim()) {
        return res.status(400).json({
          success: false,
          message: "Post content cannot be empty",
        });
      }
      post.content = content.trim();
      post.isEdited = true;
      post.editedAt = new Date();
    }

    if (media !== undefined) post.media = media;
    if (tags !== undefined) post.tags = tags;
    if (visibility !== undefined) post.visibility = visibility;

    await post.save();
    await post.populate('user', 'username firstName lastName profilePicture');

    res.json({
      success: true,
      data: post,
      message: "Post updated successfully",
    });
  } catch (error) {
    console.error("Update post error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating post",
    });
  }
});

/**
 * @route   DELETE /api/posts/:id
 * @desc    Delete a post (soft delete)
 * @access  Private (owner only)
 */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const postId = req.params.id;

    const post = await Post.findById(postId);

    if (!post || post.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Check if user is the owner
    if (post.user.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own posts",
      });
    }

    // Soft delete
    post.isDeleted = true;
    post.deletedAt = new Date();
    await post.save();

    // Update user's post count
    await User.findByIdAndUpdate(req.userId, {
      $inc: { postCount: -1 }
    });

    res.json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting post",
    });
  }
});

/**
 * @route   POST /api/posts/:id/like
 * @desc    Toggle like on a post
 * @access  Private
 */
router.post("/:id/like", verifyToken, async (req, res) => {
  try {
    const postId = req.params.id;

    const post = await Post.findById(postId);

    if (!post || post.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    await post.toggleLike(req.userId);

    const isLiked = post.likes.some(
      like => like.user.toString() === req.userId
    );

    res.json({
      success: true,
      data: {
        isLiked,
        likesCount: post.likesCount
      },
      message: isLiked ? "Post liked" : "Post unliked",
    });
  } catch (error) {
    console.error("Toggle like error:", error);
    res.status(500).json({
      success: false,
      message: "Error toggling like",
    });
  }
});

/**
 * @route   POST /api/posts/:id/comments
 * @desc    Add a comment to a post
 * @access  Private
 */
router.post("/:id/comments", verifyToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const { content, parentComment } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Comment content is required",
      });
    }

    const post = await Post.findById(postId);

    if (!post || post.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const comment = await Comment.create({
      post: postId,
      user: req.userId,
      content: content.trim(),
      parentComment: parentComment || null
    });

    await comment.populate('user', 'username firstName lastName profilePicture');

    // Increment comment count
    await post.incrementCommentsCount();

    // If replying to a comment, increment its reply count
    if (parentComment) {
      const parentCommentDoc = await Comment.findById(parentComment);
      if (parentCommentDoc) {
        await parentCommentDoc.incrementRepliesCount();
      }
    }

    res.status(201).json({
      success: true,
      data: comment,
      message: "Comment added successfully",
    });
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({
      success: false,
      message: "Error adding comment",
    });
  }
});

/**
 * @route   GET /api/posts/:id/comments
 * @desc    Get comments for a post
 * @access  Public
 */
router.get("/:id/comments", async (req, res) => {
  try {
    const postId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({
      post: postId,
      isDeleted: false,
      parentComment: null // Only get top-level comments
    })
      .populate('user', 'username firstName lastName profilePicture isVerified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Comment.countDocuments({
      post: postId,
      isDeleted: false,
      parentComment: null
    });

    res.json({
      success: true,
      data: {
        comments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalComments: total,
          hasMore: skip + comments.length < total
        }
      },
      message: "Comments fetched successfully",
    });
  } catch (error) {
    console.error("Fetch comments error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching comments",
    });
  }
});

/**
 * @route   POST /api/posts
 * @desc    Create a new post
 * @access  Private
 */
router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      content,
      postType,
      media,
      poll,
      visibility,
      tags,
      mentions,
      location,
      sharedPost
    } = req.body;

    // Validate required fields
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Post content is required",
      });
    }

    if (content.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Post content must be less than 5000 characters",
      });
    }

    // Create post
    const post = await Post.create({
      user: req.userId,
      content: content.trim(),
      postType: postType || 'text',
      media: media || [],
      poll: poll || null,
      visibility: visibility || 'public',
      tags: tags || [],
      mentions: mentions || [],
      location: location || null,
      sharedPost: sharedPost || null
    });

    // If sharing a post, increment share count
    if (sharedPost) {
      const originalPost = await Post.findById(sharedPost);
      if (originalPost) {
        await originalPost.incrementSharesCount();
      }
    }

    // Populate user details
    await post.populate('user', 'username firstName lastName profilePicture');

    // Update user's post count
    await User.findByIdAndUpdate(req.userId, {
      $inc: { postCount: 1 }
    });

    res.status(201).json({
      success: true,
      data: post,
      message: "Post created successfully",
    });
  } catch (error) {
    console.error("Create post error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error creating post",
    });
  }
});

module.exports = router;

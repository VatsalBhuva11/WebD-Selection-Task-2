var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const Post = new Schema({
  username: String,
  imgPath: String,
  caption: String,
  date: String,
  likes: { type: Number, default: 0 },
  likedBy: Array,
  dislikes: { type: Number, default: 0 },
  dislikedBy: Array,
  comments: Array,
});

//a new schema to store the username, email, and hash of every user.
const socialMediaPosts = new Schema({
  username: String,
  posts: [Post],
});

module.exports = mongoose.model("socialMediaPost", socialMediaPosts);     
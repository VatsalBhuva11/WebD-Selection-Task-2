//each post is of a different schema that contains information about the likes, dislikes, comments on that post.
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

module.exports = mongoose.model("singlePost", Post);   
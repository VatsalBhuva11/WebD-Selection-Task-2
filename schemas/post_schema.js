var mongoose = require('mongoose');
var Schema = mongoose.Schema;

//a new schema to store the username, email, and hash of every user.
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

module.exports = mongoose.model("socialMediaPost", socialMediaPosts);     
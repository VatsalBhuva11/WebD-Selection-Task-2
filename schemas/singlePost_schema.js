//each post is of a different schema that contains information about the likes, dislikes, comments on that post.
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

const socialMediaPosts = new Schema({
  username: String,
  posts: [Post],
});

module.exports = mongoose.model("singlePost", Post);   
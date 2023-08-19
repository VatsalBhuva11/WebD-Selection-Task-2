var mongoose = require('mongoose');
var Schema = mongoose.Schema;
const Post = require('./singlePost_schema')
//a new schema to store the username, email, and hash of every user.
const socialMediaPosts = new Schema({
  username: String,
  posts: [Post],
});

module.exports = mongoose.model("socialMediaPost", socialMediaPosts);     
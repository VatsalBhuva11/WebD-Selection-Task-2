var mongoose = require('mongoose');
var Schema = mongoose.Schema;

const socialMediaUsers = new Schema({
    username: String,
    email: String,
    password: String,
    profilePic: String,
    profileVisits: { type: Number, default: 0 },
    following: Array,
    followedBy: Array,
    bio: { type: String, default: "" },
    gender: { type: String, default: "" },
  });

module.exports = mongoose.model("socialMediaUser", socialMediaUsers);     
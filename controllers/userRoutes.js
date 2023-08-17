require("dotenv").config();
const express = require("express"); //for route handling
const mongoose = require("mongoose"); //database
const jwt = require("jsonwebtoken"); //authentication and authorization
const cookieParser = require("cookie-parser"); //storing JWT generated for authentication

const multer = require("multer");

const bcrypt = require("bcrypt"); //securing passwords
const saltRounds = 10;
const PORT = process.env.PORT | 3000;

const userRoutes = require('./controllers/userRoutes');
const postRoutes = require('./controllers/postRoutes');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

//using multer to handle storage of files (posts)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/"); // Define the destination folder for uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname); // Define the filename
    },
});
const upload = multer({ storage: storage });
// app.use(express.json());

//setup a connection to the mongo database.
mongoose.connect(process.env.MONGO_URL);

//a new schema to store the username, email, and hash of every user.
const socialMediaUsers = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    profileVisits: { type: Number, default: 0 },
    following: Array,
    followedBy: Array,
    bio: { type: String, default: "" },
    gender: { type: String, default: "" },
});

const Post = new mongoose.Schema({
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

//schema to store all the posts of a given user. the posts array contains an array of posts, where
//each post is of a different schema that contains information about the likes, dislikes, comments on that post.
const socialMediaPosts = new mongoose.Schema({
    username: String,
    posts: [Post],
});

const User = mongoose.model("socialMediaUser", socialMediaUsers);
const singlePost = mongoose.model("singlePost", Post);
const Posts = mongoose.model("socialMediaPost", socialMediaPosts);

//register a user.
router.post("/users/register", (req, res) => {
    const { username, email, password, gender, bio } = req.body; //password is the user-input plain password.
    res.clearCookie("token");
    //check if a user with that username already exists or not
    User.find({ $or: [{ username: username }, { email: email }] })
        .then((users) => {
            if (users.length !== 0) {
                res.send("User already exists.");
            } else {
                //if no such user exists, salt and hash the input password, and store the hash, email, username.
                bcrypt
                    .hash(password, saltRounds)
                    .then((hash) => {
                        const newUser = new User({
                            username: username,
                            email: email,
                            password: hash,
                            gender: gender,
                            bio: bio,
                        });
                        newUser
                            .save()
                            .then(() => {
                                new Posts({ username: username })
                                    .save()
                                    .then(() => {
                                        res.send("Successfully saved user");
                                    })
                                    .catch(() => {
                                        res.send("Error occurred while registering user.");
                                    });
                            })
                            .catch(() => {
                                res.send("Some error occurred while saving user");
                            });
                    })
                    .catch((err) => res.send("Error: " + err));
            }
        })
        .catch((err) => res.send(err));
});


//login a user.
router.post("/users/login", (req, res) => {
    const { username, password } = req.body;
    User.findOne({ username }).then((foundUser) => {
        if (!foundUser) {
            res.send("User does not exist.");
        } else {
            bcrypt.compare(password, foundUser.password).then(function (result) {
                if (result) {
                    const token = jwt.sign(
                        { username: username },
                        process.env.SECRET_KEY
                    );
                    //storing the generated token as a cookie so to send the JWT along with required routes.
                    res.cookie("token", token);
                    res.json({ token }); //get hold of token here and use it as authorization header value for further requests
                } else {
                    res.send("Incorrect password!");
                }
            });
        }
    });
});


//change user password.
router.patch("/users/profile/password", authenticateToken, (req, res) => {
    User.findOne({ username: req.username })
        .then((user) => {
            const { password } = req.body;
            bcrypt.compare(password, user.password).then(function (result) {
                if (result) {
                    res.send("Can't update to the same password.");
                } else {
                    bcrypt
                        .hash(password, saltRounds)
                        .then((hash) => {
                            User.updateOne({ username: user.username }, { password: hash })
                                .then(() => {
                                    res.send("Successfully updated user's password.");
                                })
                                .catch(() => {
                                    res.send("Error occurred while updated password.");
                                });
                        })
                        .catch(() => {
                            res.send("Error occurred while comparing passwords.");
                        });
                }
            });
        })
        .catch((error) => {
            res.status(500).json({ error: "Error retrieving user profile" });
        });
});


//change user bio.
router.patch("/users/profile/bio", authenticateToken, (req, res) => {
    User.findOne({ username: req.username })
        .then((user) => {
            console.log(user);
            const { bio } = req.body;
            User.updateOne({ username: user.username }, { bio: bio })
                .then(() => {
                    res.send("Successfully updated bio!");
                })
                .catch(() => {
                    res.send("Error occurred while updating bio.");
                });
        })
        .catch((error) => {
            res.status(500).json({ error: "Error retrieving user profile" });
        });
});


//log out a user
router.post("/users/logout", (req, res) => {
    res.clearCookie("token");
    res.send("Successfully logged out!");
});


//get profile of any user (remove password field and email field for security.)
//even if password field is obtained, it is hashed so it is unusable.
router.get("/users/:username/", authenticateToken, (req, res) => {
    User.findOne({ username: req.params.username })
        .then((foundUser) => {
            if (foundUser) {
                Posts.findOne({ username: req.params.username })
                    .then((foundPosts) => {
                        res.send({
                            ...foundUser._doc,
                            ...foundPosts._doc,
                            password: "",
                            email: "",
                        });
                    })
                    .catch(() => {
                        res.send("Unable to fetch posts of the user.");
                    });
            } else {
                res.send("Unable to find user.");
            }
        })
        .catch(() => {
            res.send("Error retrieving profile.");
        });
});


//follow a user.
router.post("/users/:username/follow", authenticateToken, (req, res) => {
    const userToFollow = req.params.username;
    const userSendRequest = req.username;
    if (userToFollow === userSendRequest) {
        res.send("You cannot follow yourself.");
    } else {
        //add the user in the followedBy array of the user to follow.
        User.findOne({ username: userToFollow })
            .then((foundUser) => {
                if (foundUser) {
                    const isFollowed = foundUser.followedBy.find(
                        (user) => user === userSendRequest
                    );
                    if (isFollowed) {
                        //can't follow the same user twice from the same account.
                        res.send("You already follow this user.");
                    } else {
                        foundUser.followedBy.push(userSendRequest);
                        foundUser
                            .save()
                            .then(() => {
                                //add the user in the following array of the user that wants to follow.
                                User.findOne({ username: userSendRequest })
                                    .then((requestUser) => {
                                        requestUser.following.push(userToFollow);
                                        requestUser
                                            .save()
                                            .then(() => {
                                                res.send("Successfully followed the user!");
                                            })
                                            .catch(() => {
                                                res.send("Could not follow the user.");
                                            });
                                    })
                                    .catch(() => {
                                        res.send("Could not follow the user.");
                                    });
                            })
                            .catch(() => {
                                res.send("Could not follow the user.");
                            });
                    }
                } else {
                    res.send("User does not exist.");
                }
            })
            .catch(() => {
                res.send("Unable to process follow request.");
            });
    }
});


//unfollow a user.
router.post("/users/:username/unfollow", authenticateToken, (req, res) => {
    const userToUnfollow = req.params.username;
    const userSendRequest = req.username;
    if (userToUnfollow === userSendRequest) {
        res.send("You cannot unfollow yourself.");
    } else {
        //add the user in the followedBy array of the user to follow.
        User.findOne({ username: userToUnfollow })
            .then((foundUser) => {
                if (foundUser) {
                    const isFollowed = foundUser.followedBy.find(
                        (user) => user === userSendRequest
                    );
                    if (isFollowed) {
                        //can't follow the same user twice from the same account.
                        User.updateOne({ username: userToUnfollow }, { //remove the user from the followedBy array.
                            $pull: {
                                followedBy: userSendRequest,
                            }
                        }).then(()=>{
                            User.updateOne({username: userSendRequest}, {
                                $pull: {
                                    following: userToUnfollow,
                                }  
                            }).then(()=>{res.send("Successfully unfollowed the user.")})
                            .catch(()=>{res.send("Could not unfollow the user.")})
                        }).catch(()=>{res.send("Error occurred while unfollowing the user.")})
                    } else {
                        res.send("You do not follow this user.");
                    }
                } else {
                    res.send("User does not exist.");
                }
            })
            .catch(() => {
                res.send("Unable to process unfollow request.");
            });
    }
});



module.exports = router;
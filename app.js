require("dotenv").config();
const express = require("express"); //for route handling
const mongoose = require("mongoose"); //database
const jwt = require("jsonwebtoken"); //authentication and authorization
const cookieParser = require("cookie-parser"); //storing JWT generated for authentication

const multer = require("multer");

const bcrypt = require("bcrypt"); //securing passwords
const saltRounds = 10;
const PORT = process.env.PORT | 3000;

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
    bio: { type: String, default: "" },
    gender: { type: String, default: "" },
});

const Post = new mongoose.Schema({
    username: String,
    imgPath: String,
    caption: String,
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

app.post("/users/register", (req, res) => {
    const { username, email, password } = req.body; //password is the user-input plain password.
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

app.post("/users/login", (req, res) => {
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

app.post("/users/logout", (req, res)=>{
    res.clearCookie("token");
    res.send("Successfully logged out!");
})

//visit the profile of another user. (doesn't require authentication)
app.get("/users/:username", (req, res) => {
    const username = req.params.username;
    User.findOne({ username: username }).then((foundUser) => {
        console.log(foundUser);
        if (foundUser) {
            res.send({
                ...foundUser._doc,
                password: "",
                email: "",
            });
        } else {
            console.log("User doesn't exist.");
            res.send();
        }
    });
});

app.get("/users/:username/posts", (req, res) => {
    const username = req.params.username;
    Posts.findOne({ username: username })
        .then((foundUser) => {
            res.json(foundUser.posts);
        })
        .catch(() => {
            res.send("Error occurred while fetching posts.");
        });
});

app.post("/users/:username/:postID/like", authenticateToken, (req, res) => {
    const username = req.params.username; //the username of the user who's post is to be liked
    const postID = req.params.postID;
    if (username === req.username){ //req.username is the username of the authenticated user (the user who wants to like the post)
        res.send("Cannot like your own post.");
    } else {
        Posts.findOne({username: username})
        .then((foundUser)=>{
    
            const postToUpdate = foundUser.posts.find(post => post._id.toString() === postID);
            if (postToUpdate){
                const isLikedBy = postToUpdate.likedBy.find(user => user === req.username);
                if (isLikedBy){
                    res.send("Cannot like the same post twice.");
                }
                else{
                    postToUpdate.likes += 1;
                    postToUpdate.likedBy.push(req.username);
                    foundUser.save()
                    .then(()=>{res.send("Liked the post.")})
                    .catch(()=>{res.send("Could not like the post.")})
                }
            } else {
                res.send("Invalid post.");
            }
    
        }).catch(()=>{res.send("Error retrieving the post.")})
    }
});

app.post("/users/:username/:postID/dislike", authenticateToken, (req, res) => {
    const username = req.params.username; //the username of the user who's post is to be liked
    const postID = req.params.postID;
    if (username === req.username){ //req.username is the username of the authenticated user (the user who wants to like the post)
        res.send("Cannot dislike your own post.");
    } else {
        Posts.findOne({username: username})
        .then((foundUser)=>{
    
            const postToUpdate = foundUser.posts.find(post => post._id.toString() === postID);
            if (postToUpdate){
                const isDislikedBy = postToUpdate.dislikedBy.find(user => user === req.username);
                if (isDislikedBy){
                    res.send("Cannot dislike the same post twice.");
                }
                else{
                    postToUpdate.dislikes += 1;
                    postToUpdate.dislikedBy.push(req.username);
                    foundUser.save()
                    .then(()=>{res.send("Disliked the post.")})
                    .catch(()=>{res.send("Could not dislike the post.")})
                }
            } else {
                res.send("Invalid post.");
            }
    
        }).catch(()=>{res.send("Error retrieving the post.")})
    }
});


//add comment on a post.
app.post("/users/:username/:postID/comment", authenticateToken, (req, res)=>{
    const username = req.params.username;
    const postID = req.params.postID;
    const comment = req.body.comment; //in the urlencoded form, not form-data.
    if (comment.length === 0){
        res.send("Cannot post empty comment.");
    } else {
        Posts.findOne({username: username})
        .then((foundUser)=>{
    
            const postToUpdate = foundUser.posts.find(post => post._id.toString() === postID);
            if (postToUpdate){
                postToUpdate.comments.push({user: req.username, comment: comment});
                foundUser.save()
                .then(()=>{res.send("Added a comment on the post.")})
                .catch(()=>{res.send("Could not comment on the post.")})
            } else {
                res.send("Invalid post.");
            }
    
        }).catch(()=>{res.send("Error retrieving the post.")})
}
})

//a post request on this route when the user is logged in will give him all his info.
//does not require any form input.
app.post("/users/profile", authenticateToken, (req, res) => {
    User.findOne({ username: req.username })
        .then((foundUser) => {
            if (foundUser) {
                res.json(foundUser);
            } else {
                res.send("Unable to find user.");
            }
        })
        .catch(() => {
            res.send("Error retrieving profile.");
        });
});

//logged in user creating a new post.
app.post(
    "/users/posts/",
    authenticateToken,
    upload.single("file"),
    (req, res) => {
        // Access the filename of the uploaded file
        const uploadedFileName = "./uploads/" + req.file.filename;
        const caption = req.body.caption;
        const post = new singlePost({
            imgPath: uploadedFileName,
            caption: caption,
        });
        Posts.findOneAndUpdate(
            { username: req.username },
            { $push: { posts: post } }
        )
            .then(() => {
                res.json({
                    message: "Successfully created a new post!",
                    caption: caption,
                    filename: uploadedFileName,
                });
            })
            .catch(() => {
                res.send("Error occurred while creating new post.");
            });
    }
);


app.patch("/users/profile/password", authenticateToken, (req, res) => {
    User.findOne({ username: req.username })
        .then((user) => {
            console.log(user);
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

app.patch("/users/profile/bio", authenticateToken, (req, res) => {
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

function authenticateToken(req, res, next) {
    const token = req.cookies.token;

    if (token == null) return res.sendStatus(401);
    
    jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }
        req.username = user.username;
        next();
    });
}

app.listen(PORT, function () {
    console.log(`Listening on port ${PORT}`);
});


























//logged in user trying to update his username.
//updating username will make the current AuthToken invalid, so we need to LOGIN again.


    // app.patch("/users/profile/username", authenticateToken, (req, res) => {
    //     User.findOne({ username: req.username })
    //         .then((user) => {
    //             const { username } = req.body; //what the user wants to change the username to.
    //             //checking if there the new username is already used by some other user or not.
    //             User.findOne({ username: username })
    //                 .then((newUserExists) => {
        //                     if (newUserExists) {
    //                         res.send("A user with this username already exists.");
    //                     } else {
    
    //                         User.updateOne({ username: user.username }, { username: username })
    //                             .then(() => {
    //                                 Posts.updateOne(
    //                                     { username: user.username },
    //                                     { username: username }
    //                                 )
    //                                     .then(() => {
    //                                         res.send(
    //                                             "Successfully updated username! Please login again."
    //                                         );
    //                                     })
    //                                     .catch(() => {
    //                                         res.send("Error updating username");
    //                                     });
    //                             })
    //                             .catch(() => {
    //                                 res.send("Error updating username");
    //                             });
    //                     }
    //                 })
    //                 .catch((err) => {
    //                     res.send("Error finding user.");
    //                 });
    //         })
    //         .catch((error) => {
    //             res.status(500).json({ error: "Error retrieving user profile" });
    //         });
    // });
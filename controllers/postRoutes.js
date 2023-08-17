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

//populate feed of user with the users he follows. if no users followed, show no posts.
router.get("/users/home", authenticateToken, (req, res) => {
    const username = req.username;
    User.findOne({ username: username })
        .then((foundUser) => {
            if (foundUser) {
                //only get the posts of the users that the user follows.
                const following = foundUser.following;
                let len = following.length;
                if (len === 0) {
                    res.send("No posts available to show (follow some users first).");
                } else {
                    const posts = [];
                    //finding all the posts of all the users that the user follows.
                    Posts.find({ username: { $in: following } })
                    .then((foundFollowingUsers) => {
                        //pushing the contents of each post of each followed user.
                        foundFollowingUsers.forEach(user=>{
                            posts.push(...user.posts);
                        })
                        //shuffle the order of posts shown in the feed.
                        // Durstenfeld shuffle algorithm
                        for (var i = posts.length - 1; i > 0; i--) {
                            var j = Math.floor(Math.random() * (i + 1));
                            var temp = posts[i];
                            posts[i] = posts[j];
                            posts[j] = temp;
                        }
                    })
                    .then(()=>{res.send(posts)})
                    .catch(() => {
                        res.send("Could not populate feed.");
                    });                      
                    
                }
            }
        })
        .catch(() => {
            res.send("Error retrieving user.");
        });
});


//create a post
router.post("/users/posts/", authenticateToken, upload.single("file"), (req, res) => {
        // Access the filename of the uploaded file
        const uploadedFileName = "./uploads/" + req.file.filename;
        const caption = req.body.caption;
        const date = new Date().toLocaleDateString();
        const post = new singlePost({
            date: date,
            username: req.username,
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


//delete a post
router.delete("/users/:username/:postID", authenticateToken, (req, res) => {
    const username = req.params.username;
    const postID = req.params.postID;

    if (username !== req.username){
        res.send("Cannot delete the posts of another user!");
    } else {
        Posts.updateOne(
            { username: username },
            { $pull: { posts: { _id: postID } } }
          )
            .then(result => {
              if (result.modifiedCount > 0){
                res.send("Successfully deleted the post!");
            } else {
                res.send("Post does not exist.");
              }
            })
            .catch(error => {
              res.send('Error deleting post:', error);
            });
    }

});


//get the posts of a user.
router.get("/users/:username/posts", authenticateToken, (req, res) => {
    const username = req.params.username;
    Posts.findOne({ username: username })
        .then((foundUser) => {
            if (foundUser.posts.length === 0){
                res.send("The user has not posted anything.")
            } else {
                res.send(foundUser.posts);
            }
        })
        .catch(() => {
            res.send("Error occurred while fetching posts.");
        });
});


//like a post
router.post("/users/:username/:postID/like", authenticateToken, (req, res) => {
    const username = req.params.username; //the username of the user who's post is to be liked
    const postID = req.params.postID;
    if (username === req.username) {
        //req.username is the username of the authenticated user (the user who wants to like the post)
        res.send("Cannot like your own post.");
    } else {
        Posts.findOne({ username: username })
            .then((foundUser) => {
                const postToUpdate = foundUser.posts.find(
                    (post) => post._id.toString() === postID
                );
                if (postToUpdate) {
                    const isLikedBy = postToUpdate.likedBy.find(
                        (user) => user === req.username
                    );
                    if (isLikedBy) {
                        res.send("Cannot like the same post twice.");
                    } else {
                        postToUpdate.likes += 1;
                        postToUpdate.likedBy.push(req.username);
                        foundUser
                            .save()
                            .then(() => {
                                res.send("Liked the post.");
                            })
                            .catch(() => {
                                res.send("Could not like the post.");
                            });
                    }
                } else {
                    res.send("Invalid post.");
                }
            })
            .catch(() => {
                res.send("Error retrieving the post.");
            });
    }
});


//dislike a post
router.post("/users/:username/:postID/dislike", authenticateToken, (req, res) => {
    const username = req.params.username; //the username of the user who's post is to be liked
    const postID = req.params.postID;
    if (username === req.username) {
        //req.username is the username of the authenticated user (the user who wants to like the post)
        res.send("Cannot dislike your own post.");
    } else {
        Posts.findOne({ username: username })
            .then((foundUser) => {
                const postToUpdate = foundUser.posts.find(
                    (post) => post._id.toString() === postID
                );
                if (postToUpdate) {
                    const isDislikedBy = postToUpdate.dislikedBy.find(
                        (user) => user === req.username
                    );
                    if (isDislikedBy) {
                        res.send("Cannot dislike the same post twice.");
                    } else {
                        postToUpdate.dislikes += 1;
                        postToUpdate.dislikedBy.push(req.username);
                        foundUser
                            .save()
                            .then(() => {
                                res.send("Disliked the post.");
                            })
                            .catch(() => {
                                res.send("Could not dislike the post.");
                            });
                    }
                } else {
                    res.send("Invalid post.");
                }
            })
            .catch(() => {
                res.send("Error retrieving the post.");
            });
    }
});


//add comment on a post.
router.post("/users/:username/:postID/comment", authenticateToken, (req, res) => {
    const username = req.params.username;
    const postID = req.params.postID;
    const comment = req.body.comment; //in the urlencoded form, not form-data.
    if (comment.length === 0) {
        res.send("Cannot post empty comment.");
    } else {
        Posts.findOne({ username: username })
            .then((foundUser) => {
                const postToUpdate = foundUser.posts.find(
                    (post) => post._id.toString() === postID
                );
                if (postToUpdate) {
                    postToUpdate.comments.push({ user: req.username, comment: comment, ind: postToUpdate.comments.length + 1 });
                    foundUser
                        .save()
                        .then(() => {
                            res.send("Added a comment on the post.");
                        })
                        .catch(() => {
                            res.send("Could not comment on the post.");
                        });
                } else {
                    res.send("Invalid post.");
                }
            })
            .catch(() => {
                res.send("Error retrieving the post.");
            });
    }
});


//delete a comment (HAVE TO DO)
router.delete("/users/:username/:postID/:commentID/", authenticateToken, (req, res) => {
    const username = req.params.username; //post of which user.
    const postID = req.params.postID;
    const commentIndex = req.body.commentID; //in the urlencoded form, not form-data.
    Posts.findOne({username: username})
    .then((foundUser)=>{
        const postToUpdate = foundUser.posts.find(
            (post) => post._id.toString() === postID
        );
        if (postToUpdate){
            const commentToDelete = postToUpdate.comments.find(
                (comment) => comment.ind.toString() === commentIndex
            );
            const index = postToUpdate.comments.indexOf(commentToDelete);
            const dataType = typeof commentIndex;
            res.send({
                postToUpdate: postToUpdate,
                comments: postToUpdate.comments,
                commentToDelete: commentToDelete,
                commentIndexUser: commentIndex,
                commentIndexUserType: dataType,
                index: index
            });
            // if (index > -1) { 
            //     postToUpdate.comments.splice(index, 1); 
            //     postToUpdate.save()
            //     .then(()=>{
            //         res.send("Successfully deleted the comment");
            //     }).catch(()=>{res.send("Unable to delete the comment.")});
            // } else {
            //     res.send("No comment with this index exists on this post.")
            // }

        } else {
            res.send("Cannot find the post.");
        }
    }).catch(()=>{res.send("Could not retrieve the user.")})
});



module.exports = router;
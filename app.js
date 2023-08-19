require("dotenv").config();
const express = require("express"); //for route handling
const mongoose = require("mongoose"); //database
const jwt = require("jsonwebtoken"); //authentication and authorization
const cookieParser = require("cookie-parser"); //storing JWT generated for authentication

const multer = require("multer");

const bcrypt = require("bcrypt"); //securing passwords
const saltRounds = 10;
const PORT = process.env.PORT | 3000;
const userRoutes = require("./controller/userRoutes");

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

const User = require("./schemas/user_schema");
const Posts = require("./schemas/post_schema");
const singlePost = require("./schemas/singlePost_schema");

app.use("/users", userRoutes);

//populate feed of user with the users he follows. if no users followed, show no posts.
app.get("/users/home", authenticateToken, (req, res) => {
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
              foundFollowingUsers.forEach((user) => {
                posts.push(...user.posts);
              });
              //shuffle the order of posts shown in the feed.
              // Durstenfeld shuffle algorithm
              for (var i = posts.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = posts[i];
                posts[i] = posts[j];
                posts[j] = temp;
              }
            })
            .then(() => {
              res.send(posts);
            })
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

//show all posts of a specified user.
app.get("/users/:username/posts", authenticateToken, (req, res) => {
  const username = req.params.username;
  Posts.findOne({ username: username })
    .then((foundUser) => {
      if (foundUser) {
        if (req.username !== username) {
          foundUser.profileVisits += 1;
        }
        foundUser
          .save()
          .then(() => {
            if (foundUser.posts.length === 0) {
              res.send("The user has not posted anything.");
            } else {
              res.send(foundUser.posts);
            }
          })
          .catch(() => {
            res.send("Could not update profile visits count.");
          });
      } else {
        res.send("No such user exists.");
      }
    })
    .catch(() => {
      res.send("Error occurred while fetching posts.");
    });
});


//like the post of a user
app.post("/users/:username/:postID/like", authenticateToken, (req, res) => {
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

//dislike the post of a user
app.post("/users/:username/:postID/dislike", authenticateToken, (req, res) => {
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
app.post("/users/:username/:postID/comment", authenticateToken, (req, res) => {
  const username = req.params.username; //user who's post we want to comment on
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
          postToUpdate.comments.push({
            user: req.username,
            comment: comment,
            commIndex: postToUpdate.comments.length,
          });
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

//delete a comment
app.delete("/users/:postID/:commentID/", authenticateToken, (req, res) => {
  const username = req.username; //post of which user.
  const postID = req.params.postID;
  const commentIndex = req.params.commentID; //in the urlencoded form, not form-data.

  Posts.findOne({ username: username })
    .then((foundUser) => {
      const postToUpdate = foundUser.posts.find(
        (post) => post._id.toString() === postID
      );
      if (postToUpdate) {
        let commentToDelete;
        postToUpdate.comments.forEach((comment) => {
          if (comment.commIndex === parseInt(commentIndex)) {
            commentToDelete = comment;
          }
        });

        const index = postToUpdate.comments.indexOf(commentToDelete);

        if (index > -1) {
          postToUpdate.comments.splice(index, 1);
          foundUser
            .save()
            .then(() => {
              res.send("Successfully deleted the comment");
            })
            .catch(() => {
              res.send("Unable to delete the comment.");
            });
        } else {
          res.send("No comment with this index exists on this post.");
        }
      } else {
        res.send("Cannot find the post.");
      }
    })
    .catch(() => {
      res.send("Could not retrieve the user.");
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
    function getLastCharacters(inputString, numCharacters) {
      return inputString.slice(-numCharacters);
    }

    const extension = getLastCharacters(uploadedFileName, 3);
    const jpegExtension = getLastCharacters(uploadedFileName, 4);
    if (
      extension !== "jpg" &&
      extension !== "mp4" &&
      extension !== "png" &&
      extension !== "mov" &&
      jpegExtension !== "jpeg"
    ) {
      res.send(
        "Invalid file format. Please use a .jpg, .mp4, .png, .jpeg, .mov format."
      );
    } else {
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
  }
);

//delete a post
app.delete("/users/:postID", authenticateToken, (req, res) => {
  const username = req.username;
  const postID = req.params.postID;


    Posts.updateOne(
      { username: username },
      { $pull: { posts: { _id: postID } } }
    )
      .then((result) => {
        if (result.modifiedCount > 0) {
          res.send("Successfully deleted the post!");
        } else {
          res.send("Post does not exist.");
        }
      })
      .catch((error) => {
        res.send("Error deleting post:", error);
      });
});

app.get("/test", (req, res) => {
  res.send("Hi");
});



app.listen(PORT, function () {
  console.log(`Listening on port ${PORT}`);
});

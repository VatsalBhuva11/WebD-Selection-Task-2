require("dotenv").config();
const express = require("express"); //for route handling
const mongoose = require("mongoose"); //database
const jwt = require("jsonwebtoken"); //authentication and authorization
const cookieParser = require("cookie-parser"); //storing JWT generated for authentication
const authenticateToken = require("./authenticate");

const multer = require("multer");
const User = require("../schemas/user_schema")

const bcrypt = require("bcrypt"); //securing passwords
const saltRounds = 10;
const router = express.Router();

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

const User = require("../schemas/user_schema");

//register a user
router.post("/register", (req, res) => {
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

//login a user
router.post("/login", (req, res) => {
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

//log out the user
router.post("/logout", (req, res) => {
    if (req.cookies["token"] !== undefined) {
      res.clearCookie("token");
      res.send("Successfully logged out!");
    } else {
      res.send("No user is currently logged in.");
    }
  });

//follow a user
router.post("/:username/follow", authenticateToken, (req, res) => {
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
  
//unfollow a user
router.post("/:username/unfollow", authenticateToken, (req, res) => {
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
              User.updateOne(
                { username: userToUnfollow },
                {
                  //remove the user from the followedBy array.
                  $pull: {
                    followedBy: userSendRequest,
                  },
                }
              )
                .then(() => {
                  User.updateOne(
                    { username: userSendRequest },
                    {
                      $pull: {
                        following: userToUnfollow,
                      },
                    }
                  )
                    .then(() => {
                      res.send("Successfully unfollowed the user.");
                    })
                    .catch(() => {
                      res.send("Could not unfollow the user.");
                    });
                })
                .catch(() => {
                  res.send("Error occurred while unfollowing the user.");
                });
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

//get profile of any user (remove password field and email field for security.)
//even if password field is obtained, it is hashed so it is unusable.
router.get("/:username/", authenticateToken, (req, res) => {
    const username = req.params.username;
    User.findOne({ username: username })
      .then((foundUser) => {
        if (foundUser) {
          Posts.findOne({ username: username })
  
            .then((foundPosts) => {
              if (req.username !== username) {
                foundUser.profileVisits += 1;
              }
              foundUser
                .save()
                .then(() => {
                  res.send({
                    ...foundUser._doc,
                    ...foundPosts._doc,
                    password: "",
                    email: "",
                  });
                })
                .catch(() => {
                  res.send("Could not update profile visits count.");
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

//update the password of a user
router.patch("/profile/password", authenticateToken, (req, res) => {
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

//update the bio of a user
router.patch("/profile/bio", authenticateToken, (req, res) => {
    User.findOne({ username: req.username })
      .then((user) => {
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

//update profile pic
router.patch("/profile/profilepic",authenticateToken,upload.single("file"),(req, res) => {
      // Access the filename of the uploaded file
      const uploadedFileName = "./uploads/" + req.file.filename;
      function getLastCharacters(inputString, numCharacters) {
        return inputString.slice(-numCharacters);
      }
  
      const extension = getLastCharacters(uploadedFileName, 3);
      const jpegExtension = getLastCharacters(uploadedFileName, 4);
      if (
        extension !== "jpg" &&
        extension !== "png" &&
        jpegExtension !== "jpeg"
      ) {
        res.send("Invalid file format. Please use a .jpg, .png, .jpeg format.");
      } else {
        User.findOneAndUpdate(
          { username: req.username },
          { profilePic: uploadedFileName }
        )
          .then(() => {
            res.json({
              message: "Successfully updated your profile pic!",
              filename: uploadedFileName,
            });
          })
          .catch(() => {
            res.send("Error occurred while updating profile pic.");
          });
      }
    }
  );

module.exports = router;
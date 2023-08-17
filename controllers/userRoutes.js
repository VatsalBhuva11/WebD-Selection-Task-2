const express = require('express');
const router = express.Router();
const authenticateToken = require('./authenticate');

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
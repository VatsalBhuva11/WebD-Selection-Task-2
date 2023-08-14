require('dotenv').config()
const express = require("express");
const mongoose = require("mongoose");
const jwt = require('jsonwebtoken');
const app = express();

const bcrypt = require('bcrypt');
const saltRounds = 10;

app.use(express.urlencoded({extended: true}));
// app.use(express.json());


//setup a connection to the mongo database.
mongoose.connect(process.env.MONGO_URL);

//a new schema to store the username, email, and hash of every user.
const socialMediaUsers = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    bio: {type: String, default: ""},
    gender: {type: String, default: ""}

})

// const socialMediaPosts = new mongoose.Schema({

// })

const User = mongoose.model('socialMediaUser', socialMediaUsers);
// const Posts = new mongoose.Model('socialMediaPost', socialMediaPosts);

app.post("/users/register", (req, res)=>{
    const { username, email, password } = req.body; //password is the user-input plain password.
    //check if a user with that username already exists or not
    User.findOne({username: username})
    .then((user)=>{
        if (user){
            res.send("User already exists.");
        }
        else{
            //if no such user exists, salt and hash the input password, and store the hash, email, username.
            bcrypt.hash(password, saltRounds)
            .then((hash)=>{
                    const newUser = new User({
                        username: username,
                        email: email,
                        password: hash
                    })
                    newUser.save().then(()=>{
                        res.send("Successfully saved user")
                    })
                    .catch(()=>{res.send("Some error occurred while saving user")})
                })
            .catch(err => res.send("Error: "+err));
        }
    })
    .catch(err=>res.send(err));
})

app.post("/users/login", (req, res)=>{
    const {username, password} = req.body;
    User.findOne({username})
    .then((foundUser)=>{
        if (!foundUser){
            res.send("User does not exist.");
        }
        else{
            bcrypt.compare(password, foundUser.password).then(function(result) {
                if (result){
                    const token = jwt.sign({ username: username }, process.env.SECRET_KEY);
                    res.json({ token }); //get hold of token here and use it as authorization header value for further requests
                } else {
                    res.send("Incorrect password!");
                }
            });  
        }
    })

})

//visit the profile of another user.
app.get("/users/:username", (req, res)=>{
    const username = req.params.username;
    User.findOne({username: username})
    .then((foundUser)=>{
        console.log(foundUser);
        if (foundUser){
            res.send({
                ...foundUser._doc,
                password: "",
                email: ""
            })
        }
        else{
            console.log("User doesn't exist.");
            res.send();
        }
    })
})


//a post request on this route when the user is logged in will give him all his info.
//does not require any form input.
app.post('/users/profile', authenticateToken, (req, res)=>{
    User.findOne({username: req.username})
    .then((foundUser)=>{
        if (foundUser){
            res.json(foundUser);
        } else {
            res.send("Unable to find user.");
        }
    }).catch(()=>{res.send("Error retrieving profile.")})
})

//logged in user trying to update his username.
app.patch('/users/profile/username', authenticateToken, (req, res) => {
      User.findOne({username: req.username})
      .then((user)=>{
        const {username} = req.body; //what the user wants to change the username to.
        //checking if there the new username is already used by some other user or not.
        User.findOne({username: username})
        .then((newUserExists)=>{
            if (newUserExists){
                res.send("A user with this username already exists.");
            }
            else{
                User.updateOne({username: user.username}, {username: username})
                .then(()=>{
                    res.send("Successfully updated username!");
                }).catch(()=>{res.send("Error updating username")})
            }
        }).catch((err)=>{res.send("Error finding user.")})
      })
    .catch ((error)=> {
      res.status(500).json({ error: 'Error retrieving user profile' });
    })
  });


  app.patch('/users/profile/password', authenticateToken, (req, res) => {
    User.findOne({username: req.username})
    .then((user)=>{
        console.log(user);
      const {password} = req.body;
      bcrypt.compare(password, user.password).then(function(result) {
        if (result){
            res.send("Can't update to the same password.");
        } else {
            bcrypt.hash(password, saltRounds)
            .then((hash)=>{      
                User.updateOne({username: user.username}, {password: hash})
                .then(()=>{res.send("Successfully updated user's password.")})
                .catch(()=>{res.send("Error occurred while updated password.")})
            })
            .catch(()=>{res.send("Error occurred while comparing passwords.")});
        }
    });
    })
  .catch ((error)=> {
    res.status(500).json({ error: 'Error retrieving user profile' });
  })
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1]
    // console.log(token);
    if (token == null) return res.sendStatus(401)
  
    jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
      if (err) {return res.sendStatus(403)}
      req.username = user.username
      next()
    })
  }
  

app.listen(3000, function(){
    console.log(`Listening on port 3000`);
})
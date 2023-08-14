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
                    res.json({ token });
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

//visiting own profile when logged in.
app.post('/users/profile', authenticateToken, async (req, res) => {
    try {
      const user = await User.findOne({username: req.username});
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Error retrieving user profile' });
    }
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
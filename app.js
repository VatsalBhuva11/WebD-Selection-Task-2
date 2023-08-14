require('dotenv').config()
const express = require("express");
const mongoose = require("mongoose");
const app = express();


const bcrypt = require('bcrypt');
const saltRounds = 10;

app.use(express.urlencoded({extended: true}));

//setup a connection to the mongo database.
mongoose.connect(process.env.MONGO_URL);

//a new schema to store the username, email, and hash of every user.
const socialMediaUsers = new mongoose.Schema({
    username: String,
    email: String,
    password: String
})

// const socialMediaPosts = new mongoose.Schema({

// })

const User = mongoose.model('socialMediaUser', socialMediaUsers);
// const Posts = new mongoose.Model('socialMediaPost', socialMediaPosts);

app.post("/users", (req, res)=>{
    const { username, email, password } = req.body; //password is the user-input plain password.
    User.findOne({username: username})
    .then((user)=>{
        if (user){
            console.log("User already exists.");
        }
        else{
            bcrypt.hash(password, saltRounds)
            .then((hash)=>{
                    const newUser = new User({
                        username: username,
                        email: email,
                        password: hash
                    })
                    newUser.save().then(()=>{
                        console.log("Successfully saved user")
                    })
                    .catch(()=>{console.log("Some error occurred while saving user")})
                })
            .catch(err => console.log("Error: "+err));
        }
    })
    .catch(err=>console.log(err));
    res.send();
})



app.listen(3000, function(){
    console.log(`Listening on port 3000`);
})
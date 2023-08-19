require("dotenv").config();
const express = require("express"); //for route handling
const mongoose = require("mongoose"); //database
const PORT = process.env.PORT | 3000;
const userRoutes = require("./controller/userRoutes");
const postRoutes = require("./controller/postRoutes")

const app = express();
app.use(express.urlencoded({ extended: true }));

//setup a connection to the mongo database.
mongoose.connect(process.env.MONGO_URL);


app.use("/users", userRoutes);
app.use("/users", postRoutes);


app.get("/test", (req, res) => {
  res.send("Hi");
});



app.listen(PORT, function () {
  console.log(`Listening on port ${PORT}`);
});

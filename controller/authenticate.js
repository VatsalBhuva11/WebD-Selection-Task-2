const cookieParser = require("cookie-parser");
const express = require("express");
const app = express();
app.use(cookieParser());

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

module.exports = authenticateToken
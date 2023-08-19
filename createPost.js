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
        jpegExtension !== 'jpeg'
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
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const http = require("./src/app.js");
const { conn } = require("./src/db.js");

conn.sync({ force: false }).then(() => {
  http.listen(process.env.WSPORT || 3001, () => {
    console.log(`Server is listening at ${process.env.WSPORT || 3001}`);
  });
});
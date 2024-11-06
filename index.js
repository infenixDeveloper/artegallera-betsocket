const server = require("./src/app.js");
const { conn } = require("./src/db.js");

conn.sync({ force: true }).then(() => {
  server.listen(process.env.PORT || 3001, () => {
    console.log("Server is listening at 3001");
  });
});
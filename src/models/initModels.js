const fs = require("fs");
const path = require("path");
const basename = path.basename(__filename);
const Sequelize = require("sequelize");

exports.initModels=(sequelize) =>{
  const db = [];
  fs.readdirSync(path.join(__dirname)).filter((file) => {
      return (
        file.indexOf(".") !== 0 &&
        file !== basename &&
        file.slice(-3) === ".js" &&
        file.indexOf(".test.js") === -1
      );
  }).forEach((file) => {
    db.push(require(path.join(__dirname, file)));
  });
  db.forEach((modelName) => modelName(sequelize, Sequelize.DataTypes));
  
  console.log(sequelize.models);
  Object.keys(sequelize.models).forEach((modelDb) => {
    if (sequelize.models[modelDb].associate) {
      sequelize.models[modelDb].associate(sequelize.models);
    }
  });
  return sequelize.models;
}
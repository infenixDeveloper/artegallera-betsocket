"use strict";

require("dotenv").config();
const Sequelize = require("sequelize");
const process = require("process");
const initModels = require("./models/initModels");
const env = process.env.NODE_ENV || "development";
const config = require(__dirname + "/config/config.json")[env];
const { DB_URL } = process.env;

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(
    DB_URL,
    {
      logging: false,
      native: false,
      dialectOptions: {
        ssl: false
      }
    }
  );
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
  );
}

sequelize.models = initModels.initModels(sequelize);
module.exports = {
  sequelize,
  ...sequelize.models,
  conn: sequelize,
};
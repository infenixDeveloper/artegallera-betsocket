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
      },
      pool: {
        max: 20,  // Número máximo de conexiones en el pool
        min: 0,   // Número mínimo de conexiones
        acquire: 30000,  // Tiempo máximo para obtener una conexión
        idle: 10000  // Tiempo de inactividad antes de liberar una conexión
      },
    }
  );
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config,{
      pool: {
        max: 20,  // Número máximo de conexiones en el pool
        min: 0,   // Número mínimo de conexiones
        acquire: 30000,  // Tiempo máximo para obtener una conexión
        idle: 10000  // Tiempo de inactividad antes de liberar una conexión
    },
    }
    
  );
}

sequelize.models = initModels.initModels(sequelize);
module.exports = {
  sequelize,
  ...sequelize.models,
  conn: sequelize,
};
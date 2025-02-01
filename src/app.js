require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const helmet = require("helmet");
const { logger } = require("./utils/logger.js");
const cors = require("cors");
const env = process.env;
const server = express();

var corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
    credentials: true
};


var http = require("http").Server(server);
var io = require("socket.io")(http, {
    cors: corsOptions
});

require('./betsocket.js')(io);

server.name = "arteGallera";

if (env.NODE_ENV === 'production') {
    server.set('trust proxy', 1); // trust first proxy
}

server.use(helmet({ crossOriginEmbedderPolicy: false }));

// Configuración de CORS
server.use(cors(corsOptions));

server.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));
server.use(bodyParser.json({ limit: "50mb" }));

// Elimina el uso redundante de express.json() ya que bodyParser.json() está configurado
server.use(morgan(env.MODE));

server.use((req, res, next) => {
    logger.info(`Received a ${req.method} request for ${req.url}`);
    next();
});

server.use((err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || err;
    logger.info(`Received a ${req.method} request for ${req.url}`);
    res.status(status).send(message);
});

module.exports = http;
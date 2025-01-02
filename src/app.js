require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const helmet = require("helmet");
const routes = require("./routers/index.js");
const { logger } = require("./utils/logger.js");
const { specs, swaggerUi } = require('./swagger.js');
const env = process.env;

const server = express();
const server2 = express();

var http = require("http").Server(server);
var io = require("socket.io")(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true
    }
});

const http2 = require("http").createServer(server2);
const io2 = require("socket.io")(http2, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

require('./websocket.js')(io);
require('./betsocket.js')(io2);
require('./crontab/VerificationBetting.js')(io2);

server.name = "arteGallera";

if (env.NODE_ENV === 'production') {
    server.set('trust proxy', 1); // trust first proxy
}

server.use(helmet({ crossOriginEmbedderPolicy: false }));

server.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));
server.use(bodyParser.json({ limit: "50mb" }));
server.use(express.json());
server.use(morgan(env.MODE));
server.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    next();
});

server.use((req, res, next) => {
    logger.info(`Received a ${req.method} request for ${req.url}`);
    next();
});
server.use('/docs', swaggerUi.serve, swaggerUi.setup(specs));
server.use("/api/", routes);

server.use((err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || err;
    logger.info(`Received a ${req.method} request for ${req.url}`);
    res.status(status).send(message);
});


http.listen(process.env.WSPORT || 3001, () => {
    console.log(`Server is listening at ${process.env.WSPORT || 3001}`);
});

http2.listen(process.env.BETPORT || 3003, () => {
    console.log(`Server is listening at ${process.env.BETPORT || 3003}`);
});


module.exports = { server, io, io2 };
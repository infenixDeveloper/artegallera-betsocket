const { Router } = require("express");
const fs = require("fs");
const path = require("path");
const router = Router();
const basename = path.basename(__filename);
const routes = {};
const dir =path.join(__dirname, "/");

if (!fs.existsSync(dir)) {
    module.exports = router;
}
fs.readdirSync(dir)
    .filter((file) => {
        return (file.indexOf(".") !== 0 && file !== basename && file.slice(-3) === ".js");
    })
    .forEach((file) => {
        if (file !== basename) {
            let nameEnpoint = file.split(".")[0];
            routes[nameEnpoint] = require(path.join(__dirname, "/", file));
        }
    }
    );
Object.keys(routes).forEach(route => {
    router.use("/" + route, routes[route]);
})

module.exports = router;
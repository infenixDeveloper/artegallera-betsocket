const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const fs = require("fs");
const path = require("path");
const dir =path.join(__dirname, "/routers");
const apis = [];

if (!fs.existsSync(dir)) {
    console.log(`The directory ${dir} no exist.`);
}else{
    fs.readdirSync(dir)
    .filter((file) => {
        return (file.indexOf(".") !== 0 && file !== 'index' && file.slice(-3) === ".js");
    })
    .forEach((file) => {
        if (file !== 'index.js') {
            let nameEndpoint = file.split(".")[0];
            apis[nameEndpoint] = require(path.join(dir, file));
        }
    });
    Object.keys(apis).forEach(route => {
        apis.push(path.join(dir,route+".js"));
    })
}

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'arte gallera',
            version: '1.0.0',
            description: 'API para arte gallera',
        },
    },
    apis: apis, // Path to your API routes
};
const specs = swaggerJsdoc(options);

module.exports = {
    specs,
    swaggerUi,
};
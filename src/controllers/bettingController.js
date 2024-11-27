const jwt = require("jsonwebtoken");
const { betting } = require("../db");
const { Op } = require("sequelize");

async function GetAll(req, res) {
    let result = {};
    try {
        let dtabetting = await betting.findAll();
        result = {
            success: true,
            message: 'Apuesta encontrados',
            data: dtabetting
        };
    } catch (error) {
        result = {
            success: false,
            message: 'Error al ejecutar la funcion',
            error: error.message
        };
    }
    return res.json(result);
}

async function GetId(req, res) {
    let result = {};
    try {
        let { id } = req.params;
        let dtabetting = await betting.findByPk(id);
        if (dtabetting) {
            result = {
                success: true,
                message: 'Apuesta encontrado',
                data: dtabetting
            };
        } else {
            result = {
                success: false,
                message: 'Apuesta no encontrado'
            };
        }
    } catch (error) {
        result = {
            success: false,
            message: 'Error al ejecutar la funcion',
            error: error.message
        };
    }
    return res.json(result);
}

async function Create(req, res) {
    let result = {};
    try {
        let { id_user, id_event, amount, team, id_round } = req.body;
        let dtabetting = await betting.create({ id_user, id_event, amount, team, id_round });
        if (dtabetting) {
            result = {
                success: true,
                message: 'Apuesta creada con éxito'
            };
        }
    } catch (error) {
        result = {
            success: false,
            message: 'Error al ejecutar la funcion',
            error: error.message
        };
    }
    return res.json(result);
}

async function Update(req, res) {
    let result = {};
    try {
        let { id } = req.params;
        let { name, date, location } = req.body;
        let dtabetting = await betting.update({ name, date, location }, { where: { id } });
        if (dtabetting) {
            result = {
                success: false,
                message: 'Error al actualizar el Apuesta'
            };
        }
    } catch (error) {
        result = {
            success: false,
            message: 'Error al ejecutar la funcion',
            error: error.message
        };
    }
    return res.json(result);
}

async function Delete(req, res) {
    let result = {};
    try {
        let { id } = req.params;
        let dtabetting = await betting.destroy({ where: { id } });
        if (dtabetting) {
            result = {
                success: false,
                message: 'Error al eliminar el Apuesta'
            };
        }
    } catch (error) {
        result = {
            success: false,
            message: 'Error al ejecutar la funcion',
            error: error.message
        };
    }
    return res.json(result);
}
module.exports = {
    GetAll,
    GetId,
    Create,
    Update,
    Delete
}
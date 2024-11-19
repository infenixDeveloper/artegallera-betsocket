const jwt = require("jsonwebtoken");
const { events } = require("../db");
const { Op } = require("sequelize");

async function GetAll(req, res) {
    let result = {};
    try {
        let dtaevents = await events.findAll();
        result = {
            success: true,
            message: 'Eventos encontrados',
            data: dtaevents
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
        let dtaevent = await events.findByPk(id);
        if (dtaevent) {
            result = {
                success: true,
                message: 'Evento encontrado',
                data: dtaevent
            };
        } else {
            result = {
                success: false,
                message: 'Evento no encontrado'
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
        let { name, date, time, location } = req.body;
        let dtaevent = await events.create({ name, date, time, location });
        if (dtaevent) {
            result = {
                success: false,
                message: 'Error al crear el evento'
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
        let dtaevent = await events.update({ name, date, location }, { where: { id } });
        if (dtaevent) {
            result = {
                success: false,
                message: 'Error al actualizar el evento'
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
        let dtaevent = await events.destroy({ where: { id } });
        if (dtaevent) {
            result = {
                success: false,
                message: 'Error al eliminar el evento'
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
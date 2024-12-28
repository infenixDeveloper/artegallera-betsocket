const jwt = require("jsonwebtoken");
const { rounds, betting, users, winners } = require("../db");
const { Op } = require("sequelize");

async function GetAll(req, res) {
    let result = {};
    try {
        let dtarounds = await rounds.findAll();
        result = {
            success: true,
            message: 'Rondas encontrados',
            data: dtarounds
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

async function GetRoundByEventId(req, res) {
    let result = {}
    try {
        const { id } = req.params

        const allRounds = await rounds.findAll({
            where: { id_event: id },
            include: [
                {
                    model: winners,
                    as: 'winners',
                },
            ]
        },)

        if (allRounds) {
            result = {
                success: true,
                message: 'Rondas encontradas',
                data: allRounds
            };
        } else {
            result = {
                success: false,
                message: 'Rondas no encontradas'
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

async function GetBetsById(req, res) {
    let result = {}
    try {
        const { id } = req.params

        const allRounds = await betting.findAll({
            where: { id_event: id }, include: [{
                model: users,
                as: 'user',
                attributes: ['id', 'first_name', 'last_name', 'username', 'email']
            }]
        },)

        if (allRounds) {
            result = {
                success: true,
                message: 'Rondas encontradas',
                data: allRounds
            };
        } else {
            result = {
                success: false,
                message: 'Rondas no encontradas'
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

async function GetId(req, res) {
    let result = {};
    try {
        let { id } = req.params;
        let dtarounds = await events.findByPk(id);
        if (dtarounds) {
            result = {
                success: true,
                message: 'Ronda encontrado',
                data: dtarounds
            };
        } else {
            result = {
                success: false,
                message: 'Ronda no encontrado'
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
        let { name, date, location } = req.body;
        let dtaround = await rounds.create({ name, date, location });
        if (dtaround) {
            result = {
                success: false,
                message: 'Error al crear la ronda'
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
        let dtaround = await rounds.update({ name, date, location }, { where: { id } });
        if (dtaround) {
            result = {
                success: false,
                message: 'Error al actualizar la ronda'
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
        let dtaround = await rounds.destroy({ where: { id } });
        if (dtaround) {
            result = {
                success: false,
                message: 'Error al eliminar la ronda'
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
    Delete, GetRoundByEventId
}
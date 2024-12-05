const { betting, users, events } = require("../db");
const { Op } = require("sequelize");

async function GetAll(req, res) {
    try {
        const dtabetting = await betting.findAll({
            include: [
                { model: users, attributes: ['username'] },
                { model: events, attributes: ['name'] }
            ],
        });
        return res.json({
            success: true,
            message: 'Apuestas encontradas',
            data: dtabetting
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al obtener las apuestas',
            error: error.message
        });
    }
}

async function GetBetsByTeam(req, res) {
    const { team, id_room, id_event } = req.body;
    try {
        const totalAmount = await betting.sum('amount', {
            where: { team, id_room, id_event },
        });

        const dtabetting = await betting.findAll({
            where: { team, id_room, id_event },
            include: [
                { model: users, attributes: ['username'] },
                { model: events, attributes: ['name'] }
            ],
        });

        return res.json({
            success: true,
            message: 'Apuestas encontradas',
            totalAmount,
            data: totalAmount
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al obtener las apuestas',
            error: error.message
        });
    }
}


async function GetId(req, res) {
    const { id } = req.params;
    try {
        const dtabetting = await betting.findByPk(id, {
            include: [
                { model: users, attributes: ['username'] },
                { model: events, attributes: ['name'] }
            ],
        });
        if (dtabetting) {
            return res.json({
                success: true,
                message: 'Apuesta encontrada',
                data: dtabetting
            });
        }
        return res.status(404).json({
            success: false,
            message: 'Apuesta no encontrada'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al obtener la apuesta',
            error: error.message
        });
    }
}

async function Create(req, res) {
    const { id_user, id_event, amount, team } = req.body;
    try {
        if (!id_user || !id_event || !amount || !team) {
            return res.status(400).json({
                success: false,
                message: 'Todos los campos son obligatorios'
            });
        }
        const dtabetting = await betting.create({ id_user, id_event, amount, team });
        return res.status(201).json({
            success: true,
            message: 'Apuesta creada con éxito',
            data: dtabetting
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al crear la apuesta',
            error: error.message
        });
    }
}

async function Update(req, res) {
    const { id } = req.params;
    const { amount, team } = req.body;

    try {
        if (!amount && !team) {
            return res.status(400).json({
                success: false,
                message: 'Debe proporcionar al menos un campo para actualizar'
            });
        }
        const updated = await betting.update({ amount, team }, { where: { id } });
        if (updated[0] > 0) {
            return res.json({
                success: true,
                message: 'Apuesta actualizada con éxito'
            });
        }
        return res.status(404).json({
            success: false,
            message: 'Apuesta no encontrada'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al actualizar la apuesta',
            error: error.message
        });
    }
}

async function Delete(req, res) {
    const { id } = req.params;

    try {
        const deleted = await betting.destroy({ where: { id } });
        if (deleted) {
            return res.json({
                success: true,
                message: 'Apuesta eliminada con éxito'
            });
        }
        return res.status(404).json({
            success: false,
            message: 'Apuesta no encontrada'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al eliminar la apuesta',
            error: error.message
        });
    }
}

module.exports = {
    GetAll,
    GetId,
    Create,
    Update,
    Delete,
    GetBetsByTeam
};

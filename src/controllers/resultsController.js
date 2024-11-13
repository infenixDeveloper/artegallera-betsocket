const jwt = require("jsonwebtoken");
const {results} = require("../db");
const {Op} = require("sequelize");

async function GetAll(req,res) {
    let result={};
    try {
        let dtaresults = await results.findAll();
        result = {
            success: true,
            message: 'Rondas encontrados',
            data: dtaresults
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

async function GetId(req,res){
    let result={};
    try {
        let {id} = req.params;
        let dtaresults = await events.findByPk(id);
        if(dtaresults){
            result = {
                success: true,
                message: 'Ronda encontrado',
                data: dtaresults
            };
        }else{
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
async function Create(req,res){
    let result={};
    try {
        let {Total_amount, id_round, id_event} = req.body;
        let dtaround = await results.create({Total_amount, id_round, id_event});
        if(dtaround){
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
async function Update(req,res){
    let result={};
    try {
        let {id} = req.params;
        let {Total_amount, id_round, id_event} = req.body;
        let dtaround = await results.update({Total_amount, id_round, id_event},{where:{id}});
        if(dtaround){
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
async function Delete(req,res){
    let result={};
    try {
        let {id} = req.params;
        let dtaround = await results.destroy({where:{id}});
        if(dtaround){
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
module.exports={
    GetAll,
    GetId,
    Create,
    Update,
    Delete
}
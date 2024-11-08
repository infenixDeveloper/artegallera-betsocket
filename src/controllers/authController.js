const jwt = require("jsonwebtoken");
const {users} = require("../db");
const {Op} = require("sequelize");
const bcrypt = require("bcrypt");

async function login(req,res) {
    let result={};
    let {username,password} = req.body;
    try {
        if(username !="" && password !=""){
            let dtaUser= await users.findOne({
                where: {
                    username:{
                        [Op.eq]: username
                    }
                }
            });
            if(dtaUser){
                const isMatch = await bcrypt.compare(password, dtaUser.password);
                if(isMatch){
                    let token = jwt.sign({id: dtaUser.id}, process.env.SECRET_KEY, {
                        expiresIn: 86400 // 24 hours
                    });
                    result = {
                        success: true,
                        message: 'Registro exitoso',
                        data: {
                            token: token,
                            user: dtaUser
                        }
                    };
                }else{
                    result = {
                        success: false,
                        message: 'Usuario o contraseña incorrecto'
                    };
                }
            }
        }else{
            result = {
                success: false,
                message: 'Usuario o contraseña incorrecto'
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

async function register(req,res) {
    let result={};
    let {
        username,password,
        is_active,first_name,
        last_name,initial_balance
    } = req.body;
    try {
        if(username!="" && password!="" && is_active === true && first_name!="" && last_name!="" && initial_balance >= 0){
            let user = await users.create({
                username,
                password: bcrypt.hashSync(password, 10),
                is_active,
                first_name,
                last_name,
                initial_balance
            });
            result = {
                success: true,
                message: 'Registro exitoso',
                data: user
            };
        }else{
            result = {
                success: false,
                message: 'Todos los campos son obligatorios'
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

async function forgotPassword(req,res) {
    let result={};
    try {
       let {username,password} = req.body;
       let user = await users.findOne({where:{username}});
       if(user){
           user.password = bcrypt.hashSync(password, 10);
           await user.save();
           result = {
               success: true,
               message: 'Contraseña actualizada correctamente'
           };

       }else{
            result = {
                success: false,
                message: 'Usuario no encontrado'
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
    login,
    register,
    forgotPassword
}
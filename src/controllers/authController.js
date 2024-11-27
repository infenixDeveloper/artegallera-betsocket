const jwt = require("jsonwebtoken");
const { users } = require("../db");
const { Op } = require("sequelize");
const bcrypt = require("bcrypt");

async function login(req, res) {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: 'Usuario o contraseña faltante'
        });
    }

    try {
        const dtaUser = await users.findOne({ where: { username } });

        if (!dtaUser) {
            return res.status(401).json({
                success: false,
                message: 'Usuario o contraseña incorrecto'
            });
        }

        const isMatch = await bcrypt.compare(password, dtaUser.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Usuario o contraseña incorrecto'
            });
        }

        const token = jwt.sign({ id: dtaUser.id }, process.env.SECRET_KEY, {
            expiresIn: 86400
        });

        return res.status(200).json({
            success: true,
            message: 'Inicio de sesión exitoso',
            data: {
                token,
                user: dtaUser
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al ejecutar la función',
            error: error.message
        });
    }
}


async function register(req, res) {
    let result = {};
    let {
        username, password,
        is_active, first_name,
        last_name, initial_balance, email, is_admin
    } = req.body;
    try {
        if (username != "" && password != "" && is_active === true && first_name != "" && last_name != "" && initial_balance >= 0 && email != "") {
            let user = await users.create({
                username,
                password: bcrypt.hashSync(password, 10),
                is_active,
                first_name,
                last_name,
                initial_balance,
                is_admin,
                email
            });
            result = {
                success: true,
                message: 'Registro exitoso',
                data: user
            };
        } else {
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

async function forgotPassword(req, res) {
    let result = {};
    try {
        let { username, password } = req.body;
        let user = await users.findOne({ where: { username } });
        if (user) {
            user.password = bcrypt.hashSync(password, 10);
            await user.save();
            result = {
                success: true,
                message: 'Contraseña actualizada correctamente'
            };

        } else {
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

module.exports = {
    login,
    register,
    forgotPassword
}
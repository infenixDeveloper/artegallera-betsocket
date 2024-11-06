const jwt = require("jsonwebtoken");
const {users} = require("../db");

function login({username, password}) {
    let result={};
    try {
        if(username !="" && password !=""){

        }else{

        }
    } catch (error) {
        result = {
            success: false,
            message: 'Failed to login',
            error: error
        };
    }
    return result;
}

function register({username, password}) {
    let result={};
    try {
        if(username !="" && password !=""){

        }else{

        }
    } catch (error) {
        result = {
            success: false,
            message: 'Failed to login',
            error: error
        };
    }
    return result;
}

function forgotPassword({username, password}) {
    let result={};
    try {
        if(username !="" && password !=""){

        }else{

        }
    } catch (error) {
        result = {
            success: false,
            message: 'Failed to login',
            error: error
        };
    }
    return result;
}

module.exports={
    login,
    register,
    forgotPassword
}
const { users } = require("../db");

const getUsers = async (req, res) => {
  let result = {};
  try {
    const usersData = await users.findAll();
    result = {
      success: true,
      message: "Operacion realizada con exito",
      data: usersData
    }
    return res.json(result);
  } catch (error) {
    result = {
      success: false,
      message: "Error",
      error: error.message
    }
    return res.status(500).json(result);
  }
}

const getUserById = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await users.findOne({ where: { id } });

    if (user) {
      return res.status(200).json({
        success: true,
        message: "Operación realizada con éxito",
        data: user,
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message,
    });
  }
};


const updateUser = async (req, res) => {
  const user = req.body;
  let result = {};

  if (!user.id) {
    return res.status(400).json({
      success: false,
      message: "El ID de usuario es requerido"
    });
  }

  try {
    const [updatedRows] = await users.update(user, {
      where: {
        id: user.id
      }
    });

    if (updatedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado o datos sin cambios"
      });
    }

    result = {
      success: true,
      message: "Datos actualizados con éxito",
      data: updatedRows,
    };

    return res.json(result);
  } catch (error) {
    result = {
      success: false,
      message: "Error al actualizar los datos",
      data: error.message,
    };

    return res.status(500).json(result);
  }
};

const addBalance = async (req, res) => {
  const { id, balance } = req.body;

  try {
    const user = await users.findOne({ where: { id: id } })

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const newBalance = user.initial_balance + balance;

    const response = await users.update(
      { initial_balance: newBalance },
      { where: { id: id } }
    );

    res.status(200).json({ success: true, message: "Saldo actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar el Saldo:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

const withdrawBalance = async (req, res) => {
  const { id, balance } = req.body;

  try {
    const user = await users.findOne({ where: { id: id } })

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const newBalance = user.initial_balance - balance;

    const response = await users.update(
      { initial_balance: newBalance },
      { where: { id: id } }
    );

    res.status(200).json({ success: true, message: "Saldo actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar el Saldo:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

const deleteUser = async (req, res) => {
  let result = {}
  const { id } = req.params;

  try {
    const response = await users.update({ is_active: false }, { where: { id } });

    res.status(200).json(result = { success: true, message: "Usuario Deshabilidato con éxito" });

  } catch (error) {
    console.error("Error al actualizar el usuario:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}



module.exports = { getUsers, updateUser, addBalance, withdrawBalance, deleteUser, getUserById }

const { winners, rounds, betting } = require('../db');

async function getAllWinner(req, res) {
  let result = {}
  try {
    const winner = await winners.findAll();

    if (winner) {
      result = {
        success: true,
        message: 'Ganadores encontrados',
        data: winner
      };
    }

  } catch (error) {
    result = {
      success: false,
      message: 'Error al obtener los ganadores',
      error: error.message
    };
  }
  return res.json(result);
}

async function getWinnerByEvent(req, res) {
  let result = {}
  try {
    const { id } = req.params

    const winner = await winners.findAll({
      where: { id_event: id },
      include: [{
        model: betting,
        as: "bets"
      }]
    });

    if (winner) {
      result = {
        success: true,
        message: 'Ganadores encontrados',
        data: winner
      };
    }

  } catch (error) {
    result = {
      success: false,
      message: 'Error al obtener los ganadores',
      error: error.message
    };
  }
  return res.json(result);
}

module.exports = {
  getAllWinner,
  getWinnerByEvent
}


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

const getEarningsByEvent = async (req, res) => {
  const { id } = req.params;

  try {
    const earnings = await winners.sum("earnings", {
      where: { id_event: id }
    });

    const bets = await winners.sum("total_amount", {
      where: { id_event: id }
    });

    res.json({ success: true, earnings, bets })
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error })

  }
}

module.exports = {
  getAllWinner,
  getWinnerByEvent,
  getEarningsByEvent
}


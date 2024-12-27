'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class winners extends Model {
    static associate(models) {
      winners.belongsTo(models.events, {
        foreignKey: 'id_event',
        as: 'event'
      });

      winners.belongsTo(models.rounds, {
        foreignKey: 'id_round',
        as: 'round'
      });

      winners.hasMany(models.betting, {
        foreignKey: 'id_winner',
        as: 'bets'
      });
    }
  }

  winners.init({
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    id_event: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    id_round: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    team_winner: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    red_team_amount: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    green_team_amount: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    total_amount: {
      allowNull: false,
      type: DataTypes.INTEGER,
    },
    earnings: {
      allowNull: false,
      type: DataTypes.FLOAT,
    }
  }, {
    sequelize,
    modelName: 'winners'
  });

  return winners
}
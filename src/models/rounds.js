'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class rounds extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      models.rounds.belongsTo(models.events, {
        foreignKey: 'id_event',
        targetKey: 'id'
      });
      models.rounds.belongsTo(models.betting, {
        foreignKey: 'id_round',
        targetKey: 'id'
      });
      models.rounds.hasMany(models.winners, {
        foreignKey: 'id_round',
        targetKey: 'id'
      });
    }
  }
  rounds.init({
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    round: {
      allowNull: true,
      type: DataTypes.INTEGER
    },
    Total_amount: {
      allowNull: false,
      type: DataTypes.DOUBLE
    },
    is_betting_active: {
      allowNull: false,
      type: DataTypes.BOOLEAN
    },
    id_event: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
  }, {
    sequelize,
    modelName: 'rounds',
  });
  return rounds;
};
'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class betting extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      models.betting.belongsTo(models.users, {
        foreignKey: 'id_user',
        targetKey: 'id'
      });
      models.betting.belongsTo(models.events, {
        foreignKey: 'id_event',
        targetKey: 'id'
      });
      models.betting.belongsTo(models.winners, {
        foreignKey: 'id_winner',
        as: 'winner'
      });
    }
  }
  betting.init({
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    id_user: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    id_event: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    id_winner: {
      allowNull: true,
      type: DataTypes.INTEGER
    },
    team: {
      allowNull: false,
      type: DataTypes.STRING
    },
    amount: {
      allowNull: false,
      type: DataTypes.DOUBLE
    },
  }, {
    sequelize,
    modelName: 'betting',
  });
  return betting;
};
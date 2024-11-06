'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class results extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      models.betting.belongsTo(models.events, {
        foreignKey: 'id_event',
        targetKey: 'id'
      });
      models.betting.belongsTo(models.rounds, {
        foreignKey: 'id_round',
        targetKey: 'id'
      });
    }
  }
  results.init({
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    Total_amount:{
      allowNull: false,
      type: DataTypes.DOUBLE
    },
    id_round:{
      allowNull: false,
      type: DataTypes.INTEGER
    },
    id_event:{
      allowNull: false,
      type: DataTypes.INTEGER
    },
  }, {
    sequelize,
    modelName: 'results',
  });
  return results;
};
'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class marriedBetting extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.rounds, {
        foreignKey: 'id_round',
        targetKey: 'id'
      });
      this.belongsTo(models.events, {
        foreignKey: 'id_event',
        targetKey: 'id'
      });
      this.belongsTo(models.betting, {
        foreignKey: 'id_betting_one',
        targetKey: 'id'
      });
      this.belongsTo(models.betting, {
        foreignKey: 'id_betting_two',
        targetKey: 'id'
      });
    }
  }
  marriedBetting.init({
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    id_betting_one: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    id_betting_two: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    id_event: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
    id_round: {
      allowNull: false,
      type: DataTypes.INTEGER
    },
  }, {
    sequelize,
    modelName: 'marriedbetting',
  });
  return marriedBetting;
};
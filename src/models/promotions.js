'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class promotions extends Model {
    static associate(models) {

    }
  }

  promotions.init({
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
    },
    file: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    status: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
    },
    is_event_video: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
    },
  }, {
    sequelize,
    modelName: 'promotions',
  });

  return promotions;
}
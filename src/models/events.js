'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class events extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of DataTypes lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      models.events.hasMany(models.betting, {
        foreignKey: 'id_event',
        targetKey: 'id'
      });
      models.events.hasMany(models.results, {
        foreignKey: 'id_event',
        targetKey: 'id'
      });
      models.events.hasMany(models.rounds, {
        foreignKey: 'id_event',
        targetKey: 'id'
      });
    }
  }
  events.init({
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    name: {
      allowNull: false,
      type: DataTypes.STRING
    },
    location: {
      allowNull: false,
      type: DataTypes.STRING
    },
    date: {
      allowNull: false,
      type: DataTypes.DATE
    },
    time: {
      allowNull: false,
      type: DataTypes.TIME
    },
    is_active: {
      allowNull: false,
      type: DataTypes.BOOLEAN
    },
  }, {
    sequelize,
    modelName: 'events',
  });
  return events;
};
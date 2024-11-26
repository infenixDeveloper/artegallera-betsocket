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
      models.betting.belongsTo(models.rounds, {
        foreignKey: 'id_round',
        targetKey: 'id',
        allowNull: true
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
    id_round: { // Nueva columna para almacenar el ID de la ronda
      allowNull: true, // Permitir que sea nulo si no está asociado a una ronda
      type: DataTypes.INTEGER,
      references: {
        model: 'rounds', // Nombre de la tabla a la que se refiere
        key: 'id'
      }
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
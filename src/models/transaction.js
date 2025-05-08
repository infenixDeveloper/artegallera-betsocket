'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class usertransactions extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         */
        static associate(models) {
            // Relación con 'users'
            models.usertransactions.belongsTo(models.users, {
                foreignKey: 'id_user', // 'id_user' en usertransactions es la clave foránea
                targetKey: 'id'        // 'id' en users es la clave primaria
            });

            // Relación con 'rounds' (renombrada para evitar conflicto con el atributo 'round')
            models.usertransactions.belongsTo(models.rounds, {
                foreignKey: 'id_round', // 'round' en usertransactions es la clave foránea
                targetKey: 'id',     // 'id' en rounds es la clave primaria
                as: 'roundData'      // Renombramos la asociación a 'roundData'
            });

            // Relación con 'events' a través de 'rounds'
            models.usertransactions.belongsTo(models.events, {
                foreignKey: 'id_event', // 'id_event' en usertransactions es la clave foránea
                targetKey: 'id'         // 'id' en events es la clave primaria
            });
        }
    }

    usertransactions.init({
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
            allowNull: true,
            type: DataTypes.INTEGER
        },
        round: {
            allowNull: true,
            type: DataTypes.INTEGER
        },
        id_round: {
            allowNull: true,
            type: DataTypes.INTEGER
        },
        id_round: {
            allowNull: true,
            type: DataTypes.INTEGER
        },
        type_transaction: {
            allowNull: false,
            type: DataTypes.ENUM('Apostando', 'Devolver', 'Ganancia', 'Recarga', 'Retiro')
        },
        amount: {
            allowNull: false,
            type: DataTypes.DOUBLE
        },
        previous_balance: {
            allowNull: false,
            type: DataTypes.DOUBLE
        },
        current_balance: {
            allowNull: false,
            type: DataTypes.DOUBLE
        },
        team: {
            allowNull: true,
            type: DataTypes.STRING
        },

        createdat: {
            allowNull: false,
            type: DataTypes.DATE,
            defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
        },
        updatedat: {
            allowNull: false,
            type: DataTypes.DATE,
            defaultValue: sequelize.literal('CURRENT_TIMESTAMP')
        },
        description: {
            allowNull: false,
            type: DataTypes.STRING
        },
        id_betting: {
            allowNull: true,
            type: DataTypes.INTEGER
        }
    }, {
        sequelize,
        modelName: 'usertransactions',
    });

    return usertransactions;
};

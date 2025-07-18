const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Client = sequelize.define('Client', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  type: {
    type: DataTypes.ENUM('Developer', 'Agent', 'Litigation'),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  promoterName: DataTypes.STRING,
  location: DataTypes.STRING,
  plotNo: DataTypes.STRING,
  plotArea: DataTypes.STRING,
  totalUnits: DataTypes.INTEGER,
  bookedUnits: DataTypes.INTEGER,
  workStatus: {
    type: DataTypes.ENUM('Not Started', 'In Progress', 'Completed'),
    allowNull: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  reraNumber: DataTypes.STRING,
  certificateDate: DataTypes.DATE,
  mobile: {
    type: DataTypes.STRING,
    allowNull: false
  },
  officeNumber: DataTypes.STRING,
  email: DataTypes.STRING,
  caName: DataTypes.STRING,
  engineerName: DataTypes.STRING,
  architectName: DataTypes.STRING,
  reference: DataTypes.STRING,
  completionDate: DataTypes.DATE
}, {
  tableName: 'clients',
  timestamps: true
});

module.exports = Client; 
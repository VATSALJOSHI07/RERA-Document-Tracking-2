const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  clientId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'clients',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  title: DataTypes.STRING,
  service: DataTypes.STRING,
  allocatedMembers: DataTypes.STRING,
  assignedMembers: DataTypes.STRING,
  priority: DataTypes.STRING,
  dueDate: DataTypes.STRING,
  team: DataTypes.STRING,
  clientSource: DataTypes.STRING,
  status: DataTypes.STRING,
  governmentFees: DataTypes.STRING,
  sroFees: DataTypes.STRING,
  billAmount: DataTypes.STRING,
  gst: DataTypes.STRING,
  branch: DataTypes.STRING,
  remark: DataTypes.TEXT,
  note: DataTypes.TEXT,
  description: DataTypes.TEXT
}, {
  tableName: 'tasks',
  timestamps: true
});

module.exports = Task; 
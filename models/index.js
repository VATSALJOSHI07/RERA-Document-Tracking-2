const sequelize = require('../config/database');
const User = require('./User');
const Client = require('./Client');
const Document = require('./Document');
const Payment = require('./Payment');
const Task = require('./Task');

// Define associations
User.hasMany(Client, { foreignKey: 'userId' });
Client.belongsTo(User, { foreignKey: 'userId' });

Client.hasMany(Document, { foreignKey: 'clientId' });
Document.belongsTo(Client, { foreignKey: 'clientId' });

Client.hasMany(Payment, { foreignKey: 'clientId' });
Payment.belongsTo(Client, { foreignKey: 'clientId' });

Client.hasMany(Task, { foreignKey: 'clientId' });
Task.belongsTo(Client, { foreignKey: 'clientId' });

User.hasMany(Document, { foreignKey: 'userId' });
Document.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Payment, { foreignKey: 'userId' });
Payment.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Task, { foreignKey: 'userId' });
Task.belongsTo(User, { foreignKey: 'userId' });

module.exports = {
  sequelize,
  User,
  Client,
  Document,
  Payment,
  Task
}; 
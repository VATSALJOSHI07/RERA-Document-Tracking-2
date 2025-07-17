    // server.js
    const express = require('express');
    const cors = require('cors');
    const jwt = require('jsonwebtoken');
    require('dotenv').config();
    const path = require('path');
    const PDFDocument = require('pdfkit');

    // Add Sequelize
    const { Sequelize, DataTypes } = require('sequelize');

    const app = express();
    const PORT = process.env.PORT || 5000;

    // Sequelize connection
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      protocol: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false // <<-- This is the key for self-signed certs
        }
      }
    });

    // Sequelize Models
    const User = sequelize.define('User', {
      userId: { type: DataTypes.STRING, allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING, allowNull: false }
    });

    const Client = sequelize.define('Client', {
      type: { type: DataTypes.ENUM('Developer', 'Agent', 'Litigation'), allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      promoterName: DataTypes.STRING,
      location: DataTypes.STRING,
      plotNo: DataTypes.STRING,
      plotArea: DataTypes.STRING,
      totalUnits: DataTypes.INTEGER,
      bookedUnits: DataTypes.INTEGER,
      workStatus: { type: DataTypes.ENUM('Not Started', 'In Progress', 'Completed') },
      reraNumber: DataTypes.STRING,
      certificateDate: DataTypes.DATE,
      mobile: { type: DataTypes.STRING, allowNull: false },
      officeNumber: DataTypes.STRING,
      email: DataTypes.STRING,
      caName: DataTypes.STRING,
      engineerName: DataTypes.STRING,
      architectName: DataTypes.STRING,
      reference: DataTypes.STRING,
      completionDate: DataTypes.DATE,
      dateCreated: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
    });

    const Document = sequelize.define('Document', {
      documents: { type: DataTypes.JSONB, defaultValue: {} }, // { docName: 'received' | 'not-received' }
      lastUpdated: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
    });

    const Payment = sequelize.define('Payment', {
      amount: { type: DataTypes.FLOAT, allowNull: false },
      description: { type: DataTypes.STRING, allowNull: false },
      dueDate: DataTypes.DATE,
      paidAmount: { type: DataTypes.FLOAT, defaultValue: 0 },
      transactions: { type: DataTypes.JSONB, defaultValue: [] }, // [{ amount, date, notes, timestamp }]
      dateCreated: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
    });

    const Task = sequelize.define('Task', {
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
      remark: DataTypes.STRING,
      note: DataTypes.STRING,
      description: DataTypes.STRING,
      dateCreated: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
    });

    // Associations
    User.hasMany(Client, { foreignKey: 'userId' });
    Client.belongsTo(User, { foreignKey: 'userId' });

    User.hasMany(Document, { foreignKey: 'userId' });
    Document.belongsTo(User, { foreignKey: 'userId' });
    Client.hasOne(Document, { foreignKey: 'clientId' });
    Document.belongsTo(Client, { foreignKey: 'clientId' });

    User.hasMany(Payment, { foreignKey: 'userId' });
    Payment.belongsTo(User, { foreignKey: 'userId' });
    Client.hasMany(Payment, { foreignKey: 'clientId' });
    Payment.belongsTo(Client, { foreignKey: 'clientId' });

    User.hasMany(Task, { foreignKey: 'userId' });
    Task.belongsTo(User, { foreignKey: 'userId' });
    Client.hasMany(Task, { foreignKey: 'clientId' });
    Task.belongsTo(Client, { foreignKey: 'clientId' });

    // Sync models (for dev, use migrations for prod)
    sequelize.sync({ alter: true }) // Ensure tables are created/updated. Comment out after first run in production.

    // Test connection
    sequelize.authenticate()
      .then(() => console.log('PostgreSQL connected successfully'))
      .catch(err => console.error('PostgreSQL connection error:', err));

    // Middleware

    // Define allowedOrigins for CORS
    const allowedOrigins = [
    'https://vatsaljoshi07.github.io',
    'https://rera-document-tracking.onrender.com',
    undefined // allow Postman, curl, etc.
    ];

    app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        } else {
        callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
    }));

    
    app.use(express.json());

    // MongoDB Connection
    // REMOVE: mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/developer_management', {
    //     useNewUrlParser: true,
    //     useUnifiedTopology: true,
    // })
    // .then(() => console.log('MongoDB connected successfully'))
    // .catch(err => console.error('MongoDB connection error:', err));

    // Schemas
    // REMOVE: const userSchema = new mongoose.Schema({
    //     userId: { type: String, required: true, unique: true },
    //     passwordHash: { type: String, required: true }
    // });
    // const User = mongoose.model('User', userSchema);

    // JWT Secret
    const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

    // Auth Middleware
    function authMiddleware(req, res, next) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const token = authHeader.split(' ')[1];
        try {
            const payload = jwt.verify(token, JWT_SECRET);
            req.user = payload;
            next();
        } catch (err) {
            return res.status(401).json({ error: 'Invalid token' });
        }
    }

    // Register Endpoint
    app.post('/api/register', async (req, res) => {
        const { userId, password } = req.body;
        if (!userId || !password) return res.status(400).json({ error: 'User ID and password required' });
        const existing = await User.findOne({ where: { userId } });
        if (existing) return res.status(400).json({ error: 'User ID already exists' });
        // Store password as plain text (for now, as before)
        const user = await User.create({ userId, passwordHash: password });
        res.json({ message: 'User registered successfully' });
    });

    // Login Endpoint
    app.post('/api/login', async (req, res) => {
        const { userId, password } = req.body;
        const user = await User.findOne({ where: { userId } });
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });
        // Compare plain text password
        const valid = user.passwordHash === password;
        if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
        const token = jwt.sign({ userId: user.userId, _id: user.id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token });
    });

    // const clientSchema = new mongoose.Schema({
    //     type: {
    //         type: String,
    //         required: true,
    //         enum: ['Developer', 'Agent', 'Litigation']
    //     },
    //     name: {
    //         type: String,
    //         required: true
    //     },
    //     promoterName: String,
    //     location: String,
    //     plotNo: String,
    //     plotArea: String,
    //     totalUnits: Number,
    //     bookedUnits: Number,
    //     workStatus: {
    //         type: String,
    //         enum: ['Not Started', 'In Progress', 'Completed'],
    //         required: false
    //     },
    //     userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // owner
    //     reraNumber: String,
    //     certificateDate: Date,
    //     mobile: {
    //         type: String,
    //         required: true
    //     },
    //     officeNumber: String,
    //     email: String,
    //     caName: String,
    //     engineerName: String,
    //     architectName: String,
    //     reference: String,
    //     completionDate: Date,
    //     dateCreated: {
    //         type: Date,
    //         default: Date.now
    //     }
    // });

    // const documentSchema = new mongoose.Schema({
    //     clientId: {
    //         type: mongoose.Schema.Types.ObjectId,
    //         ref: 'Client',
    //         required: true
    //     },
    //     userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // owner
    //     documents: {
    //         type: Map,
    //         of: String, // 'received' or 'not-received'
    //         default: {}
    //     },
    //     lastUpdated: {
    //         type: Date,
    //         default: Date.now
    //     }
    // });

    // const paymentSchema = new mongoose.Schema({
    //     clientId: {
    //         type: mongoose.Schema.Types.ObjectId,
    //         ref: 'Client',
    //         required: true
    //     },
    //     userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // owner
    //     amount: {
    //         type: Number,
    //         required: true
    //     },
    //     description: {
    //         type: String,
    //         required: true
    //     },
    //     dueDate: Date,
    //     paidAmount: {
    //         type: Number,
    //         default: 0
    //     },
    //     transactions: [{
    //         amount: Number,
    //         date: Date,
    //         notes: String,
    //         timestamp: {
    //             type: Date,
    //             default: Date.now
    //         }
    //     }],
    //     dateCreated: {
    //         type: Date,
    //         default: Date.now
    //     }
    // });

    // Models
    // REMOVE: const Client = mongoose.model('Client', clientSchema);
    // REMOVE: const Document = mongoose.model('Document', documentSchema);
    // REMOVE: const Payment = mongoose.model('Payment', paymentSchema);

    // Task model
    // REMOVE: const taskSchema = new mongoose.Schema({
    //     clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    //     userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    //     title: String,
    //     service: String,
    //     allocatedMembers: String,
    //     assignedMembers: String,
    //     priority: String,
    //     dueDate: String,
    //     team: String,
    //     clientSource: String,
    //     status: String,
    //     governmentFees: String,
    //     sroFees: String,
    //     billAmount: String,
    //     gst: String,
    //     branch: String,
    //     remark: String,
    //     note: String,
    //     description: String,
    //     dateCreated: { type: Date, default: Date.now }
    // });
    // REMOVE: const Task = mongoose.model('Task', taskSchema);

    // Default documents list
    const defaultDocuments = [
        'PAN Card of the Firm/Company',
        'Udyam Aadhar / Gumasta',
        'KYC of Partners',
        'KYC of Authorized Signatory',
        'Board Resolution',
        'Commencement Certificate',
        'Approved Plan Layout',
        'RERA Carpet Area Statement',
        'Sale Deed',
        'Power of Attorney',
        'Mortgage Deed',
        'Tally Data',
        'Form 3 – CA Certificate',
        'Bifurcation of Units',
        'Bank Account Details',
        'Title Report',
        'Form 1 – Architect Certificate',
        'Letterhead',
        'Partnership Deed',
        'GST Certificate',
        'Land Ownership Documents',
        'Agreement for Sale and Deviation Reports',
        'Allotment Letter and Deviation Reports',
        'Project Name',
        'Completion Date',
        'Architect Details',
        'RCC Consultant Details',
        'CA Details',
        'Contact Person Details for MahaRERA Profile',
        'Loan and Litigation Information',
        'Phase-wise Project Details',
        'Google Map Location of the Project',
        'Address Proof of the Organization',
        'NOC if Address Proof is not in the firm\'s name',
        'CC Verification Email Screenshot',
        'Amenities Details',
        'SRO Membership Certificate'
    ];

    // Routes

    // Client Routes
    app.get('/api/clients', authMiddleware, async (req, res) => {
        try {
            const clients = await Client.findAll({ where: { userId: req.user._id } });
            res.json(clients);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/clients', authMiddleware, async (req, res) => {
        try {
            const clientData = req.body;
            clientData.userId = req.user._id;
            const client = await Client.create(clientData);
            // Create default documents for the client
            const defaultDocuments = [
                'PAN Card of the Firm/Company',
                'Udyam Aadhar / Gumasta',
                'KYC of Partners',
                'KYC of Authorized Signatory',
                'Board Resolution',
                'Commencement Certificate',
                'Approved Plan Layout',
                'RERA Carpet Area Statement',
                'Sale Deed',
                'Power of Attorney',
                'Mortgage Deed',
                'Tally Data',
                'Form 3 – CA Certificate',
                'Bifurcation of Units',
                'Bank Account Details',
                'Title Report',
                'Form 1 – Architect Certificate',
                'Letterhead',
                'Partnership Deed',
                'GST Certificate',
                'Land Ownership Documents',
                'Agreement for Sale and Deviation Reports',
                'Allotment Letter and Deviation Reports',
                'Project Name',
                'Completion Date',
                'Architect Details',
                'RCC Consultant Details',
                'CA Details',
                'Contact Person Details for MahaRERA Profile',
                'Loan and Litigation Information',
                'Phase-wise Project Details',
                'Google Map Location of the Project',
                'Address Proof of the Organization',
                "NOC if Address Proof is not in the firm's name",
                'CC Verification Email Screenshot',
                'Amenities Details',
                'SRO Membership Certificate'
            ];
            const documentMap = {};
            defaultDocuments.forEach(doc => {
                documentMap[doc] = 'not-received';
            });
            await Document.create({ clientId: client.id, userId: req.user._id, documents: documentMap });
            res.status(201).json(client);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    app.get('/api/clients/:id', authMiddleware, async (req, res) => {
        try {
            const client = await Client.findOne({ where: { id: req.params.id, userId: req.user._id } });
            if (!client) return res.status(404).json({ error: 'Client not found' });
            res.json(client);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.put('/api/clients/:id', authMiddleware, async (req, res) => {
        try {
            const updateData = req.body;
            // Prevent duplicate client name/location for the same user
            const duplicate = await Client.findOne({
                where: {
                    id: { [Sequelize.Op.ne]: req.params.id },
                    userId: req.user._id,
                    name: updateData.name,
                    location: updateData.location
                }
            });
            if (duplicate) {
                return res.status(400).json({ error: 'A client with this name and location already exists.' });
            }
            const [updated] = await Client.update(updateData, { where: { id: req.params.id, userId: req.user._id } });
            if (!updated) return res.status(404).json({ error: 'Client not found' });
            const client = await Client.findByPk(req.params.id);
            res.json(client);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    app.delete('/api/clients/:id', authMiddleware, async (req, res) => {
        try {
            const client = await Client.findOne({ where: { id: req.params.id, userId: req.user._id } });
            if (!client) return res.status(404).json({ error: 'Client not found' });
            await Document.destroy({ where: { clientId: req.params.id } });
            await Payment.destroy({ where: { clientId: req.params.id } });
            await Task.destroy({ where: { clientId: req.params.id } });
            await client.destroy();
            res.json({ message: 'Client deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Document Routes
    app.get('/api/documents/:clientId', authMiddleware, async (req, res) => {
        try {
            const documents = await Document.findOne({ where: { clientId: req.params.clientId } });
            if (!documents) return res.status(404).json({ error: 'Documents not found' });
            res.json(documents);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.put('/api/documents/:clientId', authMiddleware, async (req, res) => {
        try {
            const { documentName, status } = req.body;
            const documents = await Document.findOne({ where: { clientId: req.params.clientId } });
            if (!documents) return res.status(404).json({ error: 'Documents not found' });
            const docMap = documents.documents || {};
            docMap[documentName] = status;
            documents.documents = docMap;
            documents.lastUpdated = new Date();
            await documents.save();
            res.json(documents);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/documents/:clientId/add', authMiddleware, async (req, res) => {
        try {
            const { documentName } = req.body;
            const documents = await Document.findOne({ where: { clientId: req.params.clientId } });
            if (!documents) return res.status(404).json({ error: 'Documents not found' });
            const docMap = documents.documents || {};
            if (docMap[documentName]) {
                return res.status(400).json({ error: 'Document already exists' });
            }
            docMap[documentName] = 'not-received';
            documents.documents = docMap;
            documents.lastUpdated = new Date();
            await documents.save();
            res.json(documents);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Payment Routes
    app.get('/api/payments/:clientId', authMiddleware, async (req, res) => {
        try {
            const payments = await Payment.findAll({ where: { clientId: req.params.clientId } });
            res.json(payments);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/payments', authMiddleware, async (req, res) => {
        try {
            const paymentData = req.body;
            if (!paymentData.clientId) {
                return res.status(400).json({ error: 'clientId is required' });
            }
            paymentData.userId = req.user._id;
            const payment = await Payment.create(paymentData);
            res.json(payment);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.put('/api/payments/:id/record', authMiddleware, async (req, res) => {
        try {
            const { amount, date, notes } = req.body;
            const payment = await Payment.findByPk(req.params.id);
            if (!payment) {
                return res.status(404).json({ error: 'Payment not found' });
            }
            const remainingAmount = payment.amount - (payment.paidAmount || 0);
            if (amount > remainingAmount) {
                return res.status(400).json({ error: 'Amount exceeds remaining balance' });
            }
            const transactions = payment.transactions || [];
            transactions.push({ amount, date, notes, timestamp: new Date() });
            payment.transactions = transactions;
            payment.paidAmount = (payment.paidAmount || 0) + amount;
            await payment.save();
            res.json(payment);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    app.delete('/api/payments/:id', authMiddleware, async (req, res) => {
        try {
            const payment = await Payment.findByPk(req.params.id);
            if (!payment) {
                return res.status(404).json({ error: 'Payment not found' });
            }
            if ((payment.paidAmount || 0) < payment.amount) {
                return res.status(400).json({ error: 'Cannot delete payment unless it is fully received.' });
            }
            await payment.destroy();
            res.json({ message: 'Payment deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/payments', authMiddleware, async (req, res) => {
        try {
            const payments = await Payment.findAll({ where: { userId: req.user._id } });
            res.json(payments);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Task Routes
    app.post('/api/tasks', authMiddleware, async (req, res) => {
        try {
            const taskData = req.body;
            if (!taskData.clientId) {
                return res.status(400).json({ error: 'clientId is required' });
            }
            taskData.userId = req.user._id;
            const task = await Task.create(taskData);
            res.json(task);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.get('/api/tasks/:clientId', authMiddleware, async (req, res) => {
        try {
            const tasks = await Task.findAll({ where: { clientId: req.params.clientId } });
            res.json(tasks);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
        try {
            const task = await Task.findByPk(req.params.id);
            if (!task) {
                return res.status(404).json({ error: 'Task not found' });
            }
            await task.destroy();
            res.json({ message: 'Task deleted successfully' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
        try {
            const updateData = req.body;
            const [updated] = await Task.update(updateData, { where: { id: req.params.id } });
            if (!updated) {
                return res.status(404).json({ error: 'Task not found' });
            }
            const task = await Task.findByPk(req.params.id);
            res.json(task);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Search Routes
    app.get('/api/search/clients', authMiddleware, async (req, res) => {
        try {
            const { q } = req.query;
            const clients = await Client.findAll({
                where: {
                    userId: req.user._id,
                    [Sequelize.Op.or]: [
                        { name: { [Sequelize.Op.iLike]: `%${q}%` } },
                        { promoterName: { [Sequelize.Op.iLike]: `%${q}%` } },
                        { location: { [Sequelize.Op.iLike]: `%${q}%` } }
                    ]
                }
            });
            res.json(clients);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // User info endpoint
    app.get('/api/user', authMiddleware, async (req, res) => {
        res.json({ userId: req.user.userId, _id: req.user._id });
    });

    // Endpoint to export pending documents for all clients in PDF format
    app.get('/api/export/pending-documents', authMiddleware, async (req, res) => {
        try {
            // REMOVE: const clients = await Client.find({ userId: req.user._id });
            // REMOVE: const clientIds = clients.map(c => c._id);
            // REMOVE: const documentsList = await Document.find({ clientId: { $in: clientIds } });

            // Prepare PDF
            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="pending_documents.pdf"');
            doc.pipe(res);
            doc.fontSize(18).text('Pending Documents', { align: 'center' });
            doc.moveDown();
            // REMOVE: for (const client of clients) {
            //     const docEntry = documentsList.find(d => d.clientId.toString() === client._id.toString());
            //     if (docEntry && docEntry.documents) {
            //         const pendingDocs = Array.from(docEntry.documents.entries()).filter(([_, status]) => status === 'not-received');
            //         if (pendingDocs.length > 0) {
            //             doc.fontSize(14).text(client.name, { underline: true });
            //             pendingDocs.forEach(([docName]) => {
            //                 doc.fontSize(12).text(docName, { indent: 20 });
            //             });
            //             doc.moveDown();
            //         }
            //     }
            // }
            doc.end();
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // Endpoint to export pending documents for a single client in PDF format
    app.get('/api/export/pending-documents/:clientId', authMiddleware, async (req, res) => {
        try {
            // REMOVE: const client = await Client.findOne({ _id: req.params.clientId, userId: req.user._id });
            // REMOVE: if (!client) return res.status(404).json({ error: 'Client not found' });
            // REMOVE: const docEntry = await Document.findOne({ clientId: client._id });
            // REMOVE: if (!docEntry) return res.status(404).json({ error: 'Documents not found' });
            // REMOVE: const pendingDocs = Array.from(docEntry.documents.entries()).filter(([_, status]) => status === 'not-received');
            // Prepare PDF
            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="pending_documents_${client.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
            doc.pipe(res);
            doc.fontSize(18).text(`Pending Documents for ${client.name}`, { align: 'center' });
            doc.moveDown();
            // REMOVE: if (pendingDocs.length === 0) {
            //     doc.fontSize(12).text('No pending documents.');
            // } else {
            //     pendingDocs.forEach(([docName]) => {
            //         doc.fontSize(12).text(docName);
            //     });
            // }
            doc.end();
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Health check route
    app.get('/api/health', (req, res) => {
        res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).json({ error: 'Something went wrong!' });
    });

    // Serve static files from the 'public' directory
    app.use(express.static(path.join(__dirname, 'public')));

    // Fallback: serve index.html for any unknown routes (for SPAs)
    app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'documents.html'));
    });

    // Start server
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });

    module.exports = app;

    // server.js
    const express = require('express');
    const { Sequelize, DataTypes } = require('sequelize');
    const cors = require('cors');
    const jwt = require('jsonwebtoken');
    require('dotenv').config();
    const path = require('path');
    const PDFDocument = require('pdfkit');

    const app = express();
    const PORT = process.env.PORT || 5000;

    // Middleware

    // Define allowedOrigins for CORS
    const allowedOrigins = [
    'https://vatsaljoshi07.github.io',
    'https://rera-document-tracking-2.onrender.com',
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

    // Sequelize Connection
    const sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        protocol: 'postgres',
        logging: false,
        dialectOptions: {
            ssl: process.env.NODE_ENV === 'production' ? {
                require: true,
                rejectUnauthorized: false
            } : false
        },
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    });

    sequelize.authenticate()
        .then(() => console.log('PostgreSQL connected successfully'))
        .catch(err => console.error('PostgreSQL connection error:', err));

    sequelize.sync({ alter: true })
        .then(() => console.log('Database synchronized'))
        .catch(err => console.error('Database sync error:', err));

    // Schemas
    const User = sequelize.define('User', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: DataTypes.STRING, allowNull: false, unique: true },
        passwordHash: { type: DataTypes.STRING, allowNull: false }
    }, { tableName: 'users', timestamps: true });

    const Client = sequelize.define('Client', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        type: { type: DataTypes.ENUM('Developer', 'Agent', 'Litigation'), allowNull: false },
        name: { type: DataTypes.STRING, allowNull: false },
        promoterName: DataTypes.STRING,
        location: DataTypes.STRING,
        plotNo: DataTypes.STRING,
        plotArea: DataTypes.STRING,
        totalUnits: DataTypes.INTEGER,
        bookedUnits: DataTypes.INTEGER,
        workStatus: { type: DataTypes.ENUM('Not Started', 'In Progress', 'Completed'), allowNull: true },
        reraNumber: DataTypes.STRING,
        certificateDate: DataTypes.DATE,
        mobile: { type: DataTypes.STRING, allowNull: false },
        officeNumber: DataTypes.STRING,
        email: { type: DataTypes.STRING, validate: { isEmail: true } },
        caName: DataTypes.STRING,
        engineerName: DataTypes.STRING,
        architectName: DataTypes.STRING,
        reference: DataTypes.STRING,
        completionDate: DataTypes.DATE,
        userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } }
    }, { tableName: 'clients', timestamps: true });

    const Document = sequelize.define('Document', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        clientId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'clients', key: 'id' } },
        userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
        documents: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        lastUpdated: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
    }, { tableName: 'documents', timestamps: true });

    const Payment = sequelize.define('Payment', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        clientId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'clients', key: 'id' } },
        userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
        amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        description: { type: DataTypes.STRING, allowNull: false },
        dueDate: DataTypes.DATE,
        paidAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
        transactions: { type: DataTypes.JSONB, defaultValue: [] }
    }, { tableName: 'payments', timestamps: true });

    const Task = sequelize.define('Task', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        clientId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'clients', key: 'id' } },
        userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
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
        description: DataTypes.STRING
    }, { tableName: 'tasks', timestamps: true });

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
        try {
            const { userId, password } = req.body;
            if (!userId || !password) {
                return res.status(400).json({ error: 'User ID and password required' });
            }
            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters' });
            }
            const existing = await User.findOne({ where: { userId } });
            if (existing) {
                return res.status(400).json({ error: 'User ID already exists' });
            }
            const user = await User.create({ userId, passwordHash: password });
            res.status(201).json({ message: 'User registered successfully' });
        } catch (err) {
            console.error('Register error:', err);
            res.status(500).json({ error: 'Registration failed', details: err.message });
        }
    });

    // Login Endpoint
    app.post('/api/login', async (req, res) => {
        try {
            const { userId, password } = req.body;
            const user = await User.findOne({ where: { userId } });
            if (!user || user.passwordHash !== password) {
                return res.status(400).json({ error: 'Invalid credentials' });
            }
            const token = jwt.sign({ userId: user.userId, id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
            res.json({ token });
        } catch (err) {
            res.status(500).json({ error: 'Login failed' });
        }
    });

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
            const clients = await Client.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'DESC']] });
            res.json(clients);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/clients', authMiddleware, async (req, res) => {
        try {
            const clientData = req.body;
            clientData.userId = req.user.id;
            
            const client = await Client.create(clientData);
            
            // Create default documents for the client
            const documentMap = new Map();
            defaultDocuments.forEach(doc => {
                documentMap.set(doc, 'not-received');
            });
            
            const clientDocuments = await Document.create({
                clientId: client.id,
                userId: req.user.id,
                documents: documentMap
            });
            
            const clientResponse = client.toJSON();
            res.status(201).json(clientResponse);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    app.get('/api/clients/:id', authMiddleware, async (req, res) => {
        try {
            const client = await Client.findByPk(req.params.id, { attributes: { exclude: ['passwordHash'] } });
            if (!client) {
                return res.status(404).json({ error: 'Client not found' });
            }
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
                    _id: { [sequelize.Op.ne]: req.params.id },
                    userId: req.user.id,
                    name: updateData.name,
                    location: updateData.location
                }
            });
            if (duplicate) {
                return res.status(400).json({ error: 'A client with this name and location already exists.' });
            }
            const client = await Client.findByPk(req.params.id, { attributes: { exclude: ['passwordHash'] } });
            if (!client) {
                return res.status(404).json({ error: 'Client not found' });
            }
            await client.update(updateData);
            res.json(client);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    app.delete('/api/clients/:id', authMiddleware, async (req, res) => {
        try {
            const client = await Client.findByPk(req.params.id);
            if (!client) {
                return res.status(404).json({ error: 'Client not found' });
            }
            // Delete related documents, payments, and tasks
            await Document.destroy({ where: { clientId: req.params.id } });
            await Payment.destroy({ where: { clientId: req.params.id } });
            await Task.destroy({ where: { clientId: req.params.id } });
            res.json({ message: 'Client deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Document Routes
    app.get('/api/documents/:clientId', authMiddleware, async (req, res) => {
        try {
            const documents = await Document.findOne({ where: { clientId: req.params.clientId } });
            if (!documents) {
                return res.status(404).json({ error: 'Documents not found' });
            }
            res.json(documents);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.put('/api/documents/:clientId', authMiddleware, async (req, res) => {
        try {
            const { documentName, status } = req.body;
            
            const documents = await Document.findOne({ where: { clientId: req.params.clientId } });
            if (!documents) {
                return res.status(404).json({ error: 'Documents not found' });
            }
            
            documents.documents[documentName] = status;
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
            if (!documents) {
                return res.status(404).json({ error: 'Documents not found' });
            }
            
            if (documents.documents.hasOwnProperty(documentName)) {
                return res.status(400).json({ error: 'Document already exists' });
            }
            
            documents.documents[documentName] = 'not-received';
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
            paymentData.userId = req.user.id; // Ensure userId is set from the logged-in user
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
            
            const remainingAmount = payment.amount - payment.paidAmount;
            if (amount > remainingAmount) {
                return res.status(400).json({ error: 'Amount exceeds remaining balance' });
            }
            
            payment.transactions.push({
                amount,
                date,
                notes,
                timestamp: new Date()
            });
            
            payment.paidAmount += amount;
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
            // Only allow delete if fully received
            if ((payment.paidAmount || 0) < payment.amount) {
                return res.status(400).json({ error: 'Cannot delete payment unless it is fully received.' });
            }
            await payment.destroy();
            res.json({ message: 'Payment deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Add this route to return all payments for the current user
    app.get('/api/payments', authMiddleware, async (req, res) => {
        try {
            const payments = await Payment.findAll({ where: { userId: req.user.id } });
            res.json(payments);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Task Routes
    app.post('/api/tasks', authMiddleware, async (req, res) => {
        try {
            const taskData = req.body;
            // Ensure clientId is present and valid
            if (!taskData.clientId) {
                return res.status(400).json({ error: 'clientId is required' });
            }
            // Set userId from the logged-in user
            taskData.userId = req.user.id;
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

    // Add this endpoint to allow deleting a task by its ID
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

    // Add this endpoint to allow updating a task by its ID
    app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
        try {
            const updateData = req.body;
            const task = await Task.findByPk(req.params.id);
            if (!task) {
                return res.status(404).json({ error: 'Task not found' });
            }
            await task.update(updateData);
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
                    userId: req.user.id,
                    [sequelize.Op.or]: [
                        { name: { [sequelize.Op.iLike]: `%${q}%` } },
                        { promoterName: { [sequelize.Op.iLike]: `%${q}%` } },
                        { location: { [sequelize.Op.iLike]: `%${q}%` } }
                    ]
                },
                attributes: { exclude: ['passwordHash'] }
            });
            res.json(clients);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Add this route after your other API routes:
    app.get('/api/user', authMiddleware, async (req, res) => {
        // You may want to return more user info if you store it
        res.json({ userId: req.user.userId, _id: req.user.id });
    });

    // Endpoint to export pending documents for all clients in PDF format
    app.get('/api/export/pending-documents', authMiddleware, async (req, res) => {
        try {
            const clients = await Client.findAll({ where: { userId: req.user.id } });
            const clientIds = clients.map(c => c.id);
            const documentsList = await Document.findAll({ where: { clientId: { [sequelize.Op.in]: clientIds } } });

            // Prepare PDF
            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="pending_documents.pdf"');
            doc.pipe(res);
            doc.fontSize(18).text('Pending Documents', { align: 'center' });
            doc.moveDown();
            for (const client of clients) {
                const docEntry = documentsList.find(d => d.clientId === client.id);
                if (docEntry && docEntry.documents) {
                    const pendingDocs = Object.entries(docEntry.documents).filter(([_, status]) => status === 'not-received');
                    if (pendingDocs.length > 0) {
                        doc.fontSize(14).text(client.name, { underline: true });
                        pendingDocs.forEach(([docName]) => {
                            doc.fontSize(12).text(docName, { indent: 20 });
                        });
                        doc.moveDown();
                    }
                }
            }
            doc.end();
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // Endpoint to export pending documents for a single client in PDF format
    app.get('/api/export/pending-documents/:clientId', authMiddleware, async (req, res) => {
        try {
            const client = await Client.findOne({ where: { _id: req.params.clientId, userId: req.user.id } });
            if (!client) return res.status(404).json({ error: 'Client not found' });
            const docEntry = await Document.findOne({ where: { clientId: client.id } });
            if (!docEntry) return res.status(404).json({ error: 'Documents not found' });
            const pendingDocs = Object.entries(docEntry.documents).filter(([_, status]) => status === 'not-received');
            // Prepare PDF
            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="pending_documents_${client.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
            doc.pipe(res);
            doc.fontSize(18).text(`Pending Documents for ${client.name}`, { align: 'center' });
            doc.moveDown();
            if (pendingDocs.length === 0) {
                doc.fontSize(12).text('No pending documents.');
            } else {
                pendingDocs.forEach(([docName]) => {
                    doc.fontSize(12).text(docName);
                });
            }
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

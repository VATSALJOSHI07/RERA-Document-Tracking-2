
    // server.js
    const express = require('express');
    const cors = require('cors');
    const jwt = require('jsonwebtoken');
    require('dotenv').config();
    const path = require('path');
    const PDFDocument = require('pdfkit');

    // Import models
    const { sequelize, User, Client, Document, Payment, Task } = require('./models');

    const app = express();
    const PORT = process.env.PORT || 5000;

    // Middleware
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

    // Database Connection
    sequelize.authenticate()
      .then(() => {
        console.log('PostgreSQL connected successfully');
        return sequelize.sync({ alter: true }); // Use { force: true } for complete reset
      })
      .then(() => {
        console.log('Database synchronized');
      })
      .catch(err => {
        console.error('Database connection error:', err);
      });

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
        const existing = await User.findOne({ where: { userId } });
        if (existing) {
          return res.status(400).json({ error: 'User ID already exists' });
        }
        const user = await User.create({ userId, passwordHash: password });
        res.json({ message: 'User registered successfully' });
      } catch (error) {
        res.status(500).json({ error: error.message });
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
        const token = jwt.sign({ userId: user.userId, id: user.id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token });
      } catch (error) {
        res.status(500).json({ error: error.message });
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

    // Client Routes
    app.get('/api/clients', authMiddleware, async (req, res) => {
      try {
        const clients = await Client.findAll({ where: { userId: req.user.id } });
        res.json(clients);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/clients', authMiddleware, async (req, res) => {
      try {
        const clientData = { ...req.body, userId: req.user.id };
        const client = await Client.create(clientData);
        // Create default documents for the client
        const documentMap = {};
        defaultDocuments.forEach(doc => {
          documentMap[doc] = 'not-received';
        });
        await Document.create({
          clientId: client.id,
          userId: req.user.id,
          documents: documentMap
        });
        res.status(201).json(client);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    app.get('/api/clients/:id', authMiddleware, async (req, res) => {
      try {
        const client = await Client.findByPk(req.params.id);
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
        const [updatedCount] = await Client.update(req.body, {
          where: { id: req.params.id, userId: req.user.id }
        });
        if (updatedCount === 0) {
          return res.status(404).json({ error: 'Client not found' });
        }
        const client = await Client.findByPk(req.params.id);
        res.json(client);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    app.delete('/api/clients/:id', authMiddleware, async (req, res) => {
      try {
        const deletedCount = await Client.destroy({
          where: { id: req.params.id, userId: req.user.id }
        });
        if (deletedCount === 0) {
          return res.status(404).json({ error: 'Client not found' });
        }
        // Delete related records
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
        const updatedDocuments = { ...documents.documents, [documentName]: status };
        await documents.update({
          documents: updatedDocuments,
          lastUpdated: new Date()
        });
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
        if (documents.documents[documentName]) {
          return res.status(400).json({ error: 'Document already exists' });
        }
        const updatedDocuments = { ...documents.documents, [documentName]: 'not-received' };
        await documents.update({
          documents: updatedDocuments,
          lastUpdated: new Date()
        });
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
        const paymentData = { ...req.body, userId: req.user.id };
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
        const remainingAmount = parseFloat(payment.amount) - parseFloat(payment.paidAmount);
        if (parseFloat(amount) > remainingAmount) {
          return res.status(400).json({ error: 'Amount exceeds remaining balance' });
        }
        const newTransaction = {
          amount: parseFloat(amount),
          date,
          notes,
          timestamp: new Date()
        };
        const updatedTransactions = [...payment.transactions, newTransaction];
        const newPaidAmount = parseFloat(payment.paidAmount) + parseFloat(amount);
        await payment.update({
          transactions: updatedTransactions,
          paidAmount: newPaidAmount
        });
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
        if (parseFloat(payment.paidAmount) < parseFloat(payment.amount)) {
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
        const payments = await Payment.findAll({ where: { userId: req.user.id } });
        res.json(payments);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Task Routes
    app.post('/api/tasks', authMiddleware, async (req, res) => {
      try {
        const taskData = { ...req.body, userId: req.user.id };
        const task = await Task.create(taskData);
        res.json(task);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/tasks/:clientId', authMiddleware, async (req, res) => {
      try {
        const tasks = await Task.findAll({ where: { clientId: req.params.clientId } });
        res.json(tasks);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
      try {
        const deletedCount = await Task.destroy({ where: { id: req.params.id } });
        if (deletedCount === 0) {
          return res.status(404).json({ error: 'Task not found' });
        }
        res.json({ message: 'Task deleted successfully' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
      try {
        const [updatedCount] = await Task.update(req.body, {
          where: { id: req.params.id }
        });
        if (updatedCount === 0) {
          return res.status(404).json({ error: 'Task not found' });
        }
        const task = await Task.findByPk(req.params.id);
        res.json(task);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Search Routes
    app.get('/api/search/clients', authMiddleware, async (req, res) => {
      try {
        const { q } = req.query;
        const { Op } = require('sequelize');
        const clients = await Client.findAll({
          where: {
            userId: req.user.id,
            [Op.or]: [
              { name: { [Op.iLike]: `%${q}%` } },
              { promoterName: { [Op.iLike]: `%${q}%` } },
              { location: { [Op.iLike]: `%${q}%` } }
            ]
          }
        });
        res.json(clients);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/user', authMiddleware, async (req, res) => {
      res.json({ userId: req.user.userId, id: req.user.id });
    });

    // Export Routes (PDF functionality remains the same)
    app.get('/api/export/pending-documents', authMiddleware, async (req, res) => {
      try {
        const clients = await Client.findAll({ where: { userId: req.user.id } });
        const clientIds = clients.map(c => c.id);
        const documentsList = await Document.findAll({
          where: { clientId: clientIds }
        });
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
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/export/pending-documents/:clientId', authMiddleware, async (req, res) => {
      try {
        const client = await Client.findOne({
          where: { id: req.params.clientId, userId: req.user.id }
        });
        if (!client) {
          return res.status(404).json({ error: 'Client not found' });
        }
        const docEntry = await Document.findOne({ where: { clientId: client.id } });
        if (!docEntry) {
          return res.status(404).json({ error: 'Documents not found' });
        }
        const pendingDocs = Object.entries(docEntry.documents).filter(([_, status]) => status === 'not-received');
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
      } catch (error) {
        res.status(500).json({ error: error.message });
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

    // Serve static files
    app.use(express.static(path.join(__dirname, 'public')));

    // Fallback route
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'documents.html'));
    });

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    module.exports = app;

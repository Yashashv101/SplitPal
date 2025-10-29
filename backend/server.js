require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const Tesseract = require('tesseract.js');
const currencyService = require('./services/currencyService');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Folder where uploaded files will be stored
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  }
});

const upload = multer({ storage });
// Create MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Moonknight@67',
  database: process.env.DB_NAME || 'splitpal',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Database connection successful');
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    console.log('Using mock data for development');
    return false;
  }
}

// Initialize with mock data if DB connection fails
(async () => {
  dbConnected = await testConnection();
})();

// API Routes

// Variable to track database connection status
let dbConnected = false;

// Get all groups
app.get('/api/groups', async (req, res) => {
  try {
    if (!dbConnected) {
      // Use mock data if database is not connected
      return res.json(mockGroups);
    }
    
    const [rows] = await pool.query(`
      SELECT g.*, COUNT(m.id) as members_count 
      FROM \`groups\` g
      LEFT JOIN members m ON g.id = m.group_id
      GROUP BY g.id
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching groups:', error);
    // Fallback to mock data on error
    return res.json(mockGroups);
  }
});

// Create a new group
app.post('/api/groups', async (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Group name is required' });
  }
  
  try {
    const [result] = await pool.query('INSERT INTO `groups` (name) VALUES (?)', [name]);
    const [newGroup] = await pool.query('SELECT * FROM `groups` WHERE id = ?', [result.insertId]);
    res.status(201).json(newGroup[0]);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Get a specific group with members and expenses
app.get('/api/groups/:id', async (req, res) => {
  const groupId = req.params.id;
  
  try {
    // Get group details
    const [groups] = await pool.query('SELECT * FROM `groups` WHERE id = ?', [groupId]);
    
    if (groups.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const group = groups[0];
    
    // Get members - EXPLICITLY SELECT upi_id
    const [members] = await pool.query(
      'SELECT id, group_id, name, email, upi_id, created_at FROM members WHERE group_id = ?', 
      [groupId]
    );
    
    console.log('Fetched members with UPI:', members);
    
    // Get expenses
    const [expenses] = await pool.query(`
      SELECT e.*, m.name as paid_by_name 
      FROM expenses e
      JOIN members m ON e.payer_id = m.id
      WHERE e.group_id = ?
      ORDER BY e.created_at DESC
    `, [groupId]);
    
    // Add members and expenses to group object
    group.members = members;
    group.expenses = expenses;
    
    res.json(group);
  } catch (error) {
    console.error('Error fetching group details:', error);
    res.status(500).json({ error: 'Failed to fetch group details' });
  }
});

// Add a member to a group
app.post('/api/groups/:id/members', async (req, res) => {
  const groupId = req.params.id;
  const { name, upi_id } = req.body;
  
  console.log('=== ADD MEMBER REQUEST ===');
  console.log('Group ID:', groupId);
  console.log('Request body:', req.body);
  console.log('name:', name);
  console.log('upi_id:', upi_id);
  console.log('upi_id type:', typeof upi_id);
  
  if (!name) {
    return res.status(400).json({ error: 'Member name is required' });
  }
  
  // UPI ID validation
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;
  if (upi_id && !upiRegex.test(upi_id)) {
    console.log('UPI ID validation failed for:', upi_id);
    return res.status(400).json({ error: 'Invalid UPI ID format' });
  }
  
  try {
    const upiValue = upi_id || null;
    console.log('UPI value to insert:', upiValue);
    
    // Check if the column exists first
    const [columns] = await pool.query('SHOW COLUMNS FROM members LIKE "upi_id"');
    console.log('upi_id column exists:', columns.length > 0);
    
    if (columns.length === 0) {
      console.error('ERROR: upi_id column does not exist in members table!');
      return res.status(500).json({ 
        error: 'Database schema error: upi_id column missing',
        solution: 'Run: ALTER TABLE members ADD COLUMN upi_id VARCHAR(255) NULL AFTER email;'
      });
    }
    
    // Insert member with explicit column names
    const insertQuery = 'INSERT INTO members (group_id, name, upi_id) VALUES (?, ?, ?)';
    const insertValues = [groupId, name, upiValue];
    
    console.log('SQL Query:', insertQuery);
    console.log('SQL Values:', insertValues);
    
    const [result] = await pool.query(insertQuery, insertValues);
    
    console.log('Insert result:', result);
    console.log('New member ID:', result.insertId);
    
    // Fetch the created member with explicit columns
    const [newMember] = await pool.query(
      'SELECT id, group_id, name, email, upi_id, created_at FROM members WHERE id = ?', 
      [result.insertId]
    );
    
    console.log('Fetched member:', newMember[0]);
    console.log('Fetched upi_id:', newMember[0]?.upi_id);
    console.log('=== END ADD MEMBER ===\n');
    
    if (newMember.length === 0) {
      return res.status(500).json({ error: 'Failed to fetch created member' });
    }
    
    res.status(201).json(newMember[0]);
  } catch (error) {
    console.error('Error adding member:', error);
    console.log('Error code:', error.code);
    console.log('Error errno:', error.errno);
    res.status(500).json({ 
      error: 'Failed to add member',
      details: error.message,
      code: error.code
    });
  }
});
// Add this temporary debug endpoint to server.js to check table structure

app.get('/api/debug/members-table', async (req, res) => {
  try {
    // Get table structure
    const [columns] = await pool.query('DESCRIBE members');
    
    // Get sample data
    const [sampleData] = await pool.query('SELECT * FROM members LIMIT 5');
    
    res.json({
      tableStructure: columns,
      sampleData: sampleData,
      note: 'Check if upi_id column exists and its properties'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Add an expense to a group
app.post('/api/groups/:id/expenses', async (req, res) => {
  const groupId = req.params.id;
  const { description, amount, paid_by, participants } = req.body;

  console.log('Received expense data:', req.body);

  // Validate request
  if (!description || !amount || !paid_by) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      received: { description, amount, paid_by, participants }
    });
  }

  if (!participants || participants.length === 0) {
    return res.status(400).json({ error: 'At least one participant is required' });
  }
  
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Insert expense (note: using paid_by from request, storing as payer_id in DB)
    const [expenseResult] = await connection.query(
      'INSERT INTO expenses (description, amount, payer_id, group_id, date) VALUES (?, ?, ?, ?, CURDATE())',
      [description, parseFloat(amount), paid_by, groupId]
    );
    
    const expenseId = expenseResult.insertId;
    const shareAmount = parseFloat(amount) / participants.length;
    
    console.log(`Expense ID: ${expenseId}, Share amount: ${shareAmount} for ${participants.length} participants`);
    
    // Insert expense shares
    for (const participantId of participants) {
      await connection.query(
        'INSERT INTO expense_shares (expense_id, member_id, amount) VALUES (?, ?, ?)',
        [expenseId, participantId, shareAmount]
      );
    }
    
    await connection.commit();
    
    // Fetch the created expense with payer name
    const [newExpense] = await connection.query(`
      SELECT e.*, m.name as paid_by_name 
      FROM expenses e
      JOIN members m ON e.payer_id = m.id
      WHERE e.id = ?
    `, [expenseId]);
    
    console.log('Expense created successfully:', newExpense[0]);
    
    res.status(201).json(newExpense[0]);
  } catch (error) {
    await connection.rollback();
    console.error('Error adding expense:', error);
    res.status(500).json({ 
      error: 'Failed to add expense',
      details: error.message 
    });
  } finally {
    connection.release();
  }
});

// Calculate balances for a group
app.get('/api/groups/:id/balances', async (req, res) => {
  const groupId = req.params.id;
  try {
    // Get members - EXPLICITLY SELECT upi_id
    const [members] = await pool.query(
      'SELECT id, name, email, upi_id FROM members WHERE group_id = ?', 
      [groupId]
    );
    
    console.log('Balances endpoint - members with UPI:', members);

    // Initialize balances
    const memberBalances = {};
    members.forEach(m => memberBalances[m.id] = { paid: 0, getsBack: 0, owes: [] });

    // Get expenses with shares
    const [expenses] = await pool.query(`
      SELECT e.id as expense_id, e.description, e.amount, e.payer_id, e.date,
             es.member_id, es.amount as share_amount
      FROM expenses e
      JOIN expense_shares es ON e.id = es.expense_id
      WHERE e.group_id = ?
      ORDER BY e.date ASC
    `, [groupId]);

    expenses.forEach(e => {
      const payerId = e.payer_id;
      const memberId = e.member_id;
      const share = parseFloat(e.share_amount);
      const totalAmount = parseFloat(e.amount);

      // Track total paid by payer
      if (payerId === memberId) {
        memberBalances[payerId].paid += share;
      } else {
        // For non-payers, track who they owe
        memberBalances[memberId].owes.push({
          to: payerId,
          amount: share,
          description: e.description,
          date: e.date
        });

        // Track how much the payer should get back
        memberBalances[payerId].getsBack += share;
      }
    });

    // Apply settlements
    const [settlements] = await pool.query(`
      SELECT payer_id, receiver_id, amount
      FROM settlements
      WHERE group_id = ?
    `, [groupId]);

    settlements.forEach(s => {
      // Reduce owed amounts
      const owesArr = memberBalances[s.payer_id].owes;
      const index = owesArr.findIndex(o => o.to === s.receiver_id);
      if (index !== -1) {
        owesArr[index].amount -= parseFloat(s.amount);
        if (owesArr[index].amount < 0.01) owesArr.splice(index, 1); // fully settled
      }

      // Reduce getsBack for the receiver (who receives the settlement)
      memberBalances[s.receiver_id].getsBack -= parseFloat(s.amount);
    });

    res.json({ members, memberBalances });
  } catch (error) {
    console.error('Error calculating balances:', error);
    res.status(500).json({ error: 'Failed to calculate balances' });
  }
});



// Add a settlement to a group
app.post('/api/groups/:id/settlements', async (req, res) => {
  const groupId = req.params.id;
  const { paid_by, paid_to, amount } = req.body;

  console.log('Received settlement data:', req.body);

  // Validation
  if (!paid_by || !paid_to || !amount) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      received: { paid_by, paid_to, amount }
    });
  }

  if (paid_by === paid_to) {
    return res.status(400).json({ error: 'Cannot settle with yourself' });
  }

  if (parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than 0' });
  }
  
  try {
    const [result] = await pool.query(
      'INSERT INTO settlements (payer_id, receiver_id, amount, group_id, date) VALUES (?, ?, ?, ?, CURDATE())',
      [parseInt(paid_by), parseInt(paid_to), parseFloat(amount), groupId]
    );
    
    const [newSettlement] = await pool.query(`
      SELECT s.*, 
             m1.name as payer_name, 
             m2.name as receiver_name
      FROM settlements s
      JOIN members m1 ON s.payer_id = m1.id
      JOIN members m2 ON s.receiver_id = m2.id
      WHERE s.id = ?
    `, [result.insertId]);
    
    console.log('Settlement created successfully:', newSettlement[0]);
    
    res.status(201).json(newSettlement[0]);
  } catch (error) {
    console.error('Error adding settlement:', error);
    res.status(500).json({ 
      error: 'Failed to add settlement',
      details: error.message 
    });
  }
});

// Helper function to simplify debts
function simplifyDebts(balances, members) {
  const transactions = [];
  const debtors = [];
  const creditors = [];
  
  // Separate debtors and creditors
  Object.entries(balances).forEach(([id, balance]) => {
    const member = members.find(m => m.id.toString() === id.toString());
    const name = member ? member.name : 'Unknown';
    
    if (balance < 0) {
      debtors.push({ id, name, balance: Math.abs(balance) });
    } else if (balance > 0) {
      creditors.push({ id, name, balance });
    }
  });
  
  // Sort by amount (descending)
  debtors.sort((a, b) => b.balance - a.balance);
  creditors.sort((a, b) => b.balance - a.balance);
  
  // Create transactions
  while (debtors.length > 0 && creditors.length > 0) {
    const debtor = debtors[0];
    const creditor = creditors[0];
    
    const amount = Math.min(debtor.balance, creditor.balance);
    
    transactions.push({
      from_id: debtor.id,
      to_id: creditor.id,
      amount
    });
    
    debtor.balance -= amount;
    creditor.balance -= amount;
    
    if (debtor.balance < 0.01) debtors.shift();
    if (creditor.balance < 0.01) creditors.shift();
  }
  
  return transactions;
}

app.post('/api/ocr/bill', upload.single('bill'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const { path } = req.file;
    const { data: { text } } = await Tesseract.recognize(path, 'eng', {
      logger: m => console.log(m)
    });

    // Split text into lines
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);

    // Extract items and amounts using improved regex
    const items = [];
    const amountRegex = /(\$)?\s*(\d+[.,]\d{2}|\d+)/; // Better price detection
    const totalRegex = /(total|sum|amount|subtotal).*?(\$)?\s*(\d+[.,]\d{2}|\d+)/i;
    
    let totalAmount = 0;

    // First try to find a total
    for (const line of lines) {
      const totalMatch = line.match(totalRegex);
      if (totalMatch) {
        const amount = parseFloat(totalMatch[3].replace(',', '.'));
        if (!isNaN(amount) && amount > 0) {
          totalAmount = amount;
          break;
        }
      }
    }

    // Then extract individual items
    lines.forEach(line => {
      // Skip lines that are likely headers or footers
      if (line.match(/(receipt|invoice|order|date|time|thank you)/i)) {
        return;
      }
      
      const match = line.match(amountRegex);
      if (match) {
        const amount = parseFloat(match[2].replace(',', '.'));
        if (!isNaN(amount) && amount > 0) {
          // Extract description - everything before the price
          let description = line.substring(0, match.index).trim();
          if (!description) {
            description = 'Item';
          }
          items.push({ description, amount });
        }
      }
    });
    
    // Calculate total from items if no total was found
    if (totalAmount === 0 && items.length > 0) {
      totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    }
    
    return res.json({ 
      items, 
      totalAmount 
    });

    res.json({
      items,           // List of items for preview
      totalAmount      // Total for expense.amount
    });
  } catch (error) {
    console.error('OCR error:', error);
    res.status(500).json({ error: 'Failed to extract data from bill image' });
  }
});

// Currency API Endpoints

// Get supported currencies
// Get supported currencies
app.get('/api/currencies/supported', async (req, res) => {
  try {
    if (dbConnected) {
      // Fetch from database
      const [rows] = await pool.execute(
        'SELECT code, name, symbol, decimal_places FROM supported_currencies WHERE is_active = TRUE ORDER BY code'
      );
      res.json({
        success: true,
        currencies: rows
      });
    } else {
      // Fallback to hardcoded currencies
      const currencies = [
        { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimal_places: 2 },
        { code: 'USD', name: 'US Dollar', symbol: '$', decimal_places: 2 },
        { code: 'EUR', name: 'Euro', symbol: '€', decimal_places: 2 },
        { code: 'GBP', name: 'British Pound', symbol: '£', decimal_places: 2 },
        { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimal_places: 0 },
        { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimal_places: 2 },
        { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimal_places: 2 },
        { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimal_places: 2 },
        { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimal_places: 2 },
        { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimal_places: 2 }
      ];
      res.json({
        success: true,
        currencies
      });
    }
  } catch (error) {
    console.error('Error fetching supported currencies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch supported currencies'
    });
  }
});

// Get current exchange rates
app.get('/api/currencies/rates', async (req, res) => {
  try {
    if (dbConnected) {
      // Try to fetch from database first
      const [rows] = await pool.execute(
        'SELECT from_currency, to_currency, rate, last_updated FROM currency_rates WHERE last_updated > DATE_SUB(NOW(), INTERVAL 1 HOUR)'
      );
      
      if (rows.length > 0) {
        const rates = {};
        rows.forEach(row => {
          if (!rates[row.from_currency]) {
            rates[row.from_currency] = {};
          }
          rates[row.from_currency][row.to_currency] = row.rate;
        });
        
        return res.json({
          success: true,
          rates,
          lastUpdated: rows[0].last_updated
        });
      }
    }
    
    // Fallback to external API or mock data
    const mockRates = {
      'USD': {
        'INR': 83.25,
        'EUR': 0.85,
        'GBP': 0.73,
        'JPY': 110.50,
        'CAD': 1.25,
        'AUD': 1.35,
        'CHF': 0.92,
        'CNY': 6.45,
        'SGD': 1.35
      },
      'INR': {
        'USD': 0.012,
        'EUR': 0.010,
        'GBP': 0.0088,
        'JPY': 1.33,
        'CAD': 0.015,
        'AUD': 0.016,
        'CHF': 0.011,
        'CNY': 0.077,
        'SGD': 0.016
      }
    };
    
    res.json({
      success: true,
      rates: mockRates,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exchange rates'
    });
  }
});

app.get('/api/currencies', async (req, res) => {
  try {
    const currencies = currencyService.getSupportedCurrencies();
    res.json({
      success: true,
      currencies
    });
  } catch (error) {
    console.error('Error fetching currencies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch supported currencies'
    });
  }
});

// Get exchange rates for a base currency
app.get('/api/currencies/:baseCurrency/rates', async (req, res) => {
  try {
    const { baseCurrency } = req.params;
    const ratesData = await currencyService.getAllRatesFor(baseCurrency.toUpperCase());
    
    res.json({
      success: true,
      data: ratesData
    });
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch exchange rates'
    });
  }
});

// Convert amount between currencies
app.post('/api/currencies/convert', async (req, res) => {
  try {
    const { amount, fromCurrency, toCurrency } = req.body;
    
    if (!amount || !fromCurrency || !toCurrency) {
      return res.status(400).json({
        success: false,
        message: 'Amount, fromCurrency, and toCurrency are required'
      });
    }

    const conversion = await currencyService.convertAmountWithLiveRate(
      parseFloat(amount),
      fromCurrency.toUpperCase(),
      toCurrency.toUpperCase()
    );

    res.json({
      success: true,
      data: conversion
    });
  } catch (error) {
    console.error('Error converting currency:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to convert currency'
    });
  }
});

// Batch convert multiple amounts
app.post('/api/currencies/batch-convert', async (req, res) => {
  try {
    const { conversions } = req.body;
    
    if (!Array.isArray(conversions)) {
      return res.status(400).json({
        success: false,
        message: 'Conversions must be an array'
      });
    }

    const results = await currencyService.batchConvert(conversions);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error in batch conversion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform batch conversion'
    });
  }
});

// Calculate total in target currency from mixed currency amounts
app.post('/api/currencies/calculate-total', async (req, res) => {
  try {
    const { amounts, targetCurrency } = req.body;
    
    if (!Array.isArray(amounts) || !targetCurrency) {
      return res.status(400).json({
        success: false,
        message: 'Amounts array and targetCurrency are required'
      });
    }

    const result = await currencyService.calculateTotal(amounts, targetCurrency.toUpperCase());

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error calculating total:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate total'
    });
  }
});

// Update group default currency
app.put('/api/groups/:id/currency', async (req, res) => {
  try {
    const { id } = req.params;
    const { currency } = req.body;

    if (!currency) {
      return res.status(400).json({
        success: false,
        message: 'Currency is required'
      });
    }

    const supportedCurrencies = currencyService.getSupportedCurrencies();
    if (!supportedCurrencies[currency.toUpperCase()]) {
      return res.status(400).json({
        success: false,
        message: 'Unsupported currency'
      });
    }

    if (dbConnected) {
      const [result] = await pool.execute(
        'UPDATE `groups` SET default_currency = ?, currency_updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [currency.toUpperCase(), id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Group not found'
        });
      }

      res.json({
        success: true,
        message: 'Group currency updated successfully'
      });
    } else {
      res.json({
        success: true,
        message: 'Group currency updated (mock mode)'
      });
    }
  } catch (error) {
    console.error('Error updating group currency:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update group currency'
    });
  }
});

// Payment Gateway Integration Endpoints

// ==================== UPI PAYMENT ENDPOINTS ====================
// NO RAZORPAY - Pure UPI Deep Link Implementation

// 1. Confirm UPI Payment
app.post('/api/payments/confirm-upi', async (req, res) => {
  try {
    const { settlementId, paymentMethod, status, groupId, payerId, receiverId, amount, description } = req.body;

    console.log('=== UPI PAYMENT CONFIRMATION ===');
    console.log('Request body:', req.body);

    // Validation
    if (!paymentMethod || !status) {
      return res.status(400).json({
        success: false,
        message: 'Payment method and status are required'
      });
    }

    // Parse settlementId - it might be a composite ID like "21-22-0"
    let actualSettlementId = null;
    
    if (settlementId && typeof settlementId === 'string' && !settlementId.includes('-')) {
      actualSettlementId = parseInt(settlementId, 10);
    }

    console.log('Settlement ID:', settlementId);
    console.log('Parsed Settlement ID:', actualSettlementId);
    console.log('Status:', status);

    if (dbConnected) {
      const connection = await pool.getConnection();
      
      try {
        await connection.beginTransaction();

        // Generate unique transaction ID
        const transactionId = `UPI_${Date.now()}_${payerId}_${receiverId}`;
        
        console.log('Generated transaction ID:', transactionId);

        // Create payment transaction record matching your table structure
        const [transactionResult] = await connection.execute(
          `INSERT INTO payment_transactions 
           (settlement_id, group_id, payer_id, receiver_id, amount, currency, 
            original_amount, original_currency, payment_method, payment_gateway, 
            transaction_id, payment_status, net_amount, description) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            actualSettlementId,
            groupId,
            payerId,
            receiverId,
            amount,
            'INR',  // currency (NOT NULL)
            amount, // original_amount
            'INR',  // original_currency
            'upi',
            'upi_deeplink',
            transactionId,
            status,
            amount,
            description || 'UPI payment via QR code'
          ]
        );

        console.log('Payment transaction created with ID:', transactionResult.insertId);

        // If we have an actual settlement record, update it
        if (actualSettlementId && !isNaN(actualSettlementId)) {
          const [updateResult] = await connection.execute(
            `UPDATE settlements 
             SET payment_status = ?, 
                 transaction_id = ?,
                 payment_method = 'upi'
             WHERE id = ?`,
            [status, transactionId, actualSettlementId]
          );
          console.log('Settlement updated, rows affected:', updateResult.affectedRows);
        } else {
          // Create a new settlement record if it doesn't exist
          console.log('Creating new settlement record');
          const [settlementResult] = await connection.execute(
            `INSERT INTO settlements 
             (group_id, payer_id, receiver_id, amount, date, payment_status, transaction_id, payment_method)
             VALUES (?, ?, ?, ?, CURDATE(), ?, ?, 'upi')`,
            [groupId, payerId, receiverId, amount, status, transactionId]
          );
          console.log('New settlement created with ID:', settlementResult.insertId);
        }

        await connection.commit();
        connection.release();

        console.log('=== PAYMENT CONFIRMATION SUCCESS ===\n');

        res.json({
          success: true,
          message: `UPI payment ${status} successfully`,
          data: {
            settlementId: actualSettlementId || 'new',
            transactionId,
            status,
            paymentTransactionId: transactionResult.insertId
          }
        });
      } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Transaction error:', error);
        throw error;
      }
    } else {
      // Mock mode - no database
      console.log('Mock mode - no database connection');
      res.json({
        success: true,
        message: `UPI payment ${status} (mock mode)`,
        data: {
          settlementId: settlementId,
          transactionId: `UPI_MOCK_${Date.now()}`,
          status
        }
      });
    }
  } catch (error) {
    console.error('=== PAYMENT CONFIRMATION ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm UPI payment',
      error: error.message
    });
  }
});

// 2. Get Settlement Details with UPI IDs
app.get('/api/groups/:id/settlements', async (req, res) => {
  try {
    const { id } = req.params;

    if (dbConnected) {
      const [settlements] = await pool.execute(
        `SELECT s.*, 
                m1.name as payer_name, 
                m1.email as payer_email,
                m1.upi_id as payer_upi,
                m2.name as receiver_name,
                m2.email as receiver_email,
                m2.upi_id as receiver_upi
         FROM settlements s
         LEFT JOIN members m1 ON s.payer_id = m1.id
         LEFT JOIN members m2 ON s.receiver_id = m2.id
         WHERE s.group_id = ?
         ORDER BY s.payment_status ASC, s.date DESC`,
        [id]
      );

      res.json({
        success: true,
        data: settlements
      });
    } else {
      // Mock data with sample UPI IDs
      res.json({
        success: true,
        data: [
          {
            id: 1,
            group_id: parseInt(id),
            payer_id: 1,
            receiver_id: 2,
            amount: 250.00,
            currency: 'INR',
            date: new Date().toISOString().split('T')[0],
            payment_status: 'pending',
            payer_name: 'John Doe',
            payer_email: 'john@example.com',
            payer_upi: 'john@paytm',
            receiver_name: 'Jane Smith',
            receiver_email: 'jane@example.com',
            receiver_upi: 'jane@okaxis'
          }
        ]
      });
    }
  } catch (error) {
    console.error('Error fetching settlements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settlements',
      error: error.message
    });
  }
});

// 3. Get transaction history for a group

app.get('/api/groups/:id/transactions', async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    console.log('=== FETCHING TRANSACTIONS ===');
    console.log('Group ID:', groupId);
    console.log('Pagination:', { page, limit, offset });

    if (!dbConnected) {
      console.log('Database not connected - returning empty result');
      return res.json({
        success: true,
        data: {
          transactions: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0
          }
        }
      });
    }

    try {
      // First, check if there are any transactions for this group
      const [countResult] = await pool.execute(
        'SELECT COUNT(*) as total FROM payment_transactions WHERE group_id = ?',
        [groupId]
      );

      const total = countResult[0].total;
      console.log('Total transactions found:', total);

      if (total === 0) {
        console.log('No transactions found for this group');
        return res.json({
          success: true,
          data: {
            transactions: [],
            pagination: {
              page: 1,
              limit: limit,
              total: 0,
              totalPages: 0
            }
          }
        });
      }

      // Fetch transactions with proper JOINs
      const [transactions] = await pool.execute(
        `SELECT 
          pt.id,
          pt.settlement_id,
          pt.group_id,
          pt.payer_id,
          pt.receiver_id,
          pt.amount,
          pt.currency,
          pt.payment_method,
          pt.payment_gateway,
          pt.transaction_id,
          pt.payment_status,
          pt.description,
          pt.created_at,
          pt.updated_at,
          m1.name as payer_name,
          m1.upi_id as payer_upi,
          m2.name as receiver_name,
          m2.upi_id as receiver_upi
         FROM payment_transactions pt
         LEFT JOIN members m1 ON pt.payer_id = m1.id
         LEFT JOIN members m2 ON pt.receiver_id = m2.id
         WHERE pt.group_id = ?
         ORDER BY pt.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        [groupId, limit, offset]
      );

      console.log(`Found ${transactions.length} transactions`);
      console.log('Sample transaction:', transactions[0]);

      const totalPages = Math.ceil(total / limit);

      res.json({
        success: true,
        data: {
          transactions: transactions,
          pagination: {
            page: page,
            limit: limit,
            total: total,
            totalPages: totalPages
          }
        }
      });

      console.log('=== TRANSACTIONS FETCHED SUCCESSFULLY ===\n');

    } catch (queryError) {
      console.error('Query execution error:', queryError);
      console.error('SQL State:', queryError.sqlState);
      console.error('SQL Message:', queryError.sqlMessage);
      console.error('SQL:', queryError.sql);
      throw queryError;
    }

  } catch (error) {
    console.error('=== ERROR FETCHING TRANSACTIONS ===');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('Errno:', error.errno);
    console.error('Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction history',
      error: error.message,
      code: error.code,
      details: error.sqlMessage || error.message
    });
  }
});
// 4. Update member UPI ID
app.put('/api/members/:id/upi', async (req, res) => {
  try {
    const { id } = req.params;
    const { upiId } = req.body;

    if (!upiId) {
      return res.status(400).json({
        success: false,
        message: 'UPI ID is required'
      });
    }

    // Basic UPI ID validation
    const upiRegex = /^[\w.-]+@[\w.-]+$/;
    if (!upiRegex.test(upiId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid UPI ID format. Example: username@bank'
      });
    }

    if (dbConnected) {
      await pool.execute(
        'UPDATE members SET upi_id = ? WHERE id = ?',
        [upiId, id]
      );

      res.json({
        success: true,
        message: 'UPI ID updated successfully',
        data: { memberId: parseInt(id), upiId }
      });
    } else {
      // Mock mode
      res.json({
        success: true,
        message: 'UPI ID updated successfully (mock mode)',
        data: { memberId: parseInt(id), upiId }
      });
    }
  } catch (error) {
    console.error('Error updating UPI ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update UPI ID',
      error: error.message
    });
  }
});

// 5. Get member details including UPI ID
app.get('/api/members/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (dbConnected) {
      const [members] = await pool.execute(
        'SELECT id, name, email, upi_id FROM members WHERE id = ?',
        [id]
      );

      if (members.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Member not found'
        });
      }

      res.json({
        success: true,
        data: members[0]
      });
    } else {
      // Mock data
      res.json({
        success: true,
        data: {
          id: parseInt(id),
          name: 'Mock User',
          email: 'user@example.com',
          upi_id: 'user@paytm'
        }
      });
    }
  } catch (error) {
    console.error('Error fetching member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch member details',
      error: error.message
    });
  }
});

// 6. Cancel/Fail payment (optional - for dispute handling)
app.post('/api/payments/cancel', async (req, res) => {
  try {
    const { settlementId, reason } = req.body;

    if (!settlementId) {
      return res.status(400).json({
        success: false,
        message: 'Settlement ID is required'
      });
    }

    console.log('Cancelling payment for settlement:', settlementId, 'Reason:', reason);

    const settlementNumericId = parseInt(settlementId, 10);

    if (dbConnected) {
      const connection = await pool.getConnection();
      
      try {
        await connection.beginTransaction();

        // Update settlement status to failed
        await connection.execute(
          `UPDATE settlements 
           SET payment_status = 'failed'
           WHERE id = ?`,
          [settlementNumericId]
        );

        // If there's an existing transaction, update it
        await connection.execute(
          `UPDATE payment_transactions 
           SET payment_status = 'failed',
               description = CONCAT(COALESCE(description, ''), ' - Cancelled: ', ?)
           WHERE settlement_id = ? AND payment_status = 'pending'`,
          [reason || 'User cancelled', settlementNumericId]
        );

        await connection.commit();
        connection.release();

        res.json({
          success: true,
          message: 'Payment cancelled successfully'
        });
      } catch (error) {
        await connection.rollback();
        connection.release();
        throw error;
      }
    } else {
      // Mock mode
      res.json({
        success: true,
        message: 'Payment cancelled (mock mode)'
      });
    }
  } catch (error) {
    console.error('Error cancelling payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel payment',
      error: error.message
    });
  }
});

// // Create Razorpay order for settlement
// app.post('/api/payments/create-order', async (req, res) => {
//   try {
//     const { settlementId, amount, currency = 'INR', groupId, payerId, receiverId } = req.body;

//     if (!settlementId || !amount || !groupId || !payerId || !receiverId) {
//       return res.status(400).json({
//         success: false,
//         message: 'Required payment details are missing'
//       });
//     }

//     // Create Razorpay order
//     const options = {
//       amount: Math.round(amount * 100), // Amount in paise
//       currency: currency,
//       receipt: `settlement_${settlementId}_${Date.now()}`,
//       notes: {
//         settlement_id: settlementId,
//         group_id: groupId,
//         payer_id: payerId,
//         receiver_id: receiverId
//       }
//     };

//     const order = await razorpay.orders.create(options);

//     if (dbConnected) {
//       const connection = await pool.getConnection();
//       await connection.beginTransaction();

//       try {
//         // Create payment transaction record
//         const [result] = await connection.execute(
//           `INSERT INTO payment_transactions 
//            (settlement_id, group_id, payer_id, receiver_id, amount, currency, 
//             payment_method, payment_gateway, transaction_id, payment_status, 
//             created_at) 
//            VALUES (?, ?, ?, ?, ?, ?, 'razorpay', 'razorpay', ?, 'pending', CURRENT_TIMESTAMP)`,
//           [settlementId, groupId, payerId, receiverId, amount, currency, order.id]
//         );

//         // Update settlement to pending status
//         await connection.execute(
//           `UPDATE settlements 
//            SET payment_status = 'pending', transaction_id = ?, payment_method = 'razorpay' 
//            WHERE id = ?`,
//           [order.id, settlementId]
//         );

//         await connection.commit();
//         connection.release();

//         res.json({
//           success: true,
//           data: {
//             orderId: order.id,
//             amount: order.amount,
//             currency: order.currency,
//             key_id: process.env.RAZORPAY_KEY_ID,
//             transactionId: result.insertId
//           }
//         });
//       } catch (error) {
//         await connection.rollback();
//         connection.release();
//         throw error;
//       }
//     } else {
//       // Mock mode
//       res.json({
//         success: true,
//         data: {
//           orderId: order.id,
//           amount: order.amount,
//           currency: order.currency,
//           key_id: process.env.RAZORPAY_KEY_ID
//         }
//       });
//     }
//   } catch (error) {
//     console.error('Error creating Razorpay order:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to create payment order',
//       error: error.message
//     });
//   }
// });

// // Verify payment and update settlement
// app.post('/api/payments/verify', async (req, res) => {
//   try {
//     const { orderId, paymentId, signature, settlementId } = req.body;

//     if (!orderId || !paymentId || !signature || !settlementId) {
//       return res.status(400).json({
//         success: false,
//         message: 'Payment verification details are required'
//       });
//     }

//     // Verify Razorpay signature
//     const generatedSignature = crypto
//       .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
//       .update(`${orderId}|${paymentId}`)
//       .digest('hex');

//     const isValid = generatedSignature === signature;
//     const settlementNumericId = parseInt(settlementId, 10);

//     if (dbConnected) {
//       const connection = await pool.getConnection();
//       await connection.beginTransaction();

//       try {
//         if (isValid) {
//           // Fetch payment details from Razorpay
//           const payment = await razorpay.payments.fetch(paymentId);

//           // Update payment transaction status
//           await connection.execute(
//             `UPDATE payment_transactions 
//              SET payment_status = 'completed', 
//                  gateway_transaction_id = ?, 
//                  gateway_response = ?,
//                  fees = ?,
//                  net_amount = amount - ?,
//                  updated_at = CURRENT_TIMESTAMP 
//              WHERE transaction_id = ?`,
//             [
//               paymentId, 
//               JSON.stringify(payment),
//               payment.fee ? payment.fee / 100 : 0,
//               payment.fee ? payment.fee / 100 : 0,
//               orderId
//             ]
//           );

//           // Update settlement status
//           await connection.execute(
//             `UPDATE settlements 
//              SET payment_status = 'completed', 
//                  transaction_id = ? 
//              WHERE id = ?`,
//             [paymentId, settlementNumericId]
//           );

//           await connection.commit();
          
//           res.json({
//             success: true,
//             message: 'Payment verified and settlement completed successfully'
//           });
//         } else {
//           // Payment verification failed
//           await connection.execute(
//             `UPDATE payment_transactions 
//              SET payment_status = 'failed', 
//                  gateway_transaction_id = ?,
//                  updated_at = CURRENT_TIMESTAMP 
//              WHERE transaction_id = ?`,
//             [paymentId, orderId]
//           );

//           await connection.execute(
//             `UPDATE settlements 
//              SET payment_status = 'failed' 
//              WHERE id = ?`,
//             [settlementNumericId]
//           );

//           await connection.commit();

//           res.status(400).json({
//             success: false,
//             message: 'Payment verification failed - invalid signature'
//           });
//         }

//         connection.release();
//       } catch (error) {
//         await connection.rollback();
//         connection.release();
//         throw error;
//       }
//     } else {
//       // Mock mode
//       res.json({
//         success: isValid,
//         message: isValid ? 'Payment verified (mock mode)' : 'Payment verification failed'
//       });
//     }
//   } catch (error) {
//     console.error('Error verifying payment:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to verify payment',
//       error: error.message
//     });
//   }
// });

// app.post('/api/payments/failed', async (req, res) => {
//   try {
//     const { orderId, settlementId, error } = req.body;

//     if (!orderId || !settlementId) {
//       return res.status(400).json({
//         success: false,
//         message: 'Order details are required'
//       });
//     }

//     const settlementNumericId = parseInt(settlementId, 10);

//     if (dbConnected) {
//       const connection = await pool.getConnection();
//       await connection.beginTransaction();

//       try {
//         // Update payment transaction as failed
//         await connection.execute(
//           `UPDATE payment_transactions 
//            SET payment_status = 'failed',
//                gateway_response = ?,
//                updated_at = CURRENT_TIMESTAMP 
//            WHERE transaction_id = ?`,
//           [JSON.stringify({ error }), orderId]
//         );

//         // Update settlement as failed
//         await connection.execute(
//           `UPDATE settlements 
//            SET payment_status = 'failed' 
//            WHERE id = ?`,
//           [settlementNumericId]
//         );

//         await connection.commit();
//         connection.release();

//         res.json({
//           success: true,
//           message: 'Payment failure recorded'
//         });
//       } catch (error) {
//         await connection.rollback();
//         connection.release();
//         throw error;
//       }
//     } else {
//       res.json({
//         success: true,
//         message: 'Payment failure recorded (mock mode)'
//       });
//     }
//   } catch (error) {
//     console.error('Error recording payment failure:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to record payment failure'
//     });
//   }
// });

// // Get transaction history for a group
// app.get('/api/groups/:id/transactions', async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { page = 1, limit = 20 } = req.query;
//     const offset = (page - 1) * limit;

//     if (dbConnected) {
//       const [transactions] = await pool.execute(
//         `SELECT pt.*, 
//                 m1.name as payer_name, 
//                 m2.name as receiver_name,
//                 s.date as settlement_date
//          FROM payment_transactions pt
//          LEFT JOIN members m1 ON pt.payer_id = m1.id
//          LEFT JOIN members m2 ON pt.receiver_id = m2.id
//          LEFT JOIN settlements s ON pt.settlement_id = s.id
//          WHERE pt.group_id = ?
//          ORDER BY pt.created_at DESC
//          LIMIT ? OFFSET ?`,
//         [id, parseInt(limit), parseInt(offset)]
//       );

//       const [countResult] = await pool.execute(
//         'SELECT COUNT(*) as total FROM payment_transactions WHERE group_id = ?',
//         [id]
//       );

//       res.json({
//         success: true,
//         data: {
//           transactions,
//           pagination: {
//             page: parseInt(page),
//             limit: parseInt(limit),
//             total: countResult[0].total,
//             totalPages: Math.ceil(countResult[0].total / limit)
//           }
//         }
//       });
//     } else {
//       // Mock transaction data
//       res.json({
//         success: true,
//         data: {
//           transactions: [],
//           pagination: {
//             page: 1,
//             limit: 20,
//             total: 0,
//             totalPages: 0
//           }
//         }
//       });
//     }
//   } catch (error) {
//     console.error('Error fetching transactions:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to fetch transaction history'
//     });
//   }
// });

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
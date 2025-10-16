require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');
const Tesseract = require('tesseract.js');


const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

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
    
    // Get members
    const [members] = await pool.query('SELECT * FROM members WHERE group_id = ?', [groupId]);
    
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
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Member name is required' });
  }
  
  try {
    const [result] = await pool.query(
      'INSERT INTO members (name, group_id) VALUES (?, ?)',
      [name, groupId]
    );
    
    const [newMember] = await pool.query('SELECT * FROM members WHERE id = ?', [result.insertId]);
    res.status(201).json(newMember[0]);
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ error: 'Failed to add member' });
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
    // Get members
    const [members] = await pool.query('SELECT id, name FROM members WHERE group_id = ?', [groupId]);

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
        memberBalances[payerId].paid += (memberId === payerId ? 0 : 0); // already counted separately
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



// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
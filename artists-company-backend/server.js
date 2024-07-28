const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3001;

const db = new sqlite3.Database('transactions.db'); // Use a persistent database file

app.use(bodyParser.json());
app.use(cors());

// Initialize database and create table if it doesn't exist
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            running_balance REAL
        )
    `);
});

// Function to get the latest balance
const getLatestBalance = (callback) => {
    db.get('SELECT running_balance FROM transactions ORDER BY id DESC LIMIT 1', (err, row) => {
        if (err) {
            console.error(err.message);
            return callback(0); // Default balance if error occurs
        }
        callback(row ? row.running_balance : 0);
    });
};

// Add a new transaction
app.post('/transactions', (req, res) => {
    const { type, amount, description, date } = req.body;

    if (!type || !amount || !date) {
        return res.status(400).send('Missing required fields');
    }

    const amountValue = parseFloat(amount); // Ensure amount is a number

    getLatestBalance((latestBalance) => {
        let newBalance = latestBalance;

        if (type === 'credit') {
            newBalance += amountValue;
        } else if (type === 'debit') {
            newBalance -= amountValue;
        } else {
            return res.status(400).send('Invalid transaction type');
        }

        const stmt = db.prepare('INSERT INTO transactions (type, amount, description, date, running_balance) VALUES (?, ?, ?, ?, ?)');
        stmt.run(type, amountValue, description, date, newBalance, function(err) {
            if (err) {
                return res.status(500).send('Error adding transaction');
            }
            res.json({ id: this.lastID, type, amount: amountValue, description, date, running_balance: newBalance });
        });
        stmt.finalize();
    });
});

// Get all transactions
app.get('/transactions', (req, res) => {
    db.all('SELECT * FROM transactions ORDER BY date DESC', (err, rows) => {
        if (err) {
            return res.status(500).send('Error fetching transactions');
        }
        res.json(rows);
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

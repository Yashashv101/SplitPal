-- SplitPal Database Schema

-- Create groups table
CREATE TABLE `groups` (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create members table
CREATE TABLE members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE
);

-- Create expenses table
CREATE TABLE expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  payer_id INT NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  FOREIGN KEY (payer_id) REFERENCES members(id) ON DELETE CASCADE
);

-- Create expense_shares table
CREATE TABLE expense_shares (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expense_id INT NOT NULL,
  member_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- Create settlements table
CREATE TABLE settlements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  payer_id INT NOT NULL,
  receiver_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  FOREIGN KEY (payer_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES members(id) ON DELETE CASCADE
);

-- Add indexes for better performance
CREATE INDEX idx_members_group_id ON members(group_id);
CREATE INDEX idx_expenses_group_id ON expenses(group_id);
CREATE INDEX idx_expenses_payer_id ON expenses(payer_id);
CREATE INDEX idx_expense_shares_expense_id ON expense_shares(expense_id);
CREATE INDEX idx_expense_shares_member_id ON expense_shares(member_id);
CREATE INDEX idx_settlements_group_id ON settlements(group_id);
CREATE INDEX idx_settlements_payer_receiver ON settlements(payer_id, receiver_id);
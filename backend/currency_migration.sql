-- Currency Support Migration for SplitPal
-- This script adds multi-currency support to the existing database

-- Add currency support to groups table
ALTER TABLE `groups` 
ADD COLUMN default_currency VARCHAR(3) DEFAULT 'INR' AFTER description,
ADD COLUMN currency_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER default_currency;

-- Add currency support to expenses table
ALTER TABLE expenses 
ADD COLUMN currency VARCHAR(3) DEFAULT 'INR' AFTER amount,
ADD COLUMN original_amount DECIMAL(10, 2) AFTER currency,
ADD COLUMN exchange_rate DECIMAL(10, 6) DEFAULT 1.000000 AFTER original_amount,
ADD COLUMN base_currency VARCHAR(3) DEFAULT 'INR' AFTER exchange_rate;

-- Add currency support to expense_shares table
ALTER TABLE expense_shares 
ADD COLUMN currency VARCHAR(3) DEFAULT 'INR' AFTER amount,
ADD COLUMN original_amount DECIMAL(10, 2) AFTER currency,
ADD COLUMN exchange_rate DECIMAL(10, 6) DEFAULT 1.000000 AFTER original_amount;

-- Add currency support to settlements table
ALTER TABLE settlements 
ADD COLUMN currency VARCHAR(3) DEFAULT 'INR' AFTER amount,
ADD COLUMN original_amount DECIMAL(10, 2) AFTER currency,
ADD COLUMN exchange_rate DECIMAL(10, 6) DEFAULT 1.000000 AFTER original_amount,
ADD COLUMN payment_method VARCHAR(50) DEFAULT 'manual' AFTER exchange_rate,
ADD COLUMN transaction_id VARCHAR(100) AFTER payment_method,
ADD COLUMN payment_status ENUM('pending', 'processing', 'completed', 'failed', 'refunded') DEFAULT 'completed' AFTER transaction_id;

-- Create currency_rates table for real-time exchange rates
CREATE TABLE currency_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(10, 6) NOT NULL,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  source VARCHAR(50) DEFAULT 'exchangerate-api',
  UNIQUE KEY unique_currency_pair (from_currency, to_currency),
  INDEX idx_currency_pair (from_currency, to_currency),
  INDEX idx_last_updated (last_updated)
);

-- Create payment_transactions table for comprehensive transaction history
CREATE TABLE payment_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  settlement_id INT,
  group_id INT NOT NULL,
  payer_id INT NOT NULL,
  receiver_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  original_amount DECIMAL(10, 2),
  original_currency VARCHAR(3),
  exchange_rate DECIMAL(10, 6) DEFAULT 1.000000,
  payment_method VARCHAR(50) NOT NULL,
  payment_gateway VARCHAR(50),
  transaction_id VARCHAR(100),
  gateway_transaction_id VARCHAR(100),
  payment_status ENUM('pending', 'processing', 'completed', 'failed', 'refunded') NOT NULL,
  gateway_response JSON,
  fees DECIMAL(10, 2) DEFAULT 0.00,
  net_amount DECIMAL(10, 2),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE SET NULL,
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  FOREIGN KEY (payer_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES members(id) ON DELETE CASCADE,
  INDEX idx_payment_group_id (group_id),
  INDEX idx_payment_payer_id (payer_id),
  INDEX idx_payment_receiver_id (receiver_id),
  INDEX idx_payment_status (payment_status),
  INDEX idx_payment_method (payment_method),
  INDEX idx_transaction_id (transaction_id),
  INDEX idx_gateway_transaction_id (gateway_transaction_id),
  INDEX idx_created_at (created_at)
);

-- Create supported_currencies table for currency management
CREATE TABLE supported_currencies (
  code VARCHAR(3) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  decimal_places INT DEFAULT 2,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert common currencies
INSERT INTO supported_currencies (code, name, symbol, decimal_places) VALUES
('INR', 'Indian Rupee', '₹', 2),
('USD', 'US Dollar', '$', 2),
('EUR', 'Euro', '€', 2),
('GBP', 'British Pound', '£', 2),
('JPY', 'Japanese Yen', '¥', 0),
('CAD', 'Canadian Dollar', 'C$', 2),
('AUD', 'Australian Dollar', 'A$', 2),
('CHF', 'Swiss Franc', 'CHF', 2),
('CNY', 'Chinese Yuan', '¥', 2),
('SGD', 'Singapore Dollar', 'S$', 2);

-- Add indexes for better performance on new columns
CREATE INDEX idx_groups_currency ON `groups`(default_currency);
CREATE INDEX idx_expenses_currency ON expenses(currency);
CREATE INDEX idx_expense_shares_currency ON expense_shares(currency);
CREATE INDEX idx_settlements_currency ON settlements(currency);
CREATE INDEX idx_settlements_payment_status ON settlements(payment_status);
CREATE INDEX idx_settlements_transaction_id ON settlements(transaction_id);

-- Update existing data to have default currency values
UPDATE `groups` SET default_currency = 'INR' WHERE default_currency IS NULL;
UPDATE expenses SET currency = 'INR', original_amount = amount WHERE currency IS NULL;
UPDATE expense_shares SET currency = 'INR', original_amount = amount WHERE currency IS NULL;
UPDATE settlements SET currency = 'INR', original_amount = amount WHERE currency IS NULL;
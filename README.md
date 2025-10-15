# SplitPal - Expense Sharing App

SplitPal is a web-based alternative to Splitwise that runs entirely in the browser. It allows users to create groups, add members, track expenses, and settle balances.

## Features

- Group Management: Create groups and add members
- Expense Management: Add expenses and split them equally among participants
- Balance Calculation: See who owes whom and how much
- Settlement: Record payments between members

## Tech Stack

- Frontend: React + TailwindCSS
- Backend: Node.js + Express.js
- Database: MySQL

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MySQL

### Database Setup

1. Install MySQL if you haven't already
2. Create a database and tables using the schema.sql file:
   ```
   mysql -u root -p < backend/schema.sql
   ```

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd splitpal/backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a .env file with your database credentials:
   ```
   PORT=5000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=splitpal
   ```

4. Start the server:
   ```
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd splitpal/frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open your browser and navigate to http://localhost:5173

## API Endpoints

- GET /api/groups - Get all groups
- POST /api/groups - Create a new group
- GET /api/groups/:id - Get group details
- POST /api/groups/:id/members - Add a member to a group
- POST /api/groups/:id/expenses - Add an expense to a group
- GET /api/groups/:id/balances - Get balances for a group
- POST /api/groups/:id/settlements - Record a settlement between members
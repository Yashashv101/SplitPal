import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import CurrencySelector from '../components/CurrencySelector';
import CurrencyConverter from '../components/CurrencyConverter';
import PayNowButton from '../components/PayNowButton';
import TransactionHistory from '../components/TransactionHistory';

const API_URL = 'http://localhost:5001/api';

function GroupDetailPage() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState({});
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [ocrItems, setOcrItems] = useState([]);
  const [expenseData, setExpenseData] = useState({
    description: '',
    amount: '',
    paid_by: '',
    participants: [],
    currency: 'INR'
  });
  const [splitAmounts, setSplitAmounts] = useState({});
  const [loading, setLoading] = useState({
    group: false,
    balances: false,
    addingMember: false,
    addingExpense: false,
    settling: false
  });
  const [errors, setErrors] = useState({});
  const [settlementData, setSettlementData] = useState({
    paid_by: '',
    paid_to: '',
    amount: ''
  });
  const [currencies, setCurrencies] = useState([]);
  const [exchangeRates, setExchangeRates] = useState({});
  const [selectedCurrency, setSelectedCurrency] = useState('INR');
  const [showCurrencyConverter, setShowCurrencyConverter] = useState(false);
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);

  useEffect(() => {
    fetchGroupDetails();
    fetchBalances();
    fetchCurrencies();
    fetchExchangeRates();
  }, [groupId]);

  // Auto-split calculation useEffect
  useEffect(() => {
    if (expenseData.amount && expenseData.participants.length > 0) {
      const amount = parseFloat(expenseData.amount);
      const participantCount = expenseData.participants.length;
      const splitAmount = amount / participantCount;
      
      const newSplitAmounts = {};
      expenseData.participants.forEach(participantId => {
        newSplitAmounts[participantId] = splitAmount.toFixed(2);
      });
      setSplitAmounts(newSplitAmounts);
    } else {
      setSplitAmounts({});
    }
  }, [expenseData.amount, expenseData.participants]);

  const fetchGroupDetails = async () => {
    setLoading(prev => ({ ...prev, group: true }));
    try {
      const response = await axios.get(`${API_URL}/groups/${groupId}`);
      
      // Data verification
      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Invalid group data received');
      }
      
      setGroup(response.data);
      setMembers(Array.isArray(response.data.members) ? response.data.members : []);
      setExpenses(Array.isArray(response.data.expenses) ? response.data.expenses : []);
    } catch (error) {
      console.error('Error fetching group details:', error);
      setErrors(prev => ({ ...prev, group: 'Failed to load group details' }));
    } finally {
      setLoading(prev => ({ ...prev, group: false }));
    }
  };

  const fetchBalances = async () => {
    setLoading(prev => ({ ...prev, balances: true }));
    try {
      const response = await axios.get(`${API_URL}/groups/${groupId}/balances`);
      
      // Data verification
      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Invalid balance data received');
      }
      
      setBalances(response.data.memberBalances || {});
      if (response.data.members && Array.isArray(response.data.members)) {
        setMembers(response.data.members);
      }
    } catch (error) {
      console.error('Error fetching balances:', error);
      setErrors(prev => ({ ...prev, balances: 'Failed to load balances' }));
    } finally {
      setLoading(prev => ({ ...prev, balances: false }));
    }
  };

  const fetchCurrencies = async () => {
    try {
      const response = await axios.get(`${API_URL}/currencies/supported`);
      if (response.data.success) {
        setCurrencies(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching currencies:', error);
    }
  };

  const fetchExchangeRates = async () => {
    try {
      const response = await axios.get(`${API_URL}/currencies/rates`);
      if (response.data.success) {
        // The API returns rates nested under 'rates' property
        setExchangeRates(response.data.rates || {});
      }
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      // Set fallback rates to prevent crashes
      setExchangeRates({
        'USD': { 'INR': 83.25, 'EUR': 0.85, 'GBP': 0.73 },
        'INR': { 'USD': 0.012, 'EUR': 0.010, 'GBP': 0.0088 }
      });
    }
  };

  // Format amount with currency symbol
  const formatAmount = (amount, currency) => {
    // Ensure amount is a valid number
    const numericAmount = parseFloat(amount) || 0;
    const convertedAmount = convertCurrency(numericAmount, 'INR', currency);
    
    // Ensure convertedAmount is a valid number
    const finalAmount = parseFloat(convertedAmount) || 0;
    
    const symbols = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'INR': '₹',
      'AUD': 'A$',
      'CAD': 'C$',
      'CHF': 'CHF',
      'CNY': '¥',
      'SEK': 'kr'
    };
    return `${symbols[currency] || currency}${finalAmount.toFixed(2)}`;
  };

  // Convert currency using exchange rates
  const convertCurrency = (amount, fromCurrency, toCurrency) => {
    // Ensure amount is a valid number
    const numericAmount = parseFloat(amount) || 0;
    
    if (fromCurrency === toCurrency) return numericAmount;
    
    // Add null checks for exchangeRates and nested properties
    if (!exchangeRates || typeof exchangeRates !== 'object') return numericAmount;
    if (!exchangeRates[fromCurrency] || !exchangeRates[fromCurrency][toCurrency]) {
      // Try reverse conversion if direct conversion not available
      if (exchangeRates[toCurrency] && exchangeRates[toCurrency][fromCurrency]) {
        return numericAmount / exchangeRates[toCurrency][fromCurrency];
      }
      return numericAmount;
    }
    
    // Direct conversion available
    const convertedAmount = numericAmount * exchangeRates[fromCurrency][toCurrency];
    
    // Ensure result is a valid number
    return parseFloat(convertedAmount) || numericAmount;
  };

  const handlePaymentSuccess = (paymentData) => {
    console.log('Payment successful:', paymentData);
    // Refresh balances after successful payment
    fetchBalances();
    // Show success message
    setErrors(prev => ({ ...prev, payment: '' }));
  };

  const handlePaymentError = (error) => {
    console.error('Payment failed:', error);
    setErrors(prev => ({ ...prev, payment: error }));
  };


  const addMember = async (e) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      setErrors(prev => ({ ...prev, member: 'Member name is required' }));
      return;
    }
    
    setLoading(prev => ({ ...prev, addingMember: true }));
    setErrors(prev => ({ ...prev, member: '' }));

    try {
      await axios.post(`${API_URL}/groups/${groupId}/members`, { name: newMemberName });
      setNewMemberName('');
      setShowAddMemberModal(false);
      fetchGroupDetails();
    } catch (error) {
      console.error('Error adding member:', error);
      setErrors(prev => ({ ...prev, member: 'Failed to add member' }));
    } finally {
      setLoading(prev => ({ ...prev, addingMember: false }));
    }
  };

  const addExpense = async (e) => {
  e.preventDefault();
  
  setErrors(prev => ({ ...prev, expense: '' }));

  // Validation
  if (!expenseData.description.trim()) {
    setErrors(prev => ({ ...prev, expense: 'Please enter a description' }));
    return;
  }

  if (!expenseData.amount || parseFloat(expenseData.amount) <= 0) {
    setErrors(prev => ({ ...prev, expense: 'Please enter a valid amount' }));
    return;
  }

  if (!expenseData.paid_by) {
    setErrors(prev => ({ ...prev, expense: 'Please select who paid for this expense' }));
    return;
  }

  setLoading(prev => ({ ...prev, addingExpense: true }));

  try {
    let finalDescription = expenseData.description;
    
    // If we have OCR items, include them in description
    if (ocrItems.length > 0) {
      const itemsList = ocrItems
        .map(item => `${item.description}: ₹${item.amount.toFixed(2)}`)
        .join(', ');
      finalDescription = `${expenseData.description} [${itemsList}]`;
    }

    // Create expense object with correct field names
    const newExpense = {
      description: finalDescription,
      amount: parseFloat(expenseData.amount),
      paid_by: parseInt(expenseData.paid_by), // Ensure it's a number
      participants: expenseData.participants.length > 0 
        ? expenseData.participants.map(id => parseInt(id)) // Ensure IDs are numbers
        : members.map(m => parseInt(m.id))
    };

    console.log('Submitting expense:', newExpense);
    console.log('To URL:', `${API_URL}/groups/${groupId}/expenses`);

    const response = await axios.post(`${API_URL}/groups/${groupId}/expenses`, newExpense);
    
    console.log('Expense added successfully:', response.data);

    // Reset states
    setExpenseData({ 
      description: '', 
      amount: '', 
      paid_by: '', 
      participants: [] 
    });
    setOcrItems([]);
    setShowAddExpenseModal(false);

    // Refresh group details and balances
    await fetchGroupDetails();
    await fetchBalances();

  } catch (error) {
    console.error('Error adding expense:', error);
    console.error('Error response:', error.response?.data);
    
    const errorMessage = error.response?.data?.error 
      || error.response?.data?.details 
      || error.message 
      || 'Unknown error occurred';
    
    setErrors(prev => ({ ...prev, expense: 'Failed to add expense: ' + errorMessage }));
  } finally {
    setLoading(prev => ({ ...prev, addingExpense: false }));
  }
};


  const settleUp = async (e) => {
  e.preventDefault();
  
  setErrors(prev => ({ ...prev, settlement: '' }));
  
  // Validation
  if (!settlementData.paid_by) {
    setErrors(prev => ({ ...prev, settlement: 'Please select who paid' }));
    return;
  }

  if (!settlementData.paid_to) {
    setErrors(prev => ({ ...prev, settlement: 'Please select who received the payment' }));
    return;
  }

  if (!settlementData.amount || parseFloat(settlementData.amount) <= 0) {
    setErrors(prev => ({ ...prev, settlement: 'Please enter a valid amount' }));
    return;
  }

  if (settlementData.paid_by === settlementData.paid_to) {
    setErrors(prev => ({ ...prev, settlement: 'Cannot settle with yourself' }));
    return;
  }

  setLoading(prev => ({ ...prev, settling: true }));

  try {
    console.log('Submitting settlement:', settlementData);

    const response = await axios.post(`${API_URL}/groups/${groupId}/settlements`, {
      paid_by: parseInt(settlementData.paid_by),
      paid_to: parseInt(settlementData.paid_to),
      amount: parseFloat(settlementData.amount)
    });

    console.log('Settlement response:', response.data);

    // Reset form
    setSettlementData({
      paid_by: '',
      paid_to: '',
      amount: ''
    });
    setShowSettleModal(false);
    
    // Refresh data
    await fetchBalances();
    await fetchGroupDetails();

  } catch (error) {
    console.error('Error settling up:', error);
    console.error('Error response:', error.response?.data);
    
    const errorMessage = error.response?.data?.error 
      || error.response?.data?.details 
      || error.message 
      || 'Unknown error occurred';
    
    setErrors(prev => ({ ...prev, settlement: 'Failed to record settlement: ' + errorMessage }));
  } finally {
    setLoading(prev => ({ ...prev, settling: false }));
  }
};


  const handleBillUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  console.log('Uploading bill for OCR processing...');

  const formData = new FormData();
  formData.append('bill', file);

  try {
    const response = await axios.post(`${API_URL}/ocr/bill`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    console.log('OCR Response:', response.data);

    const extractedItems = response.data.items || [];
    const totalAmount = response.data.totalAmount || 0;

    // Set OCR items for preview
    setOcrItems(extractedItems);

    // Autofill description and amount
    setExpenseData({
      ...expenseData,
      amount: totalAmount.toFixed(2),
      description: extractedItems.length > 0 
        ? (extractedItems.length === 1 
            ? extractedItems[0].description 
            : `Bill with ${extractedItems.length} items`)
        : expenseData.description
    });

    alert(`Successfully extracted ${extractedItems.length} items from bill!`);

  } catch (error) {
    console.error('Error processing OCR:', error);
    alert('Failed to process bill. Please enter details manually.');
  }
};


  const handleExpenseParticipantChange = (memberId) => {
    const updatedParticipants = [...expenseData.participants];
    
    if (updatedParticipants.includes(memberId)) {
      const index = updatedParticipants.indexOf(memberId);
      updatedParticipants.splice(index, 1);
    } else {
      updatedParticipants.push(memberId);
    }
    
    setExpenseData({
      ...expenseData,
      participants: updatedParticipants
    });
  };

  if (loading.group || !group) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-lg">Loading group details...</span>
      </div>
    );
  }

  if (errors.group) {
    return (
      <div className="text-center py-20">
        <div className="text-red-500 text-lg mb-4">{errors.group}</div>
        <button 
          onClick={() => {
            setErrors(prev => ({ ...prev, group: '' }));
            fetchGroupDetails();
          }}
          className="btn btn-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{group.name}</h1>
        <div className="space-x-2">
          <button 
            onClick={() => setShowAddMemberModal(true)}
            className="btn btn-secondary"
          >
            Add Member
          </button>
          <button 
            onClick={() => setShowAddExpenseModal(true)}
            className="btn btn-primary"
          >
            Add Expense
          </button>
          <button 
            onClick={() => setShowSettleModal(true)}
            className="btn btn-secondary"
          >
            Settle Up
          </button>
          <button 
            onClick={() => setShowTransactionHistory(true)}
            className="btn btn-outline"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            History
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Members Section */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Members</h2>
          {members.length === 0 ? (
            <p className="text-gray-500">No members yet</p>
          ) : (
            <ul className="space-y-2">
              {members.map((member) => (
                <li key={member.id} className="flex items-center">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-8 h-8 flex items-center justify-center mr-2">
                    {member.name.charAt(0).toUpperCase()}
                  </span>
                  <span>{member.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Expenses Section */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Expenses</h2>
          {expenses.length === 0 ? (
            <p className="text-gray-500">No expenses yet</p>
          ) : (
            <ul className="space-y-3">
              {expenses.map((expense) => {
                const paidBy = members.find(m => m.id === expense.payer_id);
                return (
                  <li key={expense.id} className="border-b pb-2">
                    <div className="flex justify-between">
                      <span className="font-medium">{expense.description}</span>
                      <span className="text-green-600 font-medium">
                        {formatAmount(expense.amount, selectedCurrency)}
                      </span>
                      {selectedCurrency !== 'INR' && (
                        <div className="text-xs text-gray-500">
                          ₹{expense.amount}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      Paid by {paidBy ? paidBy.name : 'Unknown'} • {new Date(expense.date || expense.created_at).toLocaleDateString()}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Balances Section */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Balance Summary</h2>
            <div className="flex items-center space-x-2">
              <CurrencySelector
                currencies={currencies}
                selectedCurrency={selectedCurrency}
                onCurrencyChange={setSelectedCurrency}
                size="sm"
              />
              <button
                onClick={() => setShowCurrencyConverter(!showCurrencyConverter)}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
              >
                {showCurrencyConverter ? 'Hide' : 'Show'} Converter
              </button>
            </div>
          </div>
          
          {showCurrencyConverter && (
            <div className="mb-4">
              <CurrencyConverter
                currencies={currencies}
                exchangeRates={exchangeRates}
                onRatesUpdate={setExchangeRates}
              />
            </div>
          )}
          {loading.balances ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-2">Loading balances...</span>
            </div>
          ) : errors.balances ? (
            <div className="text-red-500 text-center py-4">{errors.balances}</div>
          ) : (
            <div className="space-y-4">
              {members.map(member => {
                const balance = balances[member.id] || { paid: 0, getsBack: 0, owes: [] };
                const netBalance = balance.getsBack - balance.owes.reduce((sum, owe) => sum + owe.amount, 0);
                
                return (
                  <div key={member.id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold text-lg">{member.name}</h3>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        netBalance > 0 
                          ? 'bg-green-100 text-green-800' 
                          : netBalance < 0 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        Net: {netBalance > 0 ? '+' : ''}{formatAmount(Math.abs(netBalance), selectedCurrency)}
                        {selectedCurrency !== 'INR' && (
                          <div className="text-xs text-gray-500">
                            ₹{netBalance.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div className="text-center">
                        <div className="text-sm text-gray-600">Total Paid</div>
                        <div className="text-lg font-medium text-blue-600">
                          {formatAmount(balance.paid, selectedCurrency)}
                        </div>
                        {selectedCurrency !== 'INR' && (
                          <div className="text-xs text-gray-500">
                            ₹{balance.paid.toFixed(2)}
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-gray-600">Gets Back</div>
                        <div className="text-lg font-medium text-green-600">
                          {formatAmount(balance.getsBack, selectedCurrency)}
                        </div>
                        {selectedCurrency !== 'INR' && (
                          <div className="text-xs text-gray-500">
                            ₹{balance.getsBack.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {balance.owes.length > 0 && (
                      <div>
                        <div className="text-sm text-gray-600 mb-2">Owes:</div>
                        <ul className="space-y-2">
                          {balance.owes.map((o, i) => {
                            const toMember = members.find(m => m.id === o.to);
                            const settlement = {
                              id: `${member.id}-${o.to}-${i}`,
                              amount: o.amount,
                              currency: selectedCurrency,
                              payer_id: member.id,
                              receiver_id: o.to,
                              description: o.description
                            };
                            
                            return (
                              <li key={i} className="bg-white rounded px-3 py-3 border">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm">
                                    <span className="font-medium">{toMember?.name || 'Unknown'}</span>
                                    <span className="text-gray-500 ml-1">for {o.description}</span>
                                  </span>
                                  <span className="font-medium text-red-600">
                                {formatAmount(o.amount, selectedCurrency)}
                              </span>
                              {selectedCurrency !== 'INR' && (
                                <div className="text-xs text-gray-500">
                                  ₹{o.amount.toFixed(2)}
                                </div>
                              )}
                                </div>
                                <div className="flex justify-end">
                                  <PayNowButton
                                    settlement={settlement}
                                    groupId={groupId}
                                    onPaymentSuccess={handlePaymentSuccess}
                                    onPaymentError={handlePaymentError}
                                    className="text-xs"
                                  />
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>


      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Member</h2>
            {errors.member && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {errors.member}
              </div>
            )}
            <form onSubmit={addMember}>
              <div className="mb-4">
                <label htmlFor="memberName" className="block text-gray-700 mb-2">
                  Member Name
                </label>
                <input
                  type="text"
                  id="memberName"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="form-input"
                  placeholder="Enter member name"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMemberModal(false);
                    setErrors(prev => ({ ...prev, member: '' }));
                  }}
                  className="btn btn-secondary"
                  disabled={loading.addingMember}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading.addingMember}
                >
                  {loading.addingMember ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Adding...
                    </>
                  ) : (
                    'Add'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add Expense</h2>
            {errors.expense && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {errors.expense}
              </div>
            )}
            <form onSubmit={addExpense}>
              
              {/* Bill Upload Section */}
              <div className="mb-4">
                <label htmlFor="billUpload" className="block text-gray-700 mb-2">
                  Upload Bill (optional)
                </label>
                <input
                  type="file"
                  id="billUpload"
                  accept="image/*"
                  onChange={handleBillUpload}
                  className="form-input w-full"
                />
                <p className="text-xs text-gray-500 mt-1">Upload a bill image to auto-extract items</p>
              </div>

              {/* OCR Items Preview */}
              {ocrItems.length > 0 && (
                <div className="mb-4 bg-gray-50 p-3 rounded border">
                  <h3 className="font-semibold mb-2 text-sm">Extracted Items (editable)</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {ocrItems.map((item, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => {
                            const updatedItems = [...ocrItems];
                            updatedItems[index].description = e.target.value;
                            setOcrItems(updatedItems);
                          }}
                          className="flex-1 border rounded px-2 py-1 text-sm"
                          placeholder="Item description"
                        />
                        <input
                          type="number"
                          value={item.amount}
                          min="0.01"
                          step="0.01"
                          onChange={(e) => {
                            const updatedItems = [...ocrItems];
                            updatedItems[index].amount = parseFloat(e.target.value) || 0;
                            setOcrItems(updatedItems);
                            // Recalculate total
                            const newTotal = updatedItems.reduce((sum, i) => sum + (i.amount || 0), 0);
                            setExpenseData({
                              ...expenseData, 
                              amount: newTotal.toFixed(2)
                            });
                          }}
                          className="w-24 border rounded px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updatedItems = ocrItems.filter((_, i) => i !== index);
                            setOcrItems(updatedItems);
                            // Recalculate total
                            const newTotal = updatedItems.reduce((sum, i) => sum + (i.amount || 0), 0);
                            setExpenseData({
                              ...expenseData, 
                              amount: newTotal > 0 ? newTotal.toFixed(2) : expenseData.amount
                            });
                          }}
                          className="text-red-500 hover:text-red-700 px-2"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Description Input */}
              <div className="mb-4">
                <label htmlFor="description" className="block text-gray-700 mb-2">
                  Description *
                </label>
                <input
                  type="text"
                  id="description"
                  value={expenseData.description}
                  onChange={(e) => setExpenseData({...expenseData, description: e.target.value})}
                  className="form-input w-full"
                  placeholder="What was this expense for?"
                  required
                />
              </div>

              {/* Amount and Currency Input */}
              <div className="mb-4">
                <label htmlFor="amount" className="block text-gray-700 mb-2">
                  Amount *
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    id="amount"
                    value={expenseData.amount}
                    onChange={(e) => setExpenseData({...expenseData, amount: e.target.value})}
                    className="form-input flex-1"
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                    required
                  />
                  <div className="w-32">
                    <CurrencySelector
                      currencies={currencies}
                      selectedCurrency={expenseData.currency || selectedCurrency}
                      onCurrencyChange={(currency) => setExpenseData({...expenseData, currency})}
                      size="md"
                    />
                  </div>
                </div>
              </div>

              {/* Paid By Selection */}
              <div className="mb-4">
                <label htmlFor="paidBy" className="block text-gray-700 mb-2">
                  Paid By *
                </label>
                <select
                  id="paidBy"
                  value={expenseData.paid_by}
                  onChange={(e) => setExpenseData({...expenseData, paid_by: e.target.value})}
                  className="form-input w-full"
                  required
                >
                  <option value="">Select a member</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>

              {/* Split Between */}
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  Split Between (leave empty for all members)
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-2">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`participant-${member.id}`}
                        checked={expenseData.participants.includes(member.id)}
                        onChange={() => handleExpenseParticipantChange(member.id)}
                        className="mr-2"
                      />
                      <label htmlFor={`participant-${member.id}`} className="cursor-pointer">
                        {member.name}
                      </label>
                    </div>
                  ))}
                </div>
                {expenseData.participants.length > 0 && expenseData.amount && (
                  <div className="mt-2 p-2 bg-blue-50 rounded border">
                    <p className="text-xs text-blue-600 font-medium mb-1">
                      Split between {expenseData.participants.length} member(s):
                    </p>
                    <div className="space-y-1">
                      {expenseData.participants.map(participantId => {
                        const member = members.find(m => m.id === participantId);
                        const splitAmount = splitAmounts[participantId] || '0.00';
                        return (
                          <div key={participantId} className="flex justify-between text-xs">
                            <span>{member?.name || 'Unknown'}</span>
                            <span className="font-medium">₹{splitAmount}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddExpenseModal(false);
                    setOcrItems([]);
                    setExpenseData({
                      description: '',
                      amount: '',
                      paid_by: '',
                      participants: []
                    });
                    setErrors(prev => ({ ...prev, expense: '' }));
                  }}
                  className="btn btn-secondary"
                  disabled={loading.addingExpense}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading.addingExpense}
                >
                  {loading.addingExpense ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Adding...
                    </>
                  ) : (
                    'Add Expense'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSettleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Settle Up</h2>
            {errors.settlement && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {errors.settlement}
              </div>
            )}
            
            {/* Show current balances for reference */}
            <div className="mb-4 bg-gray-50 p-3 rounded border">
              <h3 className="font-semibold mb-2 text-sm">Current Balances:</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto text-sm">
                {members.map(member => {
                  const balance = balances[member.id] || { paid: 0, getsBack: 0, owes: [] };
                  const netBalance = balance.getsBack - balance.owes.reduce((sum, o) => sum + o.amount, 0);
                  
                  return (
                    <div key={member.id} className="flex justify-between items-center">
                      <span className="font-medium">{member.name}</span>
                      <span className={netBalance > 0 ? 'text-green-600' : netBalance < 0 ? 'text-red-600' : 'text-gray-600'}>
                        {netBalance > 0 ? `+₹${netBalance.toFixed(2)}` : 
                        netBalance < 0 ? `-₹${Math.abs(netBalance).toFixed(2)}` : 
                        'Settled'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <form onSubmit={settleUp}>
              <div className="mb-4">
                <label htmlFor="settlePaidBy" className="block text-gray-700 mb-2">
                  Who Paid? *
                </label>
                <select
                  id="settlePaidBy"
                  value={settlementData.paid_by}
                  onChange={(e) => setSettlementData({...settlementData, paid_by: e.target.value})}
                  className="form-input w-full"
                  required
                >
                  <option value="">Select a member</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label htmlFor="settlePaidTo" className="block text-gray-700 mb-2">
                  Paid To? *
                </label>
                <select
                  id="settlePaidTo"
                  value={settlementData.paid_to}
                  onChange={(e) => setSettlementData({...settlementData, paid_to: e.target.value})}
                  className="form-input w-full"
                  required
                >
                  <option value="">Select a member</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label htmlFor="settleAmount" className="block text-gray-700 mb-2">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  id="settleAmount"
                  value={settlementData.amount}
                  onChange={(e) => setSettlementData({...settlementData, amount: e.target.value})}
                  className="form-input w-full"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  required
                />
                {settlementData.paid_by && settlementData.paid_to && settlementData.amount && (
                  <p className="text-xs text-gray-600 mt-2">
                    {members.find(m => m.id === parseInt(settlementData.paid_by))?.name} paid ₹
                    {parseFloat(settlementData.amount).toFixed(2)} to {members.find(m => m.id === parseInt(settlementData.paid_to))?.name}
                  </p>
                )}
              </div>

              <div className="flex justify-end space-x-2 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowSettleModal(false);
                    setSettlementData({
                      paid_by: '',
                      paid_to: '',
                      amount: ''
                    });
                    setErrors(prev => ({ ...prev, settlement: '' }));
                  }}
                  className="btn btn-secondary"
                  disabled={loading.settling}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading.settling}
                >
                  {loading.settling ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Recording...
                    </>
                  ) : (
                    'Record Settlement'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction History Modal */}
      {showTransactionHistory && (
        <TransactionHistory
          groupId={groupId}
          onClose={() => setShowTransactionHistory(false)}
        />
      )}

    </div>
  );
}

export default GroupDetailPage;
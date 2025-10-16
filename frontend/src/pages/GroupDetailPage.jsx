import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

function GroupDetailPage() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [ocrItems, setOcrItems] = useState([]);
  const [expenseData, setExpenseData] = useState({
    description: '',
    amount: '',
    paid_by: '',
    participants: []
  });
  const [settlementData, setSettlementData] = useState({
    paid_by: '',
    paid_to: '',
    amount: ''
  });

  useEffect(() => {
    fetchGroupDetails();
    fetchBalances();
  }, [groupId]);

  const fetchGroupDetails = async () => {
    try {
      const response = await axios.get(`${API_URL}/groups/${groupId}`);
      setGroup(response.data);
      setMembers(response.data.members || []);
      setExpenses(response.data.expenses || []);
    } catch (error) {
      console.error('Error fetching group details:', error);
    }
  };

  const fetchBalances = async () => {
  try {
    const response = await axios.get(`${API_URL}/groups/${groupId}/balances`);
    setBalances(response.data.memberBalances);
    setMembers(response.data.members);
  } catch (error) {
    console.error('Error fetching balances:', error);
  }
};


  const addMember = async (e) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;

    try {
      await axios.post(`${API_URL}/groups/${groupId}/members`, { name: newMemberName });
      setNewMemberName('');
      setShowAddMemberModal(false);
      fetchGroupDetails();
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  const addExpense = async (e) => {
  e.preventDefault();

  // Validation
  if (!expenseData.description.trim()) {
    alert('Please enter a description');
    return;
  }

  if (!expenseData.amount || parseFloat(expenseData.amount) <= 0) {
    alert('Please enter a valid amount');
    return;
  }

  if (!expenseData.paid_by) {
    alert('Please select who paid for this expense');
    return;
  }

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

    alert('Expense added successfully!');

  } catch (error) {
    console.error('Error adding expense:', error);
    console.error('Error response:', error.response?.data);
    
    const errorMessage = error.response?.data?.error 
      || error.response?.data?.details 
      || error.message 
      || 'Unknown error occurred';
    
    alert('Failed to add expense: ' + errorMessage);
  }
};


  const settleUp = async (e) => {
  e.preventDefault();
  
  // Validation
  if (!settlementData.paid_by) {
    alert('Please select who paid');
    return;
  }

  if (!settlementData.paid_to) {
    alert('Please select who received the payment');
    return;
  }

  if (!settlementData.amount || parseFloat(settlementData.amount) <= 0) {
    alert('Please enter a valid amount');
    return;
  }

  if (settlementData.paid_by === settlementData.paid_to) {
    alert('Cannot settle with yourself');
    return;
  }

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

    alert('Settlement recorded successfully!');
  } catch (error) {
    console.error('Error settling up:', error);
    console.error('Error response:', error.response?.data);
    
    const errorMessage = error.response?.data?.error 
      || error.response?.data?.details 
      || error.message 
      || 'Unknown error occurred';
    
    alert('Failed to record settlement: ' + errorMessage);
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

  if (!group) {
    return <div className="text-center py-10">Loading...</div>;
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
                      <span className="text-green-600 font-medium">₹{expense.amount}</span>
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
          <h2 className="text-xl font-semibold mb-4">Balances</h2>
          {members.map(member => {
            const balance = balances[member.id] || { paid: 0, getsBack: 0, owes: [] };
            return (
              <div key={member.id} className="mb-4 border-b pb-2">
                <h3 className="font-medium">{member.name}</h3>
                <p>Paid: ₹{balance.paid.toFixed(2)}</p>
                {balance.getsBack > 0 && <p>Gets Back: ₹{balance.getsBack.toFixed(2)}</p>}
                {balance.owes.length > 0 && (
                  <ul className="ml-4 mt-2 space-y-1">
                    {balance.owes.map((o, i) => {
                      const toMember = members.find(m => m.id === o.to);
                      return (
                        <li key={i} className="flex justify-between">
                          <span>Owes {toMember?.name || 'Unknown'} for {o.description}</span>
                          <span>₹{o.amount.toFixed(2)}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>


      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Member</h2>
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
                  onClick={() => setShowAddMemberModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Add
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

              {/* Amount Input */}
              <div className="mb-4">
                <label htmlFor="amount" className="block text-gray-700 mb-2">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  id="amount"
                  value={expenseData.amount}
                  onChange={(e) => setExpenseData({...expenseData, amount: e.target.value})}
                  className="form-input w-full"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  required
                />
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
                {expenseData.participants.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Split between {expenseData.participants.length} member(s): 
                    ₹{(parseFloat(expenseData.amount || 0) / expenseData.participants.length).toFixed(2)} each
                  </p>
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
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Add Expense
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
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Record Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default GroupDetailPage;
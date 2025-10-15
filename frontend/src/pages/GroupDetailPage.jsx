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

  try {
    // Combine OCR items into description string
    const description = ocrItems.map(item => `${item.description} (${item.amount})`).join(', ');

    await axios.post(`${API_URL}/groups/${groupId}/expenses`, {
      ...expenseData,
      description
    });

    // Reset states
    setExpenseData({ description: '', amount: '', paid_by: '', participants: [] });
    setOcrItems([]);
    setShowAddExpenseModal(false);

    fetchGroupDetails();
    fetchBalances();
  } catch (error) {
    console.error('Error adding expense:', error);
  }
};


  const settleUp = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(`${API_URL}/groups/${groupId}/settlements`, settlementData);
      setSettlementData({
        paid_by: '',
        paid_to: '',
        amount: ''
      });
      setShowSettleModal(false);
      // Refresh both balances and group details
      fetchBalances();
      fetchGroupDetails();
    } catch (error) {
      console.error('Error settling up:', error);
    }
  };

  const handleBillUpload = async (file) => {
  if (!file) return;

  const formData = new FormData();
  formData.append('bill', file);

  try {
    const response = await axios.post(`${API_URL}/ocr/bill`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    // Show preview of items for confirmation
    setOcrItems(response.data.items || []);

    // Autofill total amount
    setExpenseData({
      ...expenseData,
      amount: response.data.totalAmount || 0
    });

  } catch (error) {
    console.error('Error processing OCR:', error);
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

      {/* Add Expense Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Expense</h2>
            <form onSubmit={addExpense}>
              <div className="mb-4">
                <label htmlFor="billUpload" className="block text-gray-700 mb-2">
                  Upload Bill (optional)
                </label>
                <input
                  type="file"
                  id="billUpload"
                  accept="image/*"
                  onChange={(e) => handleBillUpload(e.target.files[0])}
                  className="form-input"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="description" className="block text-gray-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  id="description"
                  value={expenseData.description}
                  onChange={(e) => setExpenseData({...expenseData, description: e.target.value})}
                  className="form-input"
                  placeholder="What was this expense for?"
                  required
                />
              </div>

              <div className="mb-4">
                <label htmlFor="amount" className="block text-gray-700 mb-2">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  id="amount"
                  value={expenseData.amount}
                  onChange={(e) => setExpenseData({...expenseData, amount: e.target.value})}
                  className="form-input"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="paidBy" className="block text-gray-700 mb-2">
                  Paid By
                </label>
                <select
                  id="paidBy"
                  value={expenseData.paid_by}
                  onChange={(e) => setExpenseData({...expenseData, paid_by: e.target.value})}
                  className="form-input"
                  required
                >
                  <option value="">Select a member</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2">
                  Split Between
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`participant-${member.id}`}
                        checked={expenseData.participants.includes(member.id)}
                        onChange={() => handleExpenseParticipantChange(member.id)}
                        className="mr-2"
                      />
                      <label htmlFor={`participant-${member.id}`}>{member.name}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
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

      {/* Settle Up Modal */}
      {showSettleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Settle Up</h2>
            {balances.length === 0 ? (
              <div>
                <p className="text-gray-700 mb-4">No balances to settle up.</p>
                <button
                  type="button"
                  onClick={() => setShowSettleModal(false)}
                  className="btn btn-secondary w-full"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={settleUp}>
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Select a balance to settle:</p>
                  <div className="space-y-2 mb-4 border p-3 rounded max-h-40 overflow-y-auto">
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
                    })
                    }
                  </div>
                </div>
                
                <div className="mb-4">
                  <label htmlFor="paidBy" className="block text-gray-700 mb-2">
                    Paid By
                  </label>
                  <select
                    id="paidBy"
                    value={settlementData.paid_by}
                    onChange={(e) => setSettlementData({...settlementData, paid_by: e.target.value})}
                    className="form-input"
                    required
                  >
                    <option value="">Select a member</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label htmlFor="paidTo" className="block text-gray-700 mb-2">
                    Paid To
                  </label>
                  <select
                    id="paidTo"
                    value={settlementData.paid_to}
                    onChange={(e) => setSettlementData({...settlementData, paid_to: e.target.value})}
                    className="form-input"
                    required
                  >
                    <option value="">Select a member</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label htmlFor="amount" className="block text-gray-700 mb-2">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    id="amount"
                    value={settlementData.amount}
                    onChange={(e) => setSettlementData({...settlementData, amount: e.target.value})}
                    className="form-input"
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowSettleModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Settle
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {ocrItems.length > 0 && (
  <div className="mb-4">
    <h3 className="font-semibold mb-2">Preview Extracted Items</h3>
    <div className="border p-2 rounded max-h-40 overflow-y-auto">
      {ocrItems.map((item, index) => (
        <div key={index} className="flex justify-between mb-1">
          <input
            type="text"
            value={item.description}
            onChange={(e) => {
              const updatedItems = [...ocrItems];
              updatedItems[index].description = e.target.value;
              setOcrItems(updatedItems);
            }}
            className="form-input w-2/3"
          />
          <input
            type="number"
            value={item.amount}
            min="0.01"
            step="0.01"
            onChange={(e) => {
              const updatedItems = [...ocrItems];
              updatedItems[index].amount = parseFloat(e.target.value);
              setOcrItems(updatedItems);
              setExpenseData({...expenseData, amount: updatedItems.reduce((sum, i) => sum + i.amount, 0)});
            }}
            className="form-input w-1/3 ml-2"
          />
        </div>
      ))}
    </div>
  </div>
)}

    </div>
  );
}

export default GroupDetailPage;
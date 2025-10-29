import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

const TransactionHistory = ({ groupId, onClose }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    fetchTransactions();
  }, [groupId, page]);

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${API_URL}/groups/${groupId}/transactions?page=${page}&limit=20`
      );
      
      console.log('Transaction history response:', response.data);
      
      if (response.data.success) {
        setTransactions(response.data.data.transactions || []);
        setPagination(response.data.data.pagination);
      } else {
        setError('Failed to load transaction history');
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800'
    };
    
    const icons = {
      completed: '✅',
      pending: '⏳',
      failed: '❌'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {icons[status]} {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center bg-gradient-to-r from-purple-50 to-pink-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
            <p className="text-sm text-gray-600 mt-1">All payment transactions for this group</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
              <span className="ml-3 text-lg">Loading transactions...</span>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <div className="text-red-500 text-lg mb-4">{error}</div>
              <button 
                onClick={fetchTransactions}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Retry
              </button>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">💸</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Transactions Yet</h3>
              <p className="text-gray-500">Payment transactions will appear here once completed</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((transaction) => (
                <div 
                  key={transaction.id} 
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">💳</span>
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900">
                            {transaction.payer_name} → {transaction.receiver_name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {transaction.description || 'Payment transaction'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600 mb-1">
                        ₹{parseFloat(transaction.amount).toFixed(2)}
                      </div>
                      {getStatusBadge(transaction.payment_status)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t text-sm">
                    <div>
                      <span className="text-gray-500 block">Method</span>
                      <span className="font-medium text-gray-900 uppercase">
                        {transaction.payment_method}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Gateway</span>
                      <span className="font-medium text-gray-900">
                        {transaction.payment_gateway || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Transaction ID</span>
                      <span className="font-mono text-xs text-gray-700 break-all">
                        {transaction.transaction_id}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Date</span>
                      <span className="font-medium text-gray-900">
                        {new Date(transaction.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  {transaction.payer_upi && transaction.receiver_upi && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-gray-500 block mb-1">From UPI</span>
                          <code className="bg-gray-100 px-2 py-1 rounded text-gray-700">
                            {transaction.payer_upi}
                          </code>
                        </div>
                        <div>
                          <span className="text-gray-500 block mb-1">To UPI</span>
                          <code className="bg-gray-100 px-2 py-1 rounded text-gray-700">
                            {transaction.receiver_upi}
                          </code>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages} • {pagination.total} total transactions
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={pagination.page === 1}
                className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionHistory;
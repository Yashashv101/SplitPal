import React, { useState } from 'react';
import axios from 'axios';

const PayNowButton = ({ 
  settlement, 
  groupId, 
  onPaymentSuccess, 
  onPaymentError,
  disabled = false,
  className = ''
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePayNow = async () => {
    if (!settlement || !groupId) {
      setError('Invalid payment details');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create payment order
      const orderResponse = await axios.post('http://localhost:5001/api/payments/create-order', {
        amount: settlement.amount,
        currency: settlement.currency || 'INR',
        settlementId: settlement.id,
        groupId: groupId,
        payerId: settlement.payer_id,
        receiverId: settlement.receiver_id
      });

      if (!orderResponse.data.success) {
        throw new Error(orderResponse.data.message || 'Failed to create payment order');
      }

      const { orderId, amount, currency } = orderResponse.data.data;

      // For now, simulate payment gateway integration
      // In production, this would integrate with actual Razorpay
      const mockPaymentResult = await simulatePaymentGateway({
        orderId,
        amount,
        currency,
        settlementId: settlement.id
      });

      if (mockPaymentResult.success) {
        // Verify payment
        const verifyResponse = await axios.post('http://localhost:5001/api/payments/verify', {
          orderId: orderId,
          paymentId: mockPaymentResult.paymentId,
          signature: mockPaymentResult.signature,
          settlementId: settlement.id
        });

        if (verifyResponse.data.success) {
          if (onPaymentSuccess) {
            onPaymentSuccess({
              settlementId: settlement.id,
              paymentId: mockPaymentResult.paymentId,
              amount: amount,
              currency: currency
            });
          }
        } else {
          throw new Error('Payment verification failed');
        }
      } else {
        throw new Error(mockPaymentResult.error || 'Payment failed');
      }
    } catch (error) {
      console.error('Payment error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Payment failed';
      setError(errorMessage);
      if (onPaymentError) {
        onPaymentError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Mock payment gateway simulation
  const simulatePaymentGateway = async ({ orderId, amount, currency, settlementId }) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate 90% success rate
        const success = Math.random() > 0.1;
        
        if (success) {
          resolve({
            success: true,
            paymentId: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            signature: `sig_${Math.random().toString(36).substr(2, 16)}`,
            orderId,
            amount,
            currency
          });
        } else {
          resolve({
            success: false,
            error: 'Payment declined by bank'
          });
        }
      }, 2000); // Simulate 2 second processing time
    });
  };

  const formatAmount = (amount, currency = 'INR') => {
    const currencySymbols = {
      'INR': '₹',
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'CAD': 'C$',
      'AUD': 'A$',
      'CHF': 'CHF',
      'CNY': '¥',
      'SGD': 'S$'
    };

    const symbol = currencySymbols[currency] || currency;
    const decimals = currency === 'JPY' ? 0 : 2;
    
    return `${symbol}${parseFloat(amount).toFixed(decimals)}`;
  };

  if (!settlement || settlement.amount <= 0) {
    return null;
  }

  return (
    <div className={`pay-now-button ${className}`}>
      <button
        onClick={handlePayNow}
        disabled={disabled || loading}
        className={`
          inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md
          ${loading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
          }
          text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors duration-200
        `}
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Processing...
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
            Pay {formatAmount(settlement.amount, settlement.currency)}
          </>
        )}
      </button>
      
      {error && (
        <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        </div>
      )}
      
      {loading && (
        <div className="mt-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-md p-2">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Connecting to payment gateway...
          </div>
        </div>
      )}
    </div>
  );
};

export default PayNowButton;
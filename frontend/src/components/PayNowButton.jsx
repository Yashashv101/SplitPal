import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

const PayNowButton = ({ settlement, onPaymentSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(settlement.payment_status || 'pending');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [upiDeepLink, setUpiDeepLink] = useState('');

  const generateUPIDeepLink = () => {
    if (!settlement.receiver_upi) {
      throw new Error('Receiver UPI ID not found');
    }

    const receiverUpi = settlement.receiver_upi;
    const receiverName = encodeURIComponent(settlement.receiver_name);
    const amount = settlement.amount.toFixed(2);
    const transactionNote = encodeURIComponent(
      `SplitPal Settlement - ${settlement.payer_name} to ${settlement.receiver_name}`
    );

    return `upi://pay?pa=${receiverUpi}&pn=${receiverName}&am=${amount}&cu=INR&tn=${transactionNote}`;
  };

  const handlePayNow = () => {
    try {
      console.log('PayNow clicked - Settlement data:', settlement);
      console.log('Receiver UPI ID:', settlement.receiver_upi);
      console.log('Receiver Name:', settlement.receiver_name);
      console.log('Amount:', settlement.amount);
      
      if (!settlement.receiver_upi) {
        console.error('Missing receiver_upi in settlement object!');
        console.log('Full settlement object:', JSON.stringify(settlement, null, 2));
        alert('Receiver has not set up UPI ID. Please ask them to add their UPI ID first.');
        return;
      }

      const deepLink = generateUPIDeepLink();
      console.log('Generated UPI deep link:', deepLink);
      setUpiDeepLink(deepLink);
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Error generating UPI link:', error);
      alert(error.message || 'Failed to generate payment link');
    }
  };

  const handlePaymentConfirmation = async (confirmed) => {
    if (confirmed) {
      try {
        setLoading(true);

        console.log('Confirming payment with data:', {
          settlementId: settlement.id,
          groupId: settlement.group_id,
          payerId: settlement.payer_id,
          receiverId: settlement.receiver_id,
          amount: settlement.amount,
          description: settlement.description
        });

        const response = await fetch('http://localhost:5001/api/payments/confirm-upi', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            settlementId: settlement.id,
            groupId: settlement.group_id,
            payerId: settlement.payer_id,
            receiverId: settlement.receiver_id,
            amount: settlement.amount,
            description: settlement.description,
            paymentMethod: 'upi',
            status: 'completed',
          }),
        });

        const data = await response.json();
        console.log('Payment confirmation response:', data);

        if (data.success) {
          setStatus('completed');
          alert('Payment confirmed successfully!');

          if (onPaymentSuccess) {
            onPaymentSuccess({
              settlementId: settlement.id,
              transactionId: data.data?.transactionId,
              status: 'completed'
            });
          }
        } else {
          throw new Error(data.message || 'Failed to confirm payment');
        }
      } catch (error) {
        console.error('Error confirming payment:', error);
        alert('Failed to confirm payment: ' + error.message);
      } finally {
        setLoading(false);
        setShowPaymentModal(false);
      }
    } else {
      setShowPaymentModal(false);
    }
  };

  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';

  return (
    <>
      <button
        onClick={handlePayNow}
        disabled={loading || isCompleted}
        className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium
          transition-all duration-200 ease-in-out
          ${isCompleted
            ? 'bg-green-100 text-green-700 cursor-not-allowed'
            : isFailed
            ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
            : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 active:scale-95 shadow-md'
          }
          ${loading ? 'opacity-75 cursor-wait' : ''}
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        {loading ? (
          <>
            <span className="animate-spin">⏳</span>
            <span>Processing...</span>
          </>
        ) : isCompleted ? (
          <>
            <span>✅</span>
            <span>Paid</span>
          </>
        ) : (
          <>
            <span>📱</span>
            <span>{isFailed ? 'Retry Payment' : 'Pay with UPI'}</span>
          </>
        )}
      </button>

      {showPaymentModal && !isCompleted && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 relative shadow-2xl">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              ❌
            </button>

            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg text-white text-4xl">
                🧾
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Scan QR Code to Pay
              </h3>
              <p className="text-gray-600">
                Open any UPI app and scan this QR code to complete payment
              </p>
            </div>

            <div className="flex justify-center mb-6">
              <div className="bg-white p-6 rounded-xl border-4 border-purple-200 shadow-lg">
                <QRCodeCanvas 
                  value={upiDeepLink} 
                  size={240} 
                  level="H" 
                  includeMargin={true}
                  imageSettings={{
                    excavate: true,
                  }}
                />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-purple-200 rounded-xl p-5 mb-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-600">Amount</span>
                <span className="text-2xl font-bold text-gray-900">₹{settlement.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-600">Paying to</span>
                <span className="font-semibold text-gray-900">{settlement.receiver_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">UPI ID</span>
                <span className="text-sm font-mono text-purple-700">{settlement.receiver_upi}</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-xs font-medium text-gray-600 mb-3 text-center">Scan with any UPI app</p>
              <div className="flex justify-center gap-4 flex-wrap text-xs font-medium text-gray-700">
                <span className="bg-white px-3 py-1.5 rounded-full border border-gray-200">Google Pay</span>
                <span className="bg-white px-3 py-1.5 rounded-full border border-gray-200">PhonePe</span>
                <span className="bg-white px-3 py-1.5 rounded-full border border-gray-200">Paytm</span>
                <span className="bg-white px-3 py-1.5 rounded-full border border-gray-200">BHIM</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 flex gap-3">
              <span className="text-amber-600 text-lg mt-0.5">💡</span>
              <p className="text-sm text-amber-800">
                After completing the payment in your UPI app, return here and click "Payment Completed" below.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handlePaymentConfirmation(true)}
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white py-3.5 rounded-lg font-semibold hover:from-green-700 hover:to-green-600 disabled:opacity-50 flex items-center justify-center gap-2 shadow-md transition-all"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Confirming...
                  </>
                ) : (
                  <>
                    ✅ Payment Completed
                  </>
                )}
              </button>

              <button
                onClick={() => handlePaymentConfirmation(false)}
                disabled={loading}
                className="w-full bg-gray-100 text-gray-700 py-3.5 rounded-lg font-semibold hover:bg-gray-200 disabled:opacity-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PayNowButton;
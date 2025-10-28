import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CurrencyConverter = ({ 
  amount, 
  fromCurrency, 
  toCurrency, 
  showDetails = false,
  className = ''
}) => {
  const [convertedAmount, setConvertedAmount] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (amount && fromCurrency && toCurrency && fromCurrency !== toCurrency) {
      convertAmount();
    } else if (fromCurrency === toCurrency) {
      setConvertedAmount(amount);
      setExchangeRate(1);
      setError('');
    }
  }, [amount, fromCurrency, toCurrency]);

  const convertAmount = async () => {
    if (!amount || amount <= 0) {
      setConvertedAmount(null);
      setExchangeRate(null);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:5001/api/currencies/convert', {
        amount: parseFloat(amount),
        fromCurrency,
        toCurrency
      });

      if (response.data.success) {
        const { convertedAmount: converted, exchangeRate: rate } = response.data.data;
        setConvertedAmount(converted);
        setExchangeRate(rate);
      } else {
        setError('Conversion failed');
      }
    } catch (error) {
      console.error('Error converting currency:', error);
      setError('Failed to convert currency');
      // Fallback to original amount
      setConvertedAmount(amount);
      setExchangeRate(1);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (value, currency) => {
    if (value === null || value === undefined) return '';
    
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
    
    return `${symbol}${parseFloat(value).toFixed(decimals)}`;
  };

  if (!amount || amount <= 0) {
    return null;
  }

  if (fromCurrency === toCurrency) {
    return (
      <div className={`currency-converter ${className}`}>
        <span className="text-gray-600">
          {formatAmount(amount, fromCurrency)}
        </span>
      </div>
    );
  }

  return (
    <div className={`currency-converter ${className}`}>
      <div className="flex items-center space-x-2">
        {loading ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-500">Converting...</span>
          </div>
        ) : error ? (
          <span className="text-sm text-red-600">{error}</span>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <span className="text-gray-600">
                {formatAmount(amount, fromCurrency)}
              </span>
              <span className="text-gray-400">→</span>
              <span className="font-medium text-gray-800">
                {formatAmount(convertedAmount, toCurrency)}
              </span>
            </div>
            
            {showDetails && exchangeRate && (
              <div className="text-xs text-gray-500 mt-1">
                Rate: 1 {fromCurrency} = {parseFloat(exchangeRate).toFixed(4)} {toCurrency}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CurrencyConverter;
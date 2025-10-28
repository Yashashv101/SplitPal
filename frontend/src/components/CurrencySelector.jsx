import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CurrencySelector = ({ 
  selectedCurrency = 'INR', 
  onCurrencyChange, 
  disabled = false,
  showRates = false,
  baseCurrency = 'INR',
  className = ''
}) => {
  const [currencies, setCurrencies] = useState({});
  const [exchangeRates, setExchangeRates] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCurrencies();
    if (showRates) {
      fetchExchangeRates();
    }
  }, [baseCurrency, showRates]);

  const fetchCurrencies = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/currencies');
      if (response.data.success) {
        setCurrencies(response.data.currencies);
      }
    } catch (error) {
      console.error('Error fetching currencies:', error);
      setError('Failed to load currencies');
      // Fallback currencies
      setCurrencies({
        'INR': { name: 'Indian Rupee', symbol: '₹', decimals: 2 },
        'USD': { name: 'US Dollar', symbol: '$', decimals: 2 },
        'EUR': { name: 'Euro', symbol: '€', decimals: 2 },
        'GBP': { name: 'British Pound', symbol: '£', decimals: 2 }
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchExchangeRates = async () => {
    try {
      const response = await axios.get(`http://localhost:5001/api/currencies/${baseCurrency}/rates`);
      if (response.data.success) {
        setExchangeRates(response.data.data.rates);
      }
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
    }
  };

  const handleCurrencyChange = (event) => {
    const newCurrency = event.target.value;
    if (onCurrencyChange) {
      onCurrencyChange(newCurrency);
    }
  };

  const formatRate = (rate) => {
    if (!rate) return '';
    return parseFloat(rate).toFixed(4);
  };

  if (loading) {
    return (
      <div className={`currency-selector ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-500">Loading currencies...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`currency-selector ${className}`}>
      <div className="flex flex-col space-y-2">
        <select
          value={selectedCurrency}
          onChange={handleCurrencyChange}
          disabled={disabled}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          {Object.entries(currencies).map(([code, info]) => (
            <option key={code} value={code}>
              {code} - {info.name} ({info.symbol})
            </option>
          ))}
        </select>
        
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        
        {showRates && exchangeRates && Object.keys(exchangeRates).length > 0 && (
          <div className="mt-2 p-2 bg-gray-50 rounded-md">
            <p className="text-xs font-medium text-gray-700 mb-1">
              Exchange Rates (1 {baseCurrency} =)
            </p>
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
              {Object.entries(exchangeRates)
                .filter(([code]) => code !== baseCurrency)
                .slice(0, 6)
                .map(([code, rate]) => (
                  <div key={code} className="flex justify-between">
                    <span>{code}:</span>
                    <span>{formatRate(rate)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CurrencySelector;
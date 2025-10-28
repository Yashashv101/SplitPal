const axios = require('axios');

class CurrencyService {
  constructor() {
    this.exchangeRates = new Map();
    this.lastUpdated = new Map();
    this.updateInterval = 3600000; // 1 hour in milliseconds
    this.apiKey = process.env.EXCHANGE_RATE_API_KEY || null;
    this.baseUrl = 'https://api.exchangerate-api.com/v4/latest/';
    
    // Supported currencies with their symbols and decimal places
    this.supportedCurrencies = {
      'INR': { name: 'Indian Rupee', symbol: '₹', decimals: 2 },
      'USD': { name: 'US Dollar', symbol: '$', decimals: 2 },
      'EUR': { name: 'Euro', symbol: '€', decimals: 2 },
      'GBP': { name: 'British Pound', symbol: '£', decimals: 2 },
      'JPY': { name: 'Japanese Yen', symbol: '¥', decimals: 0 },
      'CAD': { name: 'Canadian Dollar', symbol: 'C$', decimals: 2 },
      'AUD': { name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
      'CHF': { name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
      'CNY': { name: 'Chinese Yuan', symbol: '¥', decimals: 2 },
      'SGD': { name: 'Singapore Dollar', symbol: 'S$', decimals: 2 }
    };

    // Initialize with default rates (fallback)
    this.initializeDefaultRates();
  }

  initializeDefaultRates() {
    // Default exchange rates relative to INR (fallback values)
    const defaultRates = {
      'INR': { 'USD': 0.012, 'EUR': 0.011, 'GBP': 0.0095, 'JPY': 1.8, 'CAD': 0.016, 'AUD': 0.018, 'CHF': 0.011, 'CNY': 0.086, 'SGD': 0.016 },
      'USD': { 'INR': 83.5, 'EUR': 0.92, 'GBP': 0.79, 'JPY': 150, 'CAD': 1.35, 'AUD': 1.52, 'CHF': 0.91, 'CNY': 7.2, 'SGD': 1.34 },
      'EUR': { 'INR': 90.8, 'USD': 1.09, 'GBP': 0.86, 'JPY': 163, 'CAD': 1.47, 'AUD': 1.65, 'CHF': 0.99, 'CNY': 7.84, 'SGD': 1.46 }
    };

    for (const [from, rates] of Object.entries(defaultRates)) {
      this.exchangeRates.set(from, rates);
      this.lastUpdated.set(from, new Date());
    }
  }

  async getExchangeRate(fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return 1;

    try {
      // Check if we have recent data
      const lastUpdate = this.lastUpdated.get(fromCurrency);
      const now = new Date();
      
      if (!lastUpdate || (now - lastUpdate) > this.updateInterval) {
        await this.updateExchangeRates(fromCurrency);
      }

      const rates = this.exchangeRates.get(fromCurrency);
      if (rates && rates[toCurrency]) {
        return rates[toCurrency];
      }

      // If direct rate not available, try reverse calculation
      const reverseRates = this.exchangeRates.get(toCurrency);
      if (reverseRates && reverseRates[fromCurrency]) {
        return 1 / reverseRates[fromCurrency];
      }

      // Fallback to default rate or 1
      return 1;
    } catch (error) {
      console.error(`Error getting exchange rate from ${fromCurrency} to ${toCurrency}:`, error);
      return 1;
    }
  }

  async updateExchangeRates(baseCurrency = 'INR') {
    try {
      const response = await axios.get(`${this.baseUrl}${baseCurrency}`, {
        timeout: 5000
      });

      if (response.data && response.data.rates) {
        this.exchangeRates.set(baseCurrency, response.data.rates);
        this.lastUpdated.set(baseCurrency, new Date());
        console.log(`Updated exchange rates for ${baseCurrency}`);
      }
    } catch (error) {
      console.error(`Failed to update exchange rates for ${baseCurrency}:`, error.message);
      // Keep using cached/default rates
    }
  }

  convertAmount(amount, fromCurrency, toCurrency, exchangeRate = null) {
    if (fromCurrency === toCurrency) {
      return {
        convertedAmount: amount,
        exchangeRate: 1,
        fromCurrency,
        toCurrency
      };
    }

    const rate = exchangeRate || 1;
    const convertedAmount = amount * rate;
    const decimals = this.supportedCurrencies[toCurrency]?.decimals || 2;
    
    return {
      convertedAmount: parseFloat(convertedAmount.toFixed(decimals)),
      exchangeRate: rate,
      fromCurrency,
      toCurrency,
      originalAmount: amount
    };
  }

  async convertAmountWithLiveRate(amount, fromCurrency, toCurrency) {
    const exchangeRate = await this.getExchangeRate(fromCurrency, toCurrency);
    return this.convertAmount(amount, fromCurrency, toCurrency, exchangeRate);
  }

  getSupportedCurrencies() {
    return this.supportedCurrencies;
  }

  getCurrencyInfo(currencyCode) {
    return this.supportedCurrencies[currencyCode] || null;
  }

  formatAmount(amount, currencyCode) {
    const currencyInfo = this.getCurrencyInfo(currencyCode);
    if (!currencyInfo) return `${amount}`;

    const decimals = currencyInfo.decimals;
    const formattedAmount = parseFloat(amount).toFixed(decimals);
    return `${currencyInfo.symbol}${formattedAmount}`;
  }

  // Batch convert multiple amounts
  async batchConvert(conversions) {
    const results = [];
    
    for (const conversion of conversions) {
      const { amount, fromCurrency, toCurrency, id } = conversion;
      const result = await this.convertAmountWithLiveRate(amount, fromCurrency, toCurrency);
      results.push({ ...result, id });
    }
    
    return results;
  }

  // Get all rates for a base currency
  async getAllRatesFor(baseCurrency) {
    await this.updateExchangeRates(baseCurrency);
    const rates = this.exchangeRates.get(baseCurrency) || {};
    
    return {
      baseCurrency,
      rates,
      lastUpdated: this.lastUpdated.get(baseCurrency),
      supportedCurrencies: this.supportedCurrencies
    };
  }

  // Calculate total in a specific currency from mixed currency amounts
  async calculateTotal(amounts, targetCurrency) {
    let total = 0;
    const conversions = [];

    for (const item of amounts) {
      const { amount, currency } = item;
      if (currency === targetCurrency) {
        total += amount;
        conversions.push({
          originalAmount: amount,
          convertedAmount: amount,
          currency: currency,
          exchangeRate: 1
        });
      } else {
        const conversion = await this.convertAmountWithLiveRate(amount, currency, targetCurrency);
        total += conversion.convertedAmount;
        conversions.push({
          originalAmount: amount,
          convertedAmount: conversion.convertedAmount,
          currency: currency,
          exchangeRate: conversion.exchangeRate
        });
      }
    }

    return {
      total: parseFloat(total.toFixed(this.supportedCurrencies[targetCurrency]?.decimals || 2)),
      targetCurrency,
      conversions
    };
  }
}

module.exports = new CurrencyService();
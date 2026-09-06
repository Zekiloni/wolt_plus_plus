# Wolt++

A Chrome browser extension that calculates the total sum of your Wolt delivery orders, with per-restaurant statistics. The extension automatically fetches your order history from Wolt and allows you to filter and calculate totals by year, month and restaurant.

## Features

### Order History Analysis
- Automatically fetches up to 20,000 orders from your Wolt account
- Calculates the total sum of all your orders
- Handles multiple currencies automatically (€, RSD, $, etc.)
- Properly formats currency amounts with appropriate decimal separators

### Filtering Capabilities
- Filter orders by year
- Filter orders by month
- Filter orders by restaurant
- Automatic detection of available years, months and restaurants from your order history
- Current year and month are selected by default on first load

### Statistics & Restaurant Breakdown
- Spending breakdown grouped by restaurant, sorted by total spent
- Total order count, average order value and unique restaurant count
- Top restaurant detection
- Click any restaurant in the list to filter by it

### User Interface
- Clean, intuitive interface matching Wolt's design language
- Dark mode support (follows system preference)
- Displays the number of orders found with the current filter
- Shows order sums for each currency on separate lines
- Highlighted sum display for better visibility

### Internationalization
- Supports English, German, Spanish and Serbian
- Automatically detects browser language
- Displays month names and all UI text in the appropriate language

### Offline Support
- Stores last 1,000 orders in local storage for offline access
- Caches calculation results for offline viewing
- Remembers last selected filters
- Clear indication when operating in offline mode

### Robust Error Handling
- Graceful handling of network errors with retry mechanisms
- Clear error messages for authentication issues
- Handling of rate limiting from the Wolt API
- Detection of browser online/offline status

### Technical Features
- Direct integration with Wolt's API
- Secure authentication token handling
- Automatic login detection
- Works only on Wolt.com domains for security
- No data is sent to third-party servers

## How to Use

1. Install the extension from the Chrome Web Store
2. Navigate to [Wolt.com](https://wolt.com) and log in to your account
3. Click on the extension icon in your browser toolbar
4. The extension will automatically fetch your order history
5. Use the year, month and restaurant filters to analyze specific time periods
6. View the total amount spent on Wolt orders in each currency
7. Check statistics and per-restaurant breakdown in the popup

## Requirements
- Google Chrome browser (version 88.0 or higher)
- A Wolt account with order history
- Access to wolt.com

## Privacy

This extension only accesses your Wolt order data when you are logged into Wolt.com. No data is shared with any third parties. All calculations are performed locally in your browser, and optional local storage is only used for offline functionality.

## Technical Details

The extension works by:
1. Detecting when you're logged into Wolt
2. Securely obtaining an authentication token
3. Making API requests to Wolt's order history endpoint
4. Processing and analyzing the returned order data
5. Presenting the results in an easy-to-understand format

The extension handles various currency formats and numeric separators used across different regions, ensuring accurate calculations regardless of the currency used in your orders.

## Screenshots

<p align="center">
  <img src="preview/Screenshot 2026-09-06 231240.png" width="45%" alt="Wolt++ main view">
  <img src="preview/Screenshot 2026-09-06 231301.png" width="45%" alt="Wolt++ statistics view">
</p>

## Support

If you encounter any issues or have questions about the extension, please submit them through the Chrome Web Store support channel or open an issue in the GitHub repository.

## Credits

Developed by [Zekiloni](https://github.com/Zekiloni)
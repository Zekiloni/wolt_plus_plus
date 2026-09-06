// Popup script for Wolt.com Spending Tracker extension

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup DOM loaded');
  
  // Check if the user is online or offline
  const isOnline = navigator.onLine;
  
  /**
   * Month names in German and English
   * Used for displaying month names in the filter dropdown
   */
  const MONTH_NAMES = [
    chrome.i18n.getMessage("january"),
    chrome.i18n.getMessage("february"),
    chrome.i18n.getMessage("march"),
    chrome.i18n.getMessage("april"),
    chrome.i18n.getMessage("may"),
    chrome.i18n.getMessage("june"),
    chrome.i18n.getMessage("july"),
    chrome.i18n.getMessage("august"),
    chrome.i18n.getMessage("september"),
    chrome.i18n.getMessage("october"),
    chrome.i18n.getMessage("november"),
    chrome.i18n.getMessage("december")
  ];
  
  /**
   * Constants for localStorage keys
   * Used to store and retrieve cached data for offline use
   */
  const STORAGE_KEYS = {
    ORDERS: 'wolt_extension_orders',
    LAST_FETCH: 'wolt_extension_last_fetch',
    LAST_SUM: 'wolt_extension_last_sum',
    LAST_FILTER: 'wolt_extension_last_filter'
  };
  
  /**
   * Gets a translated string using Chrome i18n API
   * 
   * @param {string} key - The translation key to look up
   * @param {...any} params - Parameters to substitute in the translation string
   * @returns {string} The translated string with parameters substituted
   */
  function t(key, ...params) {
    return chrome.i18n.getMessage(key, params);
  }
  
  // Get DOM elements for manipulation
  const statusElement = document.getElementById('status');
  const notLoggedInElement = document.getElementById('not-logged-in');
  const loggedInElement = document.getElementById('logged-in');
  const sumDisplayElement = document.getElementById('sum-display');
  const calculateButton = document.getElementById('calculate-btn');
  const yearFilterSelect = document.getElementById('year-filter');
  const monthFilterSelect = document.getElementById('month-filter');
  const venueFilterSelect = document.getElementById('venue-filter');
  const loadingIndicator = document.getElementById('loading-indicator');
  const pageNotReadyElement = document.getElementById('page-not-ready');
  const reloadButton = document.getElementById('reload-btn');
  const statsContainer = document.getElementById('stats-container');
  const venueBreakdownContainer = document.getElementById('venue-breakdown');
  const venueListElement = document.getElementById('venue-list');
  
  // Add reload button event listener
  reloadButton.addEventListener('click', function() {
    window.location.reload();
  });
  
  // Store all orders for filtering
  let allOrdersCache = [];
  
  // Current date for limiting future months
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // 1-12
  
  /**
   * Updates UI elements with translations
   * Called once during initialization
   */
  function updateUITranslations() {
    // Update static elements
    document.querySelector('.filter-title').textContent = t('filterPeriod');
    document.querySelector('label[for="year-filter"]').textContent = t('year');
    document.querySelector('label[for="month-filter"]').textContent = t('month');
    document.querySelector('label[for="venue-filter"]').textContent = t('venue');
    document.getElementById('stats-title').textContent = t('statistics');
    document.getElementById('stat-label-orders').textContent = t('statOrders');
    document.getElementById('stat-label-avg').textContent = t('statAvg');
    document.getElementById('stat-label-venues').textContent = t('statVenues');
    document.getElementById('stat-label-top').textContent = t('statTopVenue');
    document.getElementById('venue-breakdown-title').textContent = t('restaurantBreakdown');
    document.getElementById('sum-label').textContent = t('totalSpent');
    document.querySelector('#header .header-sub').textContent = t('tagline');
    document.getElementById('calculate-btn').textContent = t('calculateButton');
    document.getElementById('not-logged-in').textContent = t('pleaseLogin');
    document.getElementById('limit-note').textContent = t('limitNote');
    document.getElementById('loading-text').textContent = t('loadingExtension');
    document.getElementById('reload-btn').textContent = t('reloadButton');
    
    // Update page not ready message
    const pageNotReadyMessage = pageNotReadyElement.querySelector('p');
    if (pageNotReadyMessage) {
      pageNotReadyMessage.textContent = t('pageNotReady');
    }
    
    // Update document title and header
    document.title = t('extensionName');
    document.querySelector('#header h1').textContent = t('extensionName');
    
    // Update select option for "All years", "All months" and "All restaurants"
    yearFilterSelect.options[0].text = t('allYears');
    monthFilterSelect.options[0].text = t('allMonths');
    venueFilterSelect.options[0].text = t('allVenues');
  }
  
  // Apply translations and initialize defaults
  updateUITranslations();
  
  // Initially hide status element - will be shown only when needed
  statusElement.style.display = 'none';
  
  /**
   * Check if the current tab is on wolt.com and if the user is logged in
   * Updates UI based on login status
   */
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    
    // First check if we're on wolt.com
    if (!activeTab.url || !activeTab.url.includes('wolt.com')) {
      loadingIndicator.style.display = 'none';
      statusElement.style.display = 'block';
      statusElement.textContent = t('onlyWolt');
      return;
    }
    
    // Then check login status
    chrome.tabs.sendMessage(activeTab.id, { action: 'checkLogin' }, (response) => {
      // Check for communication errors
      if (chrome.runtime.lastError) {
        loadingIndicator.style.display = 'none';
        console.error('Communication error:', chrome.runtime.lastError);
        
        // Show the "page not ready" message instead of general communication error
        // This is likely because the content script hasn't been fully loaded yet
        pageNotReadyElement.style.display = 'block';
        
        // Hide other elements
        statusElement.style.display = 'none';
        notLoggedInElement.style.display = 'none';
        
        return;
      }
      
      console.log('Login check response:', response);
      
      if (response && response.loggedIn) {
        // User is logged in
        showLoggedIn();
        statusElement.style.display = 'none'; // Hide status element on login
      } else {
        // User is not logged in
        showNotLoggedIn();
      }
    });
  });
  
  /**
   * Handle offline mode by loading cached data from localStorage
   * Shows last results if available
   */
  if (!isOnline) {
    try {
      const savedOrders = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
      const lastFilter = JSON.parse(localStorage.getItem(STORAGE_KEYS.LAST_FILTER) || '{"year":"all","month":"all","venue":"all"}');
      
      if (savedOrders.length > 0) {
        // Hide loading indicator since we're displaying cached data
        loadingIndicator.style.display = 'none';
        
        statusElement.style.display = 'block';
        statusElement.textContent = t('offline');
        
        // Show logged-in UI for cached data
        showLoggedIn();
        
        // Load cached data
        allOrdersCache = savedOrders;
        
        // Show filter container
        const filterContainer = document.getElementById('filter-container');
        filterContainer.style.display = 'block';
        
        // Set up event handlers
        setupFilterEventHandlers();
        
        // Load year, month and venue filters
        populateFilters(savedOrders, lastFilter.year, lastFilter.month, lastFilter.venue);
        
        // Recalculate sum and statistics from cached data
        calculateTotalSum(filterOrders(savedOrders));
        
        // Keep the offline status message visible
        statusElement.textContent = t('offline');
      }
    } catch (error) {
      loadingIndicator.style.display = 'none';
      console.error('Error loading cached data:', error);
      statusElement.style.display = 'block';
      statusElement.textContent = t('initError');
    }
  }
  
  /**
   * Saves data to localStorage for offline use
   * 
   * @param {Array} orders - The orders to save
   * @param {string} sum - The calculated sum text
   * @param {Object} filter - The filter settings (year, month and venue)
   */
  function saveToLocalStorage(orders, sum, filter) {
    try {
      // Save at most 1000 orders for offline mode (to save space)
      const ordersToSave = orders.slice(0, 1000);
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(ordersToSave));
      localStorage.setItem(STORAGE_KEYS.LAST_FETCH, Date.now().toString());
      
      if (sum) {
        localStorage.setItem(STORAGE_KEYS.LAST_SUM, sum);
      }
      
      if (filter) {
        localStorage.setItem(STORAGE_KEYS.LAST_FILTER, JSON.stringify(filter));
      }
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }
  
  /**
   * Handles network errors by showing appropriate messages
   * Attempts to show cached data if available
   * 
   * @param {Error} error - The network error
   */
  function handleNetworkError(error) {
    console.error('Network error:', error);
    statusElement.style.display = 'block';
    statusElement.textContent = t('networkError');
    
    // If saved data exists, show a hint that offline data is displayed
    const savedOrders = JSON.parse(localStorage.getItem(STORAGE_KEYS.ORDERS) || '[]');
    if (savedOrders.length > 0) {
      showError(t('networkError') + ' ' + t('offline'));
    } else {
      showError(t('networkError'));
    }
  }
  
  /**
   * Populates the year, month and venue filter dropdowns based on order data
   * Attempts to preserve previously selected values when possible
   * 
   * @param {Array} orders - The orders to extract years, months and venues from
   * @param {string} selectedYear - Previously selected year
   * @param {string} selectedMonth - Previously selected month
   * @param {string} selectedVenue - Previously selected venue
   */
  function populateFilters(orders, selectedYear = 'all', selectedMonth = 'all', selectedVenue = 'all') {
    // Extract years and venues from orders
    const years = new Set();
    const venues = new Set();
    orders.forEach(order => {
      if (order.payment_time_ts) {
        const orderDate = new Date(order.payment_time_ts);
        years.add(orderDate.getFullYear());
      }
      if (order.venue_name && order.venue_name.trim()) {
        venues.add(order.venue_name.trim());
      }
    });
    
    // Sort years in descending order, venues alphabetically
    const sortedYears = Array.from(years).sort((a, b) => b - a);
    const sortedVenues = Array.from(venues).sort((a, b) => a.localeCompare(b));
    
    // Clear existing options except the first one
    while (yearFilterSelect.options.length > 1) {
      yearFilterSelect.remove(1);
    }
    
    // Add year options
    sortedYears.forEach(year => {
      const option = document.createElement('option');
      option.value = year;
      option.text = year.toString();
      yearFilterSelect.add(option);
    });
    
    // Set the selected value
    if (selectedYear !== 'all' && sortedYears.includes(parseInt(selectedYear))) {
      yearFilterSelect.value = selectedYear;
    } else if (sortedYears.includes(currentYear)) {
      // Set to current year if available
      yearFilterSelect.value = currentYear.toString();
    }
    
    // Update months based on selected year
    updateMonthOptions();
    
    // Set the month
    if (selectedMonth !== 'all') {
      if (Array.from(monthFilterSelect.options).some(option => option.value === selectedMonth)) {
        monthFilterSelect.value = selectedMonth;
      }
    } else if (yearFilterSelect.value === currentYear.toString()) {
      // Set to current month for current year
      monthFilterSelect.value = currentMonth.toString();
    }
    
    // Clear existing venue options except the first one
    while (venueFilterSelect.options.length > 1) {
      venueFilterSelect.remove(1);
    }
    
    // Add venue options
    sortedVenues.forEach(venue => {
      const option = document.createElement('option');
      option.value = venue;
      option.text = venue;
      venueFilterSelect.add(option);
    });
    
    // Set the selected venue
    if (selectedVenue !== 'all' && sortedVenues.includes(selectedVenue)) {
      venueFilterSelect.value = selectedVenue;
    }
  }
  
  /**
   * Sets up event handlers for year, month and venue filters
   * Only activated after data is loaded
   */
  function setupFilterEventHandlers() {
    yearFilterSelect.addEventListener('change', () => {
      // Reset month filter to "All Months" when year changes
      monthFilterSelect.value = 'all';
      
      // Update the available months when year changes
      updateMonthOptions();
      
      if (allOrdersCache.length > 0) {
        calculateTotalSum(filterOrders(allOrdersCache));
      }
    });
    
    monthFilterSelect.addEventListener('change', () => {
      if (allOrdersCache.length > 0) {
        calculateTotalSum(filterOrders(allOrdersCache));
      }
    });
    
    venueFilterSelect.addEventListener('change', () => {
      if (allOrdersCache.length > 0) {
        calculateTotalSum(filterOrders(allOrdersCache));
      }
    });
  }
  
  /**
   * Updates month options based on selected year
   * Limits available months for current year to current month
   */
  function updateMonthOptions() {
    const selectedYear = yearFilterSelect.value;
    const selectedMonth = monthFilterSelect.value;
    
    // Clear all month options except the first one (All Months)
    while (monthFilterSelect.options.length > 1) {
      monthFilterSelect.remove(1);
    }
    
    // Determine how many months to show
    let monthsToShow = 12;
    if (selectedYear === currentYear.toString()) {
      // For current year, only show months up to the current month
      monthsToShow = currentMonth;
    }
    
    // Add month options
    for (let i = 1; i <= monthsToShow; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.text = MONTH_NAMES[i - 1];
      monthFilterSelect.add(option);
    }
    
    // Try to restore previously selected month if it's still valid
    if (selectedMonth !== 'all' && parseInt(selectedMonth) <= monthsToShow) {
      monthFilterSelect.value = selectedMonth;
    } else if (parseInt(selectedMonth) > monthsToShow) {
      // If the previously selected month is no longer valid, set to "All Months"
      monthFilterSelect.value = 'all';
    }
  }
  
  // Set up calculate button click handler
  calculateButton.addEventListener('click', fetchOrderHistory);
  
  /**
   * Shows the "not logged in" UI elements and hides the logged in elements
   */
  function showNotLoggedIn() {
    // Hide loading indicator
    loadingIndicator.style.display = 'none';
    
    notLoggedInElement.style.display = 'block';
    loggedInElement.style.display = 'none';
  }
  
  /**
   * Shows the "logged in" UI elements and hides the not logged in elements
   */
  function showLoggedIn() {
    // Hide loading indicator
    loadingIndicator.style.display = 'none';
    
    notLoggedInElement.style.display = 'none';
    loggedInElement.style.display = 'block';
  }
  
  /**
   * Fetches the order history from Wolt API
   * First gets the auth token, then retrieves order data
   */
  function fetchOrderHistory() {
    // Store current filter selections before loading new data
    const selectedYear = yearFilterSelect.value;
    const selectedMonth = monthFilterSelect.value;
    const selectedVenue = venueFilterSelect.value;
    
    // Show loading text in status element
    statusElement.style.display = 'block';
    statusElement.textContent = t('fetchingOrders');
    sumDisplayElement.style.display = 'none';
    calculateButton.disabled = true;
    
    // Get auth token from the page
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      
      chrome.tabs.sendMessage(activeTab.id, { action: 'getAuthToken' }, async (response) => {
        if (chrome.runtime.lastError || !response || !response.token) {
          console.error('Failed to get auth token:', chrome.runtime.lastError);
          showError(t('authError'));
          return;
        }
        
        const token = response.token;
        
        try {
          // Fetch all orders without a limit
          await fetchAllOrders(token, selectedYear, selectedMonth, selectedVenue);
        } catch (error) {
          console.error('Error fetching orders:', error);
          showError(t('fetchingError'));
        }
      });
    });
  }
  
  /**
   * Filters orders based on year, month and venue selection
   * 
   * @param {Array} orders - All orders to filter
   * @returns {Array} Filtered orders based on current year, month and venue selection
   */
  function filterOrders(orders) {
    const selectedYear = yearFilterSelect.value;
    const selectedMonth = monthFilterSelect.value;
    const selectedVenue = venueFilterSelect.value;
    
    console.log(`Filtering orders: Year=${selectedYear}, Month=${selectedMonth}, Venue=${selectedVenue}, Total orders to filter=${orders.length}`);
    
    const filteredOrders = orders.filter(order => {
      if (!order.payment_time_ts) return false;
      
      const orderDate = new Date(order.payment_time_ts);
      const orderYear = orderDate.getFullYear().toString();
      const orderMonth = (orderDate.getMonth() + 1).toString(); // +1 because getMonth() returns 0-11
      
      const yearMatches = selectedYear === 'all' || orderYear === selectedYear;
      const monthMatches = selectedMonth === 'all' || orderMonth === selectedMonth;
      const venueMatches = selectedVenue === 'all' || 
        (order.venue_name && order.venue_name.trim() === selectedVenue);
      
      return yearMatches && monthMatches && venueMatches;
    });
    
    console.log(`After filtering: ${filteredOrders.length} orders remain`);
    return filteredOrders;
  }
  
  /**
   * Fetches all orders from the Wolt API
   * Uses a large limit (20,000) to avoid pagination
   * Handles retries for rate limiting and network errors
   * 
   * @param {string} token - The authentication token
   * @param {string} selectedYear - The selected year for filtering
   * @param {string} selectedMonth - The selected month for filtering
   * @param {string} selectedVenue - The selected venue for filtering
   * @param {number} retryCount - Number of retry attempts made
   * @returns {Array} The fetched orders
   */
  async function fetchAllOrders(token, selectedYear = 'all', selectedMonth = 'all', selectedVenue = 'all', retryCount = 0) {
    try {
      // Safety mechanism: abort after too many retries
      if (retryCount > 3) {
        console.log('Too many retry attempts - aborting fetch');
        showError(t('fetchingError') + ' (Too many retry attempts)');
        return [];
      }
      
      // URL for the API request with max limit of 20000 orders - no paging needed
      let url = 'https://consumer-api.wolt.com/order-tracking-api/v1/order_history/?limit=20000';
      
      // Status is only written to log, not displayed in UI
      console.log(t('fetchingOrders'));
      
      // Headers for the API request
      const headers = {
        'accept': 'application/json',
        'referer': 'https://wolt.com',
        'app-language': 'de',
        'app-locale': 'de',
        'authorization': `Bearer ${token}`
      };
      
      console.log('Fetching API with maximum count (20,000)');
      
      try {
        // Fetch the orders
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
          console.error(`HTTP error! Status: ${response.status}`);
          
          if (response.status === 429) {
            // Rate limit error - wait and retry
            console.log('Rate limit reached, waiting before retry...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            return fetchAllOrders(token, selectedYear, selectedMonth, selectedVenue, retryCount + 1);
          }
          
          // Enhanced error message with status code
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Check if orders were returned
        const ordersCount = data.orders ? data.orders.length : 0;
        
        console.log(`API response received: ${ordersCount} orders`);
        
        if (ordersCount > 0) {
          // Show count of loaded orders only in log, not in UI
          console.log(`${ordersCount} orders loaded`);
          
          // Process the orders
          processAllOrders(data.orders, selectedYear, selectedMonth, selectedVenue);
          return data.orders;
        } else {
          // No orders found
          console.log('No orders found');
          processAllOrders([], selectedYear, selectedMonth, selectedVenue);
          return [];
        }
      } catch (error) {
        console.error('Fetch error:', error.message);
        
        // Enhanced error handling for network problems
        if (error.message.includes('network') || 
            error.message.includes('failed') || 
            error.message.includes('fetch') ||
            error.message.includes('offline')) {
          
          handleNetworkError(error);
          
          // Try again after delay
          console.log('Network problem, trying again in 1 second...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchAllOrders(token, selectedYear, selectedMonth, selectedVenue, retryCount + 1);
        }
        
        showError(`${t('fetchingError')} (${error.message})`);
        return [];
      }
    } catch (error) {
      console.error('Error in fetchAllOrders:', error);
      showError(`${t('fetchingError')} (${error.message})`);
      return [];
    }
  }
  
  /**
   * Processes all orders and initializes filters
   * Removes duplicates, sets up UI, and calculates totals
   * 
   * @param {Array} orders - The orders to process
   * @param {string} selectedYear - The selected year for filtering
   * @param {string} selectedMonth - The selected month for filtering
   * @param {string} selectedVenue - The selected venue for filtering
   */
  function processAllOrders(orders, selectedYear = 'all', selectedMonth = 'all', selectedVenue = 'all') {
    console.log(`Processing ${orders.length} orders...`);
    
    // Remove duplicates from orders based on purchase_id
    const uniqueOrdersMap = new Map();
    orders.forEach(order => {
      if (order.purchase_id) {
        uniqueOrdersMap.set(order.purchase_id, order);
      }
    });
    
    // Convert map back to array
    const uniqueOrders = Array.from(uniqueOrdersMap.values());
    const duplicateCount = orders.length - uniqueOrders.length;
    
    console.log(`Removed: ${duplicateCount} duplicates, Remaining: ${uniqueOrders.length} unique orders`);
    
    // Save to cache for filtering
    allOrdersCache = uniqueOrders;
    
    // Save data for offline mode
    saveToLocalStorage(uniqueOrders, null, { year: selectedYear, month: selectedMonth, venue: selectedVenue });
    
    // Show the filter container if not already visible
    const filterContainer = document.getElementById('filter-container');
    const isFirstLoad = filterContainer.style.display === 'none';
    
    if (isFirstLoad) {
      filterContainer.style.display = 'block';
      
      // Set up event handlers for filters when shown for the first time
      setupFilterEventHandlers();
      
      // Change button text for subsequent calculations
      calculateButton.textContent = t('recalculateButton');
    }
    
    // Load filter options
    populateFilters(uniqueOrders, selectedYear, selectedMonth, selectedVenue);
    
    // Calculate filtered total
    calculateTotalSum(filterOrders(uniqueOrders));
  }
  
  /**
   * Parses a total_amount string into a currency and numeric amount
   * Handles European (comma decimal), thousands separators and currency symbols
   * 
   * @param {string} totalAmount - Raw total_amount string from the order
   * @returns {{currency: string, amount: number}|null} Parsed result or null if invalid
   */
  function parseAmount(totalAmount) {
    // Skip invalid or zero amounts
    if (!totalAmount || totalAmount === '--' || totalAmount === '-' || 
        !totalAmount.trim() || totalAmount === '0 RSD') {
      return null;
    }
    
    // Extract currency code and amount from the total_amount string
    // Try to match format with currency first: "RSD2,058", "€20.50", "$15.99"
    let match = totalAmount.match(/([A-Z€$£¥]*)([\d,.]+)/);
    
    // If not matched, try format with currency last: "2,058 RSD", "20.50 €", "15.99 $"
    if (!match || match[1] === '') {
      match = totalAmount.match(/([\d,.]+)\s*([A-Z€$£¥]+)/);
      // Swap positions if matched to keep processing logic uniform
      if (match) {
        const temp = match[1];
        match[1] = match[2];
        match[2] = temp;
      }
    }
    
    if (!match) return null;
    
    const currency = match[1] || 'RSD'; // Default to RSD if no currency symbol found
    
    // Handle both comma and dot as decimal separators
    let amountStr = match[2];
    
    // Check if it's an integer with thousands separator
    const hasComma = amountStr.includes(',');
    const hasDot = amountStr.includes('.');
    
    // Remove all whitespace
    amountStr = amountStr.replace(/\s/g, '');
    
    if (hasComma && hasDot) {
      // If both dot and comma are present, the dot is likely a thousands separator
      // and the comma is the decimal separator
      amountStr = amountStr.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
      // Only comma present - typical European format
      amountStr = amountStr.replace(',', '.');
    } else if (hasDot) {
      // For numbers like "2.058" (without decimal places),
      // the dot is likely a thousands separator, not a decimal point
      // Check if there are exactly 3 digits after the dot (common thousands format)
      const dotParts = amountStr.split('.');
      if (dotParts.length === 2 && dotParts[1].length === 3 && !isNaN(Number(dotParts[1]))) {
        // Probably a thousands separator - remove it
        amountStr = amountStr.replace('.', '');
      }
    }
    
    // Remove any remaining non-numeric characters except the decimal point
    amountStr = amountStr.replace(/[^\d.]/g, '');
    
    const amount = parseFloat(amountStr);
    
    if (isNaN(amount)) {
      console.log(`ERROR: Could not parse amount from "${totalAmount}"`);
      return null;
    }
    
    return { currency, amount };
  }
  
  /**
   * Formats an amount with its currency using German number formatting
   * 
   * @param {number} amount - The numeric amount
   * @param {string} currency - The currency code or symbol
   * @returns {string} Formatted string, e.g. "2.058,00 RSD"
   */
  function formatCurrency(amount, currency) {
    const formatted = amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${formatted} ${currency}`;
  }
  
  /**
   * Renders statistics: order count, average per order, venue count and top venue
   * 
   * @param {Array} deliveredOrders - Delivered orders with parsed amounts
   *                                 Each item: { order, currency, amount }
   */
  function renderStatistics(deliveredOrders) {
    if (!deliveredOrders || deliveredOrders.length === 0) {
      statsContainer.style.display = 'none';
      venueBreakdownContainer.style.display = 'none';
      return;
    }
    
    statsContainer.style.display = 'block';
    
    const statOrdersElement = document.getElementById('stat-orders');
    const statAvgElement = document.getElementById('stat-avg');
    const statVenuesElement = document.getElementById('stat-venues');
    const statTopVenueElement = document.getElementById('stat-top-venue');
    
    // Total order count
    statOrdersElement.textContent = deliveredOrders.length;
    
    // Aggregate by venue and currency
    const venueMap = new Map();
    const currencyTotals = new Map();
    const currencyCounts = new Map();
    
    deliveredOrders.forEach(item => {
      const venueName = (item.order.venue_name || '').trim() || t('unknownVenue');
      
      if (!venueMap.has(venueName)) {
        venueMap.set(venueName, { count: 0, sums: new Map() });
      }
      const venue = venueMap.get(venueName);
      venue.count += 1;
      venue.sums.set(item.currency, (venue.sums.get(item.currency) || 0) + item.amount);
      
      currencyTotals.set(item.currency, (currencyTotals.get(item.currency) || 0) + item.amount);
      currencyCounts.set(item.currency, (currencyCounts.get(item.currency) || 0) + 1);
    });
    
    // Average per order, per currency
    const avgLines = Array.from(currencyTotals.entries()).map(([currency, sum]) => {
      const count = currencyCounts.get(currency) || 1;
      return formatCurrency(sum / count, currency);
    });
    statAvgElement.textContent = avgLines.join('\n');
    
    // Number of unique venues
    statVenuesElement.textContent = venueMap.size;
    
    // Determine dominant currency (highest total) for ranking
    let dominantCurrency = null;
    let dominantSum = -1;
    currencyTotals.forEach((sum, currency) => {
      if (sum > dominantSum) {
        dominantSum = sum;
        dominantCurrency = currency;
      }
    });
    
    // Top venue by spend in dominant currency
    let topVenueName = '';
    let topVenueSum = -1;
    venueMap.forEach((venue, name) => {
      const sum = venue.sums.get(dominantCurrency) || 0;
      if (sum > topVenueSum) {
        topVenueSum = sum;
        topVenueName = name;
      }
    });
    statTopVenueElement.textContent = topVenueName;
    
    // Render per-venue breakdown (pass dominant total for share calculation)
    renderVenueBreakdown(venueMap, dominantCurrency, dominantSum);
  }
  
  /**
   * Renders the per-restaurant spending breakdown list
   * Sorted by spend in the dominant currency (descending)
   * Each row shows a share bar relative to the total spend
   * Clicking a restaurant applies it as the venue filter
   * 
   * @param {Map} venueMap - Map of venue name -> { count, sums }
   * @param {string} dominantCurrency - Currency used for sorting
   * @param {number} totalDominant - Total spend in dominant currency
   */
  function renderVenueBreakdown(venueMap, dominantCurrency, totalDominant) {
    venueBreakdownContainer.style.display = 'block';
    venueListElement.innerHTML = '';
    
    // Sort venues by total spend in dominant currency (descending)
    const sortedVenues = Array.from(venueMap.entries()).sort((a, b) => {
      const sumA = a[1].sums.get(dominantCurrency) || 0;
      const sumB = b[1].sums.get(dominantCurrency) || 0;
      return sumB - sumA;
    });
    
    sortedVenues.forEach(([name, venue]) => {
      const li = document.createElement('li');
      li.title = t('venueFilterHint', name);
      
      // Highlight the currently filtered venue
      if (name === venueFilterSelect.value) {
        li.classList.add('active');
      }
      
      const rowDiv = document.createElement('div');
      rowDiv.className = 'venue-row';
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'venue-name';
      nameSpan.textContent = name;
      
      const metaSpan = document.createElement('span');
      metaSpan.className = 'venue-meta';
      
      // Currency sums sorted descending
      const sumLines = Array.from(venue.sums.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([currency, sum]) => formatCurrency(sum, currency));
      
      const sumDiv = document.createElement('div');
      sumDiv.className = 'venue-sum';
      sumDiv.textContent = sumLines.join('\n');
      
      const countDiv = document.createElement('div');
      countDiv.className = 'venue-count';
      countDiv.textContent = t('orderCount', venue.count);
      
      metaSpan.appendChild(sumDiv);
      metaSpan.appendChild(countDiv);
      
      rowDiv.appendChild(nameSpan);
      rowDiv.appendChild(metaSpan);
      
      // Share bar relative to total spend
      const barDiv = document.createElement('div');
      barDiv.className = 'venue-bar';
      
      const fillDiv = document.createElement('div');
      fillDiv.className = 'venue-bar-fill';
      
      const venueDominantSum = venue.sums.get(dominantCurrency) || 0;
      const sharePercent = totalDominant > 0 ? (venueDominantSum / totalDominant) * 100 : 0;
      fillDiv.style.width = `${Math.max(sharePercent, 1)}%`;
      
      barDiv.appendChild(fillDiv);
      
      li.appendChild(rowDiv);
      li.appendChild(barDiv);
      
      // Clicking a venue applies it as filter
      li.addEventListener('click', () => {
        venueFilterSelect.value = name;
        if (allOrdersCache.length > 0) {
          calculateTotalSum(filterOrders(allOrdersCache));
        }
      });
      
      venueListElement.appendChild(li);
    });
  }
  
  /**
   * Calculates the total sum of orders grouped by currency
   * Displays the results, statistics and restaurant breakdown
   * 
   * @param {Array} orders - The filtered orders to sum
   */
  function calculateTotalSum(orders) {
    // Reset the UI
    calculateButton.disabled = false;
    
    if (!orders || orders.length === 0) {
      sumDisplayElement.style.display = 'block';
      sumDisplayElement.textContent = '0';
      statusElement.textContent = t('noOrders');
      renderStatistics([]);
      return;
    }
    
    // Count unique orders by purchase_id
    const uniqueOrderIds = new Set(orders.map(order => order.purchase_id));
    const uniqueOrderCount = uniqueOrderIds.size;
    
    console.log(`Filter applied: ${uniqueOrderCount} unique orders found`);
    
    // Get filter info for status message
    const yearFilter = yearFilterSelect.options[yearFilterSelect.selectedIndex].text;
    const monthFilter = monthFilterSelect.options[monthFilterSelect.selectedIndex].text;
    
    // Display filter info in status
    if (yearFilter === t('allYears') && monthFilter === t('allMonths')) {
      statusElement.textContent = t('ordersFoundAll', uniqueOrderCount);
    } else if (yearFilter !== t('allYears') && monthFilter === t('allMonths')) {
      statusElement.textContent = t('ordersFoundYear', uniqueOrderCount, yearFilter);
    } else if (yearFilter === t('allYears') && monthFilter !== t('allMonths')) {
      statusElement.textContent = t('ordersFoundMonth', uniqueOrderCount, monthFilter);
    } else {
      statusElement.textContent = t('ordersFoundYearMonth', uniqueOrderCount, monthFilter, yearFilter);
    }
    
    // Extract delivered orders with valid parsed amounts
    const processedOrderIds = new Set();
    const deliveredOrders = [];
    
    orders.forEach(order => {
      // Skip if this order ID has already been processed
      if (processedOrderIds.has(order.purchase_id)) return;
      
      // Mark this order ID as processed
      processedOrderIds.add(order.purchase_id);
      
      console.log(`Processing order: ${order.venue_name}, Status: ${order.status}, Amount: ${order.total_amount}, ID: ${order.purchase_id}`);
      
      // Skip orders that were not successfully delivered
      if (order.status !== 'delivered') {
        console.log(`  Skipping order with status: ${order.status}`);
        return;
      }
      
      const parsed = parseAmount(order.total_amount);
      if (parsed) {
        deliveredOrders.push({ order, ...parsed });
      } else {
        console.log(`  Skipping order with invalid or zero amount: ${order.total_amount}`);
      }
    });
    
    // Aggregate sums per currency
    const currencyAmountMap = new Map();
    deliveredOrders.forEach(({ currency, amount }) => {
      const currentSum = currencyAmountMap.get(currency) || 0;
      currencyAmountMap.set(currency, currentSum + amount);
    });
    
    // Debug: Log final sums
    console.log('\nFinal sums:');
    currencyAmountMap.forEach((sum, currency) => {
      console.log(`${currency}: ${sum.toFixed(2)}`);
    });
    
    // Display the results
    if (currencyAmountMap.size > 0) {
      sumDisplayElement.style.display = 'block';
      
      // Format each currency sum, one per line
      const formattedSums = Array.from(currencyAmountMap.entries()).map(([currency, sum]) => {
        return formatCurrency(sum, currency);
      });
      
      const sumText = formattedSums.join('\n');
      sumDisplayElement.textContent = sumText;
      sumDisplayElement.style.color = 'var(--accent-strong)';
      
      // Save the result for offline mode
      saveToLocalStorage(allOrdersCache, sumText, { 
        year: yearFilterSelect.value, 
        month: monthFilterSelect.value,
        venue: venueFilterSelect.value
      });
    } else {
      sumDisplayElement.style.display = 'block';
      sumDisplayElement.textContent = '0';
    }
    
    // Render statistics and restaurant breakdown
    renderStatistics(deliveredOrders);
  }
  
  /**
   * Shows an error message in the UI
   * Updates both status and sum display elements
   * 
   * @param {string} message - The error message to display
   */
  function showError(message) {
    calculateButton.disabled = false;
    
    statusElement.style.display = 'block';
    sumDisplayElement.style.display = 'block';
    sumDisplayElement.textContent = t('errorPrefix', message);
    sumDisplayElement.style.color = '#e74c3c';
    
    statusElement.textContent = t('errorOccurred');
  }
  
  /**
   * Event listeners for online/offline status changes
   * Updates UI accordingly to reflect connectivity status
   */
  window.addEventListener('online', function() {
    console.log('Online status changed to online');
    if (statusElement.textContent === t('offline') || statusElement.textContent === t('networkError')) {
      statusElement.textContent = t('readyToCalculate');
      calculateButton.disabled = false;
    }
  });
  
  window.addEventListener('offline', function() {
    console.log('Online status changed to offline');
    statusElement.style.display = 'block';
    statusElement.textContent = t('offline');
  });
});

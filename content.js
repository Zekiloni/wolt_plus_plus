// Content script for Wolt.com Spending Tracker extension
console.log('Wolt.com Spending Tracker Content Script loaded');

// Check if user is logged in every 2 seconds
let loginCheckInterval = setInterval(checkUserLogin, 2000);
let isUserLoggedIn = false;

/**
 * Checks if the user is logged in by looking for specific DOM elements.
 * Uses multiple detection methods including profile image and token cookies.
 * Reports login status changes to the background script.
 */
function checkUserLogin() {
  try {
    // Multiple possible selectors for login detection
    const selectors = [
      'img[alt="Profil"][data-test-id="UserStatus.ProfileImage"]',
      'img[data-test-id="UserStatus.ProfileImage"]',
      'button[data-test-id="UserStatus.LoginButton"]',
      'div[data-test-id="UserStatusContainer"] button'
    ];
    
    // Check DOM for login indicators
    let isLoggedIn = false;
    let matchedSelector = '';
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        // If we find the login button, user is not logged in
        if (selector.includes('LoginButton')) {
          isLoggedIn = false;
        } else {
          // Otherwise, other selectors indicate login
          isLoggedIn = true;
        }
        matchedSelector = selector;
        break;
      }
    }
    
    // Alternative method: Check if a cookie exists that indicates login
    if (!isLoggedIn) {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith('__wtoken=')) {
          isLoggedIn = true;
          matchedSelector = 'cookie:__wtoken';
          break;
        }
      }
    }
    
    console.log('Login check with selector:', matchedSelector, 'Result:', isLoggedIn);
    
    if (isLoggedIn) {
      // User is logged in
      if (!isUserLoggedIn) {
        isUserLoggedIn = true;
        console.log('User logged in detected');
        // Notify background script that user is logged in
        chrome.runtime.sendMessage({ action: 'userLoggedIn' });
      }
    } else {
      // User is not logged in
      if (isUserLoggedIn) {
        isUserLoggedIn = false;
        console.log('User logged out detected');
        // Notify background script that user is logged out
        chrome.runtime.sendMessage({ action: 'userLoggedOut' });
      }
    }
  } catch (e) {
    console.error('Error checking login status:', e);
  }
}

/**
 * Extracts the Wolt authentication token from cookies.
 * This token is needed to make API requests to fetch order history.
 * 
 * @returns {string} The authentication token or empty string if not found
 */
function getAuthToken() {
  try {
    // Look for the token in localStorage or cookies
    let token = '';
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      // Check for the token in __wtoken cookie
      if (cookie.startsWith('__wtoken=')) {
        try {
          const wtoken = decodeURIComponent(cookie.substring('__wtoken='.length));
          const tokenObj = JSON.parse(wtoken);
          if (tokenObj && tokenObj.accessToken) {
            token = tokenObj.accessToken;
            break;
          }
        } catch (e) {
          console.error('Error parsing token:', e);
        }
      }
    }
    return token;
  } catch (e) {
    console.error('Error getting auth token:', e);
    return '';
  }
}

/**
 * Listens for messages from the popup and responds accordingly.
 * Handles two actions:
 * 1. checkLogin - Checks if the user is logged in
 * 2. getAuthToken - Retrieves the authentication token
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  if (message.action === 'checkLogin') {
    // Direct check for the profile image element
    const profileImage = document.querySelector('img[data-test-id="UserStatus.ProfileImage"]');
    const isLoggedIn = !!profileImage;
    
    console.log('Login check result:', isLoggedIn);
    console.log('Profile image found:', profileImage ? 'Yes' : 'No');
    
    // Fallback: Cookie check only if no profile image was found
    if (!isLoggedIn) {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith('__wtoken=')) {
          try {
            const wtoken = decodeURIComponent(cookie.substring('__wtoken='.length));
            const tokenObj = JSON.parse(wtoken);
            if (tokenObj && tokenObj.accessToken) {
              console.log('Login detected via cookie token');
              sendResponse({ loggedIn: true });
              return true;
            }
          } catch (e) {
            console.error('Error parsing token cookie:', e);
          }
        }
      }
    }
    
    sendResponse({ loggedIn: isLoggedIn });
  } else if (message.action === 'getAuthToken') {
    // Get auth token and respond
    const token = getAuthToken();
    console.log('Auth token retrieved:', token ? 'Yes (token exists)' : 'No (no token found)');
    sendResponse({ token: token });
  }
  
  return true; // Keep the message channel open for async response
}); 
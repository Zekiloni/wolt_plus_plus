// Background script for Wolt.com Spending Tracker extension

// This script activates the extension icon only on wolt.com domains
chrome.runtime.onInstalled.addListener(() => {
  // Default state for action: disabled
  chrome.action.disable();
  console.log('Wolt.com Spending Tracker Extension installed');
});

// Enable/disable extension based on URL
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if URL is set and tab update is complete
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if the URL is on wolt.com domain
    if (tab.url.includes('wolt.com')) {
      // Enable the extension action for this tab
      chrome.action.enable(tabId);
      console.log('Enabled for tab:', tabId);
    } else {
      // Disable the extension action for other tabs
      chrome.action.disable(tabId);
      console.log('Disabled for tab:', tabId);
    }
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'userLoggedIn') {
    // User is logged in on wolt.com
    chrome.action.setBadgeText({ text: '✓', tabId: sender.tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#008000', tabId: sender.tab.id });
  } else if (message.action === 'userLoggedOut') {
    // User is not logged in on wolt.com
    chrome.action.setBadgeText({ text: '', tabId: sender.tab.id });
  }
}); 
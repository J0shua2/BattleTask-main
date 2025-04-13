/**
 * Background script for BattleTask Extension
 * 
 * This script handles:
 * 1. Tab monitoring for focus
 * 2. Server connection for educational content analysis
 * 3. Communication with popup for battle status
 * 4. Running timer continuously in the background
 */

const SERVER_URL = 'http://localhost:3000';
let timerInterval = null;

// Listen for tab activation (when the user switches tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    // Get the activated tab details
    const tab = await chrome.tabs.get(activeInfo.tabId);
    
    // Skip empty tabs, chrome:// urls, and extension pages
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return;
    }
    
    // Just log the tab change, no health checking
    console.log(`Tab changed to: ${tab.title} - NO HEALTH CHECK TRIGGERED`);
    
  } catch (error) {
    console.error('Error handling tab activation:', error);
  }
});

/**
 * Analyzes a tab for educational content
 * 
 * @param {Object} tab - Chrome tab object
 * @returns {Object} Analysis results with educational score
 */
async function analyzeTab(tab) {
  try {
    // Skip tabs that don't have a title or URL
    if (!tab.title || !tab.url) {
      return { isEducational: false, score: 0, categories: [], explanation: 'Empty tab' };
    }
    
    // Skip chrome internal pages
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
      return { isEducational: false, score: 0, categories: [], explanation: 'Chrome internal page' };
    }
    
    // First, check if we already have this tab's analysis in storage
    const storageKey = `tab_analysis_${tab.id}`;
    const storedData = await chrome.storage.local.get(storageKey);
    
    // If we have recent data (less than 5 minutes old) and the URL hasn't changed, use it
    if (storedData[storageKey] && 
        storedData[storageKey].url === tab.url && 
        Date.now() - storedData[storageKey].timestamp < 300000) {
      return storedData[storageKey].analysis;
    }
    
    try {
      // Otherwise, send the tab to the server for analysis
      const response = await fetch(`${SERVER_URL}/api/tabs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          windowId: tab.windowId,
          tab: {
            id: tab.id,
            title: tab.title,
            url: tab.url,
            active: tab.active,
            index: tab.index,
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Ensure we have a valid analysis object, even if server response was malformed
      const analysis = data.analysis || { isEducational: false, score: 0, categories: [], explanation: 'No analysis data' };
      
      // Ensure all required fields are present
      analysis.isEducational = !!analysis.isEducational; // Convert to boolean
      analysis.score = typeof analysis.score === 'number' ? analysis.score : 0;
      analysis.categories = Array.isArray(analysis.categories) ? analysis.categories : [];
      analysis.explanation = analysis.explanation || '';
      
      // Store the analysis in local storage for future reference
      await chrome.storage.local.set({
        [storageKey]: {
          url: tab.url,
          timestamp: Date.now(),
          analysis: analysis
        }
      });
      
      return analysis;
    } catch (serverError) {
      console.error('Server error analyzing tab:', serverError);
      
      // For any URL containing "learn", "tutorial", "course", etc. give it educational value
      // This is a fallback when the API fails
      const educationalTerms = [
        'learn', 'tutorial', 'course', 'education', 'study', 'university', 
        'college', 'academic', 'science', 'math', 'programming', 'code'
      ];
      
      const title = tab.title.toLowerCase();
      const url = tab.url.toLowerCase();
      
      // Check if any educational terms are present
      const hasEducationalTerms = educationalTerms.some(term => 
        title.includes(term) || url.includes(term)
      );
      
      const fallbackAnalysis = {
        isEducational: hasEducationalTerms,
        score: hasEducationalTerms ? 0.7 : 0.2, // Give a moderate score if terms found
        categories: [],
        explanation: 'Estimated based on keywords (API unavailable)'
      };
      
      // Cache this fallback result
      await chrome.storage.local.set({
        [storageKey]: {
          url: tab.url,
          timestamp: Date.now(),
          analysis: fallbackAnalysis
        }
      });
      
      return fallbackAnalysis;
    }
  } catch (error) {
    console.error('Error analyzing tab:', error);
    
    // If there's a any error, return a default analysis
    return {
      isEducational: false,
      score: 0,
      categories: [],
      explanation: 'Error during analysis: ' + error.message
    };
  }
}

/**
 * Gets all tabs and calculates their average educational score.
 * Reduces health if the average is below 50%.
 */
async function checkAllTabsAverageScore() {
  try {
    // Get all tabs from all windows
    const windows = await chrome.windows.getAll({ populate: true });
    let allTabs = [];
    
    // Collect all tabs
    for (const window of windows) {
      allTabs = allTabs.concat(window.tabs);
    }
    
    // Skip if no tabs found
    if (allTabs.length === 0) {
      return;
    }
    
    // Filter out chrome:// tabs and extension pages
    allTabs = allTabs.filter(tab => 
      tab.url && 
      !tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('about:')
    );
    
    // Skip if no valid tabs remain after filtering
    if (allTabs.length === 0) {
      console.log('No non-Chrome tabs found for analysis');
      return;
    }
    
    // Analyze each tab
    const analysisPromises = allTabs.map(tab => analyzeTab(tab));
    const analysisResults = await Promise.all(analysisPromises);
    
    // Calculate average score
    const scores = analysisResults.map(result => result.score);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    console.log(`Average tab score (excluding Chrome tabs): ${averageScore * 100}%`);
    
    // Check if score is below 50%
    if (averageScore <= 0.5) {
      // Check if we've updated recently (avoid spamming)
      const lastNotif = await chrome.storage.local.get('lastLowScoreNotification');
      const now = Date.now();
      
      // Only update the timestamp of the last notification check
      if (!lastNotif.lastLowScoreNotification || (now - lastNotif.lastLowScoreNotification > 30000)) {
        await chrome.storage.local.set({ lastLowScoreNotification: now });
      }
      
      // If average score is below 50%, reduce health
      await reduceHealth();
    }
  } catch (error) {
    console.error('Error checking average tab score:', error);
  }
}

/**
 * Reduces the health in an active battle when average tab score is below 50%
 */
async function reduceHealth() {
  try {
    const battleStatus = await chrome.storage.local.get('activeBattle');
    
    if (!battleStatus.activeBattle || !battleStatus.activeBattle.active) {
      return 0;
    }
    
    // Force health to be a number and subtract 1
    const currentHealth = parseInt(battleStatus.activeBattle.health || 3);
    const health = Math.max(0, currentHealth - 1);
    
    // Update the battle status but preserve the timeRemaining
    await chrome.storage.local.set({
      activeBattle: {
        ...battleStatus.activeBattle,
        health: health,
        lastHealthCheck: Date.now()
      }
    });
    
    if (health <= 0) {
      // Wait a brief moment to let the UI update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // If health reaches zero, end the battle with defeat
      await chrome.storage.local.set({
        activeBattle: {
          ...battleStatus.activeBattle,
          active: false,
          result: 'defeat',
          endTime: Date.now()
        }
      });
      chrome.notifications.create(
        "dead",
        {
          type: "basic",
          iconUrl: "icons/heart-empty.png",
          title: "GAAH!",
          message: "You have fallen to procrastination... next time you GOTTA LOCK IN!!",
        }
      )
      // Clear the timer if it's running
      stopBackgroundTimer();
    } else {
      chrome.notifications.create(
        "health lost",
        {
          type: "basic",
          iconUrl: "icons/heart-half.png",
          title: "Oh no!",
          message: "You lost a heart! You have " + health + (health > 1 ? " hearts" : " heart") + " left.",
        }
      )
    }
    
    return health;
  } catch (error) {
    console.error('Error reducing health:', error);
    return 0;
  }
}

/**
 * Starts a continuous timer in the background
 */
function startBackgroundTimer() {
  // Clear any existing timer first
  stopBackgroundTimer();
  
  timerInterval = setInterval(async () => {
    try {
      // Get battle status
      const data = await chrome.storage.local.get('activeBattle');
      
      if (data.activeBattle && data.activeBattle.active) {
        // Calculate remaining time
        let timeRemaining = data.activeBattle.timeRemaining - 1;
        
        // Update timer in storage
        await chrome.storage.local.set({
          activeBattle: {
            ...data.activeBattle,
            timeRemaining: timeRemaining
          }
        });
        
        // Only check average tab score every 15 seconds
        if (timeRemaining % 15 === 0) {
          await checkAllTabsAverageScore();
        }
        
        // If timer hits zero, end the battle with victory
        if (timeRemaining <= 0) {
          await chrome.storage.local.set({
            activeBattle: {
              ...data.activeBattle,
              active: false,
              result: 'victory',
              endTime: Date.now(),
              timeRemaining: 0
            }
          });
          
          // Clear the timer
          stopBackgroundTimer();
        }
      } else {
        // If there's no active battle, stop the timer
        stopBackgroundTimer();
      }
    } catch (error) {
      console.error('Error updating timer:', error);
    }
  }, 1000); // Update every second
}

/**
 * Stops the background timer
 */
function stopBackgroundTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Listen for message from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startTimer') {
    startBackgroundTimer();
    
    // Explicitly don't check tabs when starting timer
    // First check will happen at the next 15-second interval
    console.log('Timer started - next health check in up to 15 seconds');
    
    sendResponse({ success: true });
  } else if (message.action === 'stopTimer') {
    stopBackgroundTimer();
    sendResponse({ success: true });
  }
  
  return true; // Keep the message channel open for async responses
});

// Handle installation and updates
chrome.runtime.onInstalled.addListener(() => {
  console.log('BattleTask extension installed/updated');
  
  // Initialize storage with default values
  chrome.storage.local.set({
    battlesWon: 0,
    focusMinutes: 0,
    activeBattle: {
      active: false,
      startTime: null,
      endTime: null,
      duration: 0,
      timeRemaining: 0,
      health: 3,
      result: null
    }
  });
});
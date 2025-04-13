/**
 * BattleTask - A gamified focus extension
 * 
 * This script handles:
 * 1. Timer selection and control
 * 2. Tab monitoring for focus
 * 3. Health management based on average tab score
 * 4. Monster generation and battle mechanics
 * 5. Statistics tracking
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const timeOptions = document.querySelectorAll('.time-option');
  const startButton = document.querySelector('.start-button');
  const timerDisplay = document.querySelector('.timer');
  const monsterContainer = document.querySelector('.monster-container');
  const hearts = document.querySelectorAll('.heart');
  const resultMessage = document.querySelector('.result-message');
  const battlesWonElement = document.getElementById('battles-won');
  const focusMinutesElement = document.getElementById('focus-minutes');
  const currentScoreElement = document.getElementById('current-score');
  
  // Game state variables
  let selectedTime = 0;
  let timerInterval = null;
  let timeRemaining = 0;
  let health = 3;
  let isRunning = false;
  let lastTabId = null;
  let battlesWon = 0;
  let totalFocusMinutes = 0;
  let currentMonster = null;
  
  // Constants
  const SERVER_URL = 'http://localhost:3000';
  const MONSTER_PARTS = {
    bodies: [
      'monster-body1.png',
      'monster-body2.png',
      'monster-body3.png',
      'monster-body4.png',
      'monster-body5.png'
    ],
    eyes: [
      'monster-eyes1.png',
      'monster-eyes2.png',
      'monster-eyes3.png',
      'monster-eyes4.png',
      'monster-eyes5.png'
    ],
    limbs: [
      'monster-limbs1.png',
      'monster-limbs2.png',
      'monster-limbs3.png',
      'monster-limbs4.png',
      'monster-limbs5.png'
    ]
  };
  
  // Load saved stats
  async function loadStats() {
    try {
      const stats = await chrome.storage.local.get(['battlesWon', 'focusMinutes']);
      if (stats.battlesWon) {
        battlesWon = stats.battlesWon;
        battlesWonElement.textContent = battlesWon;
      }
      if (stats.focusMinutes) {
        totalFocusMinutes = stats.focusMinutes;
        focusMinutesElement.textContent = totalFocusMinutes;
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }
  
  // Save stats
  async function saveStats() {
    try {
      await chrome.storage.local.set({
        battlesWon,
        focusMinutes: totalFocusMinutes
      });
    } catch (error) {
      console.error('Error saving stats:', error);
    }
  }
  
  // Format time as MM:SS
  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  // Generate a random monster by combining parts
  function generateMonster() {
    // If we already have a monster for the current battle, use it
    if (currentMonster) {
      applyMonsterToUI(currentMonster);
      return;
    }
    
    // Create a new monster for this battle with random parts
    currentMonster = {
      body: MONSTER_PARTS.bodies[Math.floor(Math.random() * MONSTER_PARTS.bodies.length)],
      eyes: MONSTER_PARTS.eyes[Math.floor(Math.random() * MONSTER_PARTS.eyes.length)],
      limbs: MONSTER_PARTS.limbs[Math.floor(Math.random() * MONSTER_PARTS.limbs.length)]
    };
    
    applyMonsterToUI(currentMonster);
  }
  
  // Apply the monster parts to the UI
  function applyMonsterToUI(monster) {
    const bodyElement = monsterContainer.querySelector('.monster-body');
    const eyesElement = monsterContainer.querySelector('.monster-eyes');
    const limbsElement = monsterContainer.querySelector('.monster-limbs');
    
    // Reset elements
    bodyElement.innerHTML = '';
    eyesElement.innerHTML = '';
    limbsElement.innerHTML = '';
    
    // Set position styles
    bodyElement.style.position = 'absolute';
    bodyElement.style.top = '0';
    bodyElement.style.left = '0';
    bodyElement.style.width = '100%';
    bodyElement.style.height = '100%';
    bodyElement.style.zIndex = '1';
    
    eyesElement.style.position = 'absolute';
    eyesElement.style.top = '0';
    eyesElement.style.left = '0';
    eyesElement.style.width = '100%';
    eyesElement.style.height = '100%';
    eyesElement.style.zIndex = '2';
    
    limbsElement.style.position = 'absolute';
    limbsElement.style.top = '0';
    limbsElement.style.left = '0';
    limbsElement.style.width = '100%';
    limbsElement.style.height = '100%';
    limbsElement.style.zIndex = '0';
    
    // Apply image backgrounds directly to the elements
    bodyElement.style.backgroundImage = `url('icons/${monster.body}')`;
    bodyElement.style.backgroundSize = 'contain';
    bodyElement.style.backgroundPosition = 'center';
    bodyElement.style.backgroundRepeat = 'no-repeat';
    
    eyesElement.style.backgroundImage = `url('icons/${monster.eyes}')`;
    eyesElement.style.backgroundSize = 'contain';
    eyesElement.style.backgroundPosition = 'center';
    eyesElement.style.backgroundRepeat = 'no-repeat';
    
    limbsElement.style.backgroundImage = `url('icons/${monster.limbs}')`;
    limbsElement.style.backgroundSize = 'contain';
    limbsElement.style.backgroundPosition = 'center';
    limbsElement.style.backgroundRepeat = 'no-repeat';
  }
  
  // Start the battle
  function startBattle() {
    if (selectedTime === 0) {
      alert('Please select a time duration first!');
      return;
    }
    
    isRunning = true;
    health = 3;
    timeRemaining = selectedTime * 60;
    timerDisplay.textContent = formatTime(timeRemaining);
    
    // Reset UI
    hearts.forEach(heart => heart.classList.remove('lost'));
    resultMessage.classList.remove('victory', 'defeat');
    resultMessage.style.display = 'none';
    
    // Create a new monster for this battle with random parts
    currentMonster = {
      body: MONSTER_PARTS.bodies[Math.floor(Math.random() * MONSTER_PARTS.bodies.length)],
      eyes: MONSTER_PARTS.eyes[Math.floor(Math.random() * MONSTER_PARTS.eyes.length)],
      limbs: MONSTER_PARTS.limbs[Math.floor(Math.random() * MONSTER_PARTS.limbs.length)]
    };
    
    // Generate and show monster
    generateMonster();
    monsterContainer.classList.add('active');
    
    // Keep timer visible at all times
    timerDisplay.style.display = 'block';
    
    // Update button
    startButton.textContent = 'SURRENDER';
    startButton.classList.add('active');
    
    // Store battle state in chrome.storage to start the background timer
    chrome.storage.local.set({
      activeBattle: {
        active: true,
        startTime: Date.now(),
        duration: selectedTime * 60,
        timeRemaining: timeRemaining,
        health: health,
        selectedTime: selectedTime,
        monster: currentMonster // Store the monster with the battle
      }
    }).then(() => {
      // Explicitly tell the background script to start the timer
      chrome.runtime.sendMessage({ action: 'startTimer' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error starting timer:', chrome.runtime.lastError);
        } else {
          console.log('Timer started successfully');
        }
      });
    });
    
    // Start local UI update timer (not the actual timer logic)
    startUIUpdateTimer();
    
    // Get current average tab score
    getCurrentAverageScore();
  }
  
  // Start UI update timer
  function startUIUpdateTimer() {
    // Clear any existing timer
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    
    // This timer only updates the UI, not the actual time
    timerInterval = setInterval(async () => {
      try {
        // Get the latest battle state from storage
        const data = await chrome.storage.local.get('activeBattle');
        
        if (data.activeBattle && data.activeBattle.active) {
          // Update timeRemaining from storage
          const newTimeRemaining = data.activeBattle.timeRemaining;
          if (timeRemaining !== newTimeRemaining) {
            timeRemaining = newTimeRemaining;
          }
          
          // Update health from storage - force to number between 0-3
          const storedHealth = data.activeBattle.health;
          const newHealth = Math.max(0, Math.min(3, parseInt(storedHealth) || 0));
          
          if (health !== newHealth) {
            health = newHealth;
          }
          
          // Update UI first before checking battle end
          timerDisplay.textContent = formatTime(timeRemaining);
          updateHealthUI();
          
          // The updateHealthUI function will handle the health=0 case with a delay
          // so only check for timer end here
          if (timeRemaining <= 0) {
            endBattle(true);
            chrome.notifications.create(
              "victory",
              {
                type: "basic",
                iconUrl: "icons/heart.png",
                title: "Victory!",
                message: "You defeated the procrastination monster! Yippee!",
              }
            )
          }
        } else if (isRunning) {
          // If storage shows battle is over but UI hasn't updated
          if (data.activeBattle && data.activeBattle.result === 'victory') {
            endBattle(true);
          } else if (data.activeBattle && data.activeBattle.result === 'defeat') {
            endBattle(false);
          } else {
            // Just end the battle if we're in an inconsistent state
            endBattle(false);
          }
        }
      } catch (error) {
        console.error('Error in UI update timer:', error);
      }
    }, 500); // Update UI twice per second
  }
  
  // Update health UI
  function updateHealthUI() {

    hearts.forEach((heart, index) => {
      // When health is 0, ensure all hearts are marked as lost
      if (health <= 0 || index >= health) {
        heart.classList.add('lost');
      } else {
        heart.classList.remove('lost');
      }
    });
    
    // When health reaches 0, force a little delay before ending the battle
    // to ensure the UI updates are visible
    if (health <= 0 && isRunning) {
      setTimeout(() => {
        endBattle(false);
      }, 500);
    }
  }
  
  // End the battle
  function endBattle(victory = false) {
    // Clear the UI update timer
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    
    isRunning = false;
    monsterContainer.classList.remove('active');
    timerDisplay.style.display = 'block';
    
    // Clear the current monster
    currentMonster = null;
    
    // Update UI
    startButton.textContent = 'START BATTLE';
    startButton.classList.remove('active');
    
    // Update battle state in storage (in case it wasn't already updated)
    chrome.storage.local.set({
      activeBattle: {
        active: false,
        endTime: Date.now(),
        result: victory ? 'victory' : 'defeat'
      }
    }).then(() => {
      // Explicitly tell the background script to stop the timer
      chrome.runtime.sendMessage({ action: 'stopTimer' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error stopping timer:', chrome.runtime.lastError);
        } else {
          console.log('Timer stopped successfully');
        }
      });
    });
    
    if (victory) {
      resultMessage.textContent = 'Victory! You defeated the procrastination monster!';
      resultMessage.classList.add('victory');
      resultMessage.classList.remove('defeat');
      battlesWon++;
      totalFocusMinutes += Math.floor(selectedTime);
      
      battlesWonElement.textContent = battlesWon;
      focusMinutesElement.textContent = totalFocusMinutes;
      
      saveStats();
    } else {
      resultMessage.textContent = 'Defeat! The procrastination monster got you!';
      resultMessage.classList.add('defeat');
      resultMessage.classList.remove('victory');
    }
    
    resultMessage.style.display = 'block';
  }
  
  // Get current average tab score for display only
  async function getCurrentAverageScore() {
    try {
      // Get all tabs from all windows
      const windows = await chrome.windows.getAll({ populate: true });
      let allTabs = [];
      
      // Collect all tabs
      for (const window of windows) {
        allTabs = allTabs.concat(window.tabs);
      }
      
      // Skip if no tabs found
      if (allTabs.length === 0) return;
      
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
        currentScoreElement.textContent = 'N/A';
        currentScoreElement.style.color = 'var(--text-color)';
        return 0;
      }
      
      // Analyze each tab
      const analysisPromises = allTabs.map(tab => analyzeTab(tab));
      const analysisResults = await Promise.all(analysisPromises);
      
      // Calculate average score
      const scores = analysisResults.map(result => result.score);
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      
      // Update score display
      const scorePercent = Math.round(averageScore * 100);
      currentScoreElement.textContent = `${scorePercent}%`;
      
      // Change color based on score value
      if (scorePercent <= 50) {
        currentScoreElement.style.color = 'var(--danger-color)'; // Red for below 50%
      } else if (scorePercent >= 80) {
        currentScoreElement.style.color = 'var(--success-color)'; // Green for 80% or above
      } else {
        currentScoreElement.style.color = 'var(--text-color)'; // White for in between
      }
      
      // IMPORTANT: We don't trigger any health reduction here, even if score is low
      return averageScore;
    } catch (error) {
      console.error('Error getting average tab score:', error);
      return 0;
    }
  }
  
  // Analyze tab for educational content
  async function analyzeTab(tab) {
    try {
      // First check if we have cached analysis
      const storageKey = `tab_analysis_${tab.id}`;
      const storedData = await chrome.storage.local.get(storageKey);
      
      if (storedData[storageKey] && 
          storedData[storageKey].url === tab.url && 
          Date.now() - storedData[storageKey].timestamp < 300000) {
        return storedData[storageKey].analysis;
      }
      
      // Otherwise get analysis from server
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
            mutedInfo: tab.mutedInfo,
            pinned: tab.pinned,
            status: tab.status,
            incognito: tab.incognito,
            loading: tab.loading,
            lastAccessed: Date.now()
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      
      const data = await response.json();
      
      // Cache the analysis
      await chrome.storage.local.set({
        [storageKey]: {
          url: tab.url,
          timestamp: Date.now(),
          analysis: data.analysis
        }
      });
      
      return data.analysis;
    } catch (error) {
      console.error('Error analyzing tab:', error);
      return { isEducational: false, score: 0, categories: [], explanation: 'Error analyzing tab' };
    }
  }
  
  // Set up time option selection
  timeOptions.forEach(option => {
    option.addEventListener('click', () => {
      if (isRunning) return;
      
      timeOptions.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      selectedTime = parseInt(option.dataset.minutes, 10);
      timerDisplay.textContent = formatTime(selectedTime * 60);
    });
  });
  
  // Set up start/stop button
  startButton.addEventListener('click', () => {
    if (isRunning) {
      // Confirm surrender
      if (confirm('Are you sure you want to surrender this battle?')) {
        endBattle(false);
      }
    } else {
      startBattle();
    }
  });
  
  // Initialize - Check if there's an active battle when popup opens
  async function initialize() {
    loadStats();
    timerDisplay.textContent = '00:00';
    
    // Get current average tab score
    await getCurrentAverageScore();
    
    // Check if there's an active battle
    try {
      const data = await chrome.storage.local.get('activeBattle');
      if (data.activeBattle && data.activeBattle.active) {
        // Resume battle
        selectedTime = data.activeBattle.selectedTime || 25;
        timeRemaining = data.activeBattle.timeRemaining || 0;
        health = data.activeBattle.health || 3;
        
        // Restore saved monster or create a new one
        if (data.activeBattle.monster) {
          currentMonster = data.activeBattle.monster;
        } else {
          currentMonster = {
            body: MONSTER_PARTS.bodies[0],
            eyes: MONSTER_PARTS.eyes[0],
            limbs: MONSTER_PARTS.limbs[0]
          };
        }
        
        // Update UI to reflect current state
        timerDisplay.textContent = formatTime(timeRemaining);
        updateHealthUI();
        
        // Select the time option
        timeOptions.forEach(option => {
          if (parseInt(option.dataset.minutes, 10) === selectedTime) {
            option.classList.add('selected');
          }
        });
        
        // Start battle UI
        isRunning = true;
        startButton.textContent = 'SURRENDER';
        startButton.classList.add('active');
        generateMonster();
        monsterContainer.classList.add('active');
        
        // Ensure the background timer is running
        chrome.runtime.sendMessage({ action: 'startTimer' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error starting timer:', chrome.runtime.lastError);
          } else {
            console.log('Timer started successfully');
          }
        });
        
        // Start UI update timer
        startUIUpdateTimer();
      }
    } catch (error) {
      console.error('Error initializing battle state:', error);
    }
  }
  
  // Initialize the UI
  initialize();
}); 
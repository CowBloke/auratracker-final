// Integration bridge for Hextris to communicate with AuraTracker
// This script hooks into the game and sends score updates to the parent window

(function() {
  'use strict';

  // Store the last reported score
  let lastReportedScore = 0;
  let gameActive = false;

  // Detect when the game updates the score
  const originalSetTimeout = window.setTimeout;
  let scoreCheckInterval = null;

  function getGameScore() {
    // The game stores the score in the #cScore element or gameState variable
    const scoreElement = document.getElementById('cScore');
    if (scoreElement && scoreElement.textContent) {
      return parseInt(scoreElement.textContent) || 0;
    }
    
    // Try to get from global gameState or score variable if available
    if (typeof gameScore !== 'undefined') {
      return gameScore;
    }
    
    return 0;
  }

  function reportScoreUpdate(score, isPlaying) {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'HEXTRIS_SCORE_UPDATE',
        data: {
          score: score,
          isPlaying: isPlaying
        }
      }, window.location.origin);
    }
  }

  function reportGameOver(score) {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'HEXTRIS_GAME_OVER',
        data: {
          score: score
        }
      }, window.location.origin);
    }
    gameActive = false;
  }

  // Listen for restart messages from parent
  window.addEventListener('message', function(event) {
    if (event.origin !== window.location.origin) return;

    if (event.data.type === 'RESTART_GAME') {
      // Trigger restart button click or restart game
      const restartBtn = document.getElementById('restart');
      if (restartBtn) {
        restartBtn.click();
      }
      // Also try the in-game restart button
      const gameRestartBtn = document.getElementById('restartBtn');
      if (gameRestartBtn) {
        gameRestartBtn.click();
      }
    }
  });

  // Wait for the game to load and then set up monitoring
  function setupScoreMonitoring() {
    // Check if game objects are available
    if (typeof gameState === 'undefined') {
      setTimeout(setupScoreMonitoring, 100);
      return;
    }

    // Monitor score changes
    scoreCheckInterval = setInterval(function() {
      const currentScore = getGameScore();

      // Check if game is running (gameState: 0=menu, 1=playing, 2=paused, -1=gameover)
      const isPlaying = (typeof gameState !== 'undefined' && gameState === 1);

      if (currentScore !== lastReportedScore) {
        lastReportedScore = currentScore;
        reportScoreUpdate(currentScore, isPlaying);
      }

      // Detect game over condition
      const gameOverScreen = document.getElementById('gameoverscreen');
      const isGameOverScreenVisible = gameOverScreen && gameOverScreen.style.display !== 'none';

      if (isGameOverScreenVisible && gameActive) {
        reportGameOver(currentScore);
      }

      if (!isGameOverScreenVisible) {
        gameActive = true;
      }
    }, 100);
  }

  // Start monitoring when the document is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupScoreMonitoring);
  } else {
    setupScoreMonitoring();
  }

  // Cleanup
  window.addEventListener('beforeunload', function() {
    if (scoreCheckInterval) {
      clearInterval(scoreCheckInterval);
    }
  });
})();

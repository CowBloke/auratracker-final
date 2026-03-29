(function () {
  const SOURCE = 'aura-chrome-dino';
  const HOST_SOURCE = 'aura-chrome-dino-host';
  let patched = false;

  function post(type, payload) {
    if (window.parent === window) return;
    window.parent.postMessage(
      {
        source: SOURCE,
        type: type,
        ...payload,
      },
      window.location.origin
    );
  }

  function getRunner() {
    return window.Runner && window.Runner.instance_ ? window.Runner.instance_ : null;
  }

  function getScore(runner) {
    if (!runner) return 0;

    if (runner.distanceMeter && typeof runner.distanceMeter.getActualDistance === 'function') {
      return runner.distanceMeter.getActualDistance(Math.ceil(runner.distanceRan || 0));
    }

    return Math.ceil(runner.distanceRan || 0);
  }

  function wrapMethod(target, methodName, afterCall) {
    const original = target && target[methodName];
    if (typeof original !== 'function') return;

    target[methodName] = function () {
      const result = original.apply(this, arguments);
      afterCall(this);
      return result;
    };
  }

  function setupBridge() {
    const runner = getRunner();
    if (!runner || patched) return;

    patched = true;

    wrapMethod(window.Runner.prototype, 'startGame', function (instance) {
      post('state', {
        status: 'running',
        score: getScore(instance),
        highScore: Math.ceil(instance.highestScore || 0),
      });
    });

    wrapMethod(window.Runner.prototype, 'restart', function (instance) {
      post('state', {
        status: 'running',
        score: 0,
        highScore: Math.ceil(instance.highestScore || 0),
      });
    });

    wrapMethod(window.Runner.prototype, 'play', function (instance) {
      post('state', {
        status: 'running',
        score: getScore(instance),
        highScore: Math.ceil(instance.highestScore || 0),
      });
    });

    wrapMethod(window.Runner.prototype, 'gameOver', function (instance) {
      post('game-over', {
        status: 'crashed',
        score: getScore(instance),
        highScore: Math.ceil(instance.highestScore || 0),
      });
    });

    window.addEventListener('message', function (event) {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.source !== HOST_SOURCE) return;

      const currentRunner = getRunner();
      if (!currentRunner) return;

      if (event.data.type === 'pause') {
        currentRunner.stop();
        post('state', {
          status: currentRunner.crashed ? 'crashed' : 'paused',
          score: getScore(currentRunner),
          highScore: Math.ceil(currentRunner.highestScore || 0),
        });
      }

      if (event.data.type === 'resume' && !currentRunner.crashed) {
        currentRunner.play();
      }

      if (event.data.type === 'restart') {
        if (currentRunner.crashed) {
          currentRunner.restart();
        } else {
          window.location.reload();
        }
      }

      if (event.data.type === 'focus') {
        currentRunner.containerEl && currentRunner.containerEl.focus && currentRunner.containerEl.focus();
        window.focus();
      }
    });

    post('ready', {
      status: runner.crashed ? 'crashed' : runner.playing ? 'running' : 'idle',
      score: getScore(runner),
      highScore: Math.ceil(runner.highestScore || 0),
    });
  }

  const intervalId = window.setInterval(function () {
    setupBridge();
    if (patched) {
      window.clearInterval(intervalId);
    }
  }, 50);

  window.addEventListener('load', function () {
    setupBridge();
  });
})();

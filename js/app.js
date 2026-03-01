/**
 * app.js
 * Main application controller for Mohalla Master.
 * Manages screens, geolocation, map, game loop, and scoring.
 */

const App = (() => {

  /* ─── Config ─── */
  const TOTAL_ROUNDS  = 5;
  const ROUND_TIME    = 40; // seconds per round (slightly easier)
  const MAP_ZOOM_GAME = 16; // gameplay zoom (slightly easier)
  const MAP_ZOOM_RESULT = 16;
  const LOCATION_LOG_STORAGE_KEY = 'mohalla_location_logs';
  const LOCATION_LOG_MAX_ENTRIES = 300;
  const LOCATION_LOG_ENDPOINT = window.MOHALLA_LOCATION_LOG_ENDPOINT || '/api/location-log';

  /* ─── State ─── */
  let userLat, userLon;
  let allPOIs       = [];
  let usedPOIs      = new Set();
  let currentPOI    = null;
  let currentRound  = 0;
  let totalScore    = 0;
  let roundResults  = [];
  let guessMarker   = null;
  let timerInterval = null;
  let timeLeft      = ROUND_TIME;
  let map           = null;
  let resultMap     = null;

  /* ─── Screen management ─── */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
      s.classList.add('hidden');
    });
    const el = document.getElementById(id);
    el.classList.remove('hidden');
    requestAnimationFrame(() => el.classList.add('active'));
  }

  /* ─── Geolocation ─── */
  function requestLocation() {
    const btn    = document.getElementById('btn-start');
    const status = document.getElementById('location-status');

    if (!navigator.geolocation) {
      setStatus(status, 'error', '⚠ Your browser does not support geolocation. Please use Chrome or Firefox.');
      return;
    }

    btn.querySelector('.btn-text').textContent = 'Detecting…';
    btn.disabled = true;
    status.className = 'location-status';
    status.textContent = '📡 Requesting GPS signal…';
    status.classList.remove('hidden');

    navigator.geolocation.getCurrentPosition(
      onLocationSuccess,
      onLocationError,
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  function onLocationSuccess(pos) {
    const btn    = document.getElementById('btn-start');
    const status = document.getElementById('location-status');

    userLat = pos.coords.latitude;
    userLon = pos.coords.longitude;
    const acc = Math.round(pos.coords.accuracy);
    logLocationEvent({
      event: 'location_granted',
      latitude: userLat,
      longitude: userLon,
      accuracyM: acc,
    });

    setStatus(status, 'success', `✅ Location found — ±${acc}m accuracy. Fetching landmarks…`);
    btn.querySelector('.btn-text').textContent = 'Loading…';

    fetchAndStart(acc);
  }

  function onLocationError(err) {
    const btn    = document.getElementById('btn-start');
    const status = document.getElementById('location-status');
    btn.querySelector('.btn-text').textContent = 'Try Again';
    btn.disabled = false;

    const msgs = {
      1: '🚫 Location access denied. Please allow location in your browser settings and try again.',
      2: '📡 Position unavailable. Make sure GPS is enabled and you have a network connection.',
      3: '⏱ Location timed out. Try stepping outside or moving to a window.',
    };
    logLocationEvent({
      event: 'location_error',
      code: err.code ?? 0,
      message: err.message || '',
    });
    setStatus(status, 'error', msgs[err.code] || 'Unknown error. Please try again.');
  }

  async function fetchAndStart(accuracy) {
    const status = document.getElementById('location-status');

    try {
      let pois = await Overpass.getNearbyPOIs(userLat, userLon);

      if (pois.length < 5) {
        setStatus(status, '', '⚠ Sparse map data in your area — using fallback landmarks.');
        pois = Overpass.generateFallbackPOIs(userLat, userLon);
      }

      if (accuracy > 200) {
        setStatus(status, '', `⚠ GPS accuracy is low (±${accuracy}m). Game still works, but challenges may be slightly off.`);
        await sleep(1500);
      }

      allPOIs      = pois;
      currentRound = 0;
      totalScore   = 0;
      roundResults = [];
      usedPOIs.clear();

      startGame();

    } catch (e) {
      console.error(e);
      const btn = document.getElementById('btn-start');
      btn.querySelector('.btn-text').textContent = 'Try Again';
      btn.disabled = false;
      setStatus(status, 'error', '⚠ Could not load landmark data. Check your internet connection and try again.');
    }
  }

  /* ─── Game ─── */
  function startGame() {
    showScreen('screen-game');
    initMap();
    startRound();
  }

  function initMap() {
    if (map) { map.remove(); map = null; }

    map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
    }).setView([userLat, userLon], MAP_ZOOM_GAME);

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
    }).addTo(map);

    // Attribution (small, bottom right)
    L.control.attribution({ prefix: false })
      .addAttribution('© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com">CARTO</a>')
      .addTo(map);

    // On map click: place guess pin
    map.on('click', onMapClick);
  }

  function startRound() {
    currentRound++;
    guessMarker = null;

    // Pick a random unused POI
    const available = allPOIs.filter(p => !usedPOIs.has(p.id));
    if (available.length === 0 || currentRound > TOTAL_ROUNDS) {
      showFinalScreen();
      return;
    }

    currentPOI = available[Math.floor(Math.random() * available.length)];
    usedPOIs.add(currentPOI.id);

    // Update HUD
    document.getElementById('hud-round').textContent  = currentRound;
    document.getElementById('hud-score').textContent  = totalScore;
    document.getElementById('hud-poi-name').textContent = `${currentPOI.emoji} ${currentPOI.name}`;
    document.getElementById('hud-poi-type').textContent  = currentPOI.type;

    // Hide confirm
    document.getElementById('confirm-wrap').style.display = 'none';
    document.getElementById('map-hint').style.display     = 'block';

    // Re-centre map (without showing POI location)
    const jitterLat = userLat + (Math.random() - 0.5) * 0.0018;
    const jitterLon = userLon + (Math.random() - 0.5) * 0.0018;
    map.setView([jitterLat, jitterLon], MAP_ZOOM_GAME);

    // Start timer
    startTimer();
  }

  function onMapClick(e) {
    if (!currentPOI) return;

    document.getElementById('map-hint').style.display = 'none';

    // Remove old guess
    if (guessMarker) map.removeLayer(guessMarker);

    // Custom pin icon
    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:28px; height:28px;
        background:#FF6B00;
        border:3px solid #fff;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 2px 8px rgba(0,0,0,0.5);
      "></div>`,
      iconSize:   [28, 28],
      iconAnchor: [14, 28],
    });

    guessMarker = L.marker(e.latlng, { icon }).addTo(map);
    document.getElementById('confirm-wrap').style.display = 'flex';
  }

  function cancelPin() {
    if (guessMarker) { map.removeLayer(guessMarker); guessMarker = null; }
    document.getElementById('confirm-wrap').style.display = 'none';
    document.getElementById('map-hint').style.display     = 'block';
  }

  function submitGuess() {
    if (!guessMarker || !currentPOI) return;
    clearTimer();

    const { lat: gLat, lng: gLon } = guessMarker.getLatLng();
    processGuess(gLat, gLon, timeLeft);
  }

  function processGuess(gLat, gLon, timeRemaining) {
    const distM  = Scoring.distanceMetres(gLat, gLon, currentPOI.lat, currentPOI.lon);
    const pts    = Scoring.calculate(distM, timeRemaining, ROUND_TIME);
    const grade  = Scoring.grade(distM);

    totalScore += pts;
    roundResults.push({ poi: currentPOI, distM, pts });

    showResultScreen(distM, pts, grade, gLat, gLon);
  }

  function startTimer() {
    timeLeft = ROUND_TIME;
    updateTimerUI(ROUND_TIME);
    clearTimer();

    timerInterval = setInterval(() => {
      timeLeft--;
      updateTimerUI(timeLeft);
      if (timeLeft <= 0) {
        clearTimer();
        // Time's up — if no guess, score 0 and move on
        if (!guessMarker) {
          processGuess(userLat + 999, userLon + 999, 0); // intentionally far
        } else {
          submitGuess();
        }
      }
    }, 1000);
  }

  function clearTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function updateTimerUI(sec) {
    document.getElementById('timer-num').textContent = sec;

    // SVG arc
    const pct  = sec / ROUND_TIME;
    const circ = 113;
    document.getElementById('timer-arc').style.strokeDashoffset = circ - pct * circ;

    // Colour shift as time runs out
    const arc = document.getElementById('timer-arc');
    if (sec <= 10)      arc.style.stroke = '#D32F2F';
    else if (sec <= 20) arc.style.stroke = '#F4A100';
    else                arc.style.stroke = '#FF6B00';

    // Bar
    const bar = document.getElementById('timer-bar');
    bar.style.width = (pct * 100) + '%';
    if (sec <= 10)      bar.style.background = '#D32F2F';
    else if (sec <= 20) bar.style.background = 'linear-gradient(90deg, #FF6B00, #F4A100)';
    else                bar.style.background = 'linear-gradient(90deg, #FF6B00, #F4A100)';
  }

  /* ─── Result screen ─── */
  function showResultScreen(distM, pts, grade, gLat, gLon) {
    document.getElementById('result-emoji').textContent    = grade.emoji;
    document.getElementById('result-title').textContent    = grade.title;
    document.getElementById('result-title').style.color    = grade.color;
    document.getElementById('result-distance').textContent = Scoring.formatDistance(distM);
    document.getElementById('result-points').textContent   = `+${pts} pts`;
    document.getElementById('result-poi-name').textContent = `${currentPOI.emoji} ${currentPOI.name}`;
    document.getElementById('result-poi-address').textContent = currentPOI.address || currentPOI.type;

    // Label the next button
    const nextBtn = document.getElementById('btn-next-round');
    nextBtn.textContent = currentRound >= TOTAL_ROUNDS ? 'See Final Score →' : 'Next Round →';

    showScreen('screen-result');

    // Mini result map
    setTimeout(() => {
      if (resultMap) { resultMap.remove(); resultMap = null; }

      resultMap = L.map('result-map', {
        zoomControl: false, attributionControl: false,
        dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false,
      }).setView([currentPOI.lat, currentPOI.lon], MAP_ZOOM_RESULT);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
        maxZoom: 20, subdomains: 'abcd',
      }).addTo(resultMap);

      // Actual POI marker
      const poiIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:32px; height:32px; font-size:1.3rem;
          display:flex; align-items:center; justify-content:center;
          filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6));
        ">${currentPOI.emoji}</div>`,
        iconSize: [32, 32], iconAnchor: [16, 16],
      });
      L.marker([currentPOI.lat, currentPOI.lon], { icon: poiIcon }).addTo(resultMap)
       .bindPopup(`<strong>${currentPOI.name}</strong>`).openPopup();

      // User's guess marker
      const guessIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:20px; height:20px;
          background:#FF6B00;
          border:2px solid #fff;
          border-radius:50%;
          box-shadow:0 2px 6px rgba(0,0,0,0.5);
        "></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10],
      });
      L.marker([gLat, gLon], { icon: guessIcon }).addTo(resultMap)
       .bindPopup('Your guess');

      // Line between them
      L.polyline([[gLat, gLon], [currentPOI.lat, currentPOI.lon]], {
        color: '#FF6B00', weight: 2, dashArray: '6,4', opacity: 0.7,
      }).addTo(resultMap);

      // Fit both markers
      resultMap.fitBounds([[gLat, gLon], [currentPOI.lat, currentPOI.lon]], { padding: [30, 30] });

    }, 300);
  }

  function nextRound() {
    if (currentRound >= TOTAL_ROUNDS) {
      showFinalScreen();
    } else {
      showScreen('screen-game');
      setTimeout(startRound, 200);
    }
  }

  /* ─── Final screen ─── */
  function showFinalScreen() {
    document.getElementById('final-score-num').textContent = totalScore;
    document.getElementById('final-rank').textContent = Scoring.finalRank(totalScore);

    // Round breakdown
    const container = document.getElementById('round-breakdown');
    container.innerHTML = '';
    roundResults.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'rb-row';
      row.innerHTML = `
        <span style="margin-right:0.5rem; font-size:0.7rem; opacity:0.4;">${i + 1}</span>
        <span class="rb-name">${r.poi.emoji} ${r.poi.name}</span>
        <span class="rb-dist">${Scoring.formatDistance(r.distM)}</span>
        <span class="rb-pts">+${r.pts}</span>
      `;
      container.appendChild(row);
    });

    showScreen('screen-final');
  }

  /* ─── Play again ─── */
  function playAgain() {
    allPOIs      = [];
    currentRound = 0;
    totalScore   = 0;
    roundResults = [];
    usedPOIs.clear();
    if (map) { map.remove(); map = null; }
    if (resultMap) { resultMap.remove(); resultMap = null; }

    // Reset button
    const btn = document.getElementById('btn-start');
    btn.querySelector('.btn-text').textContent = 'Share Location & Play';
    btn.disabled = false;
    document.getElementById('location-status').classList.add('hidden');

    showScreen('screen-landing');
  }

  /* ─── Screenshot capture ─── */
  async function captureResult() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        const stream  = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const video   = document.createElement('video');
        video.srcObject = stream;
        await video.play();

        const canvas  = document.getElementById('capture-canvas');
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        stream.getTracks().forEach(t => t.stop());

        const link    = document.createElement('a');
        link.download = `mohalla-master-score-${totalScore}.png`;
        link.href     = canvas.toDataURL('image/png');
        link.click();
      } else {
        alert('Screen capture is not supported in your browser. Take a screenshot manually!');
      }
    } catch (e) {
      if (e.name !== 'NotAllowedError') {
        alert('Could not capture screenshot. Take one manually!');
      }
    }
  }

  /* ─── Helpers ─── */
  // Store location events for product analytics; optionally forward to backend endpoint.
  function logLocationEvent(eventData) {
    const payload = {
      ...eventData,
      capturedAt: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      locale: navigator.language || '',
      userAgent: navigator.userAgent || '',
    };

    storeLocationEvent(payload);
    sendLocationEvent(payload);
  }

  function storeLocationEvent(payload) {
    try {
      const raw = localStorage.getItem(LOCATION_LOG_STORAGE_KEY);
      const events = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(events)) return;

      events.push(payload);
      if (events.length > LOCATION_LOG_MAX_ENTRIES) {
        events.splice(0, events.length - LOCATION_LOG_MAX_ENTRIES);
      }

      localStorage.setItem(LOCATION_LOG_STORAGE_KEY, JSON.stringify(events));
    } catch (_) {
      // Ignore analytics storage errors.
    }
  }

  function sendLocationEvent(payload) {
    if (!LOCATION_LOG_ENDPOINT) return;
    const body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(LOCATION_LOG_ENDPOINT, blob);
        return;
      } catch (_) {
        // Fall through to fetch.
      }
    }

    fetch(LOCATION_LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      mode: 'no-cors',
    }).catch(() => {});
  }

  function setStatus(el, type, msg) {
    el.textContent  = msg;
    el.className    = 'location-status' + (type ? ` ${type}` : '');
    el.classList.remove('hidden');
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  /* ─── Public API ─── */
  return {
    requestLocation,
    submitGuess,
    cancelPin,
    nextRound,
    playAgain,
    captureResult,
  };

})();

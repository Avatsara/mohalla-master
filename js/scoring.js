/**
 * scoring.js
 * Distance calculation (Haversine) and point scoring logic.
 */

const Scoring = (() => {

  /**
   * Haversine great-circle distance in metres.
   */
  function distanceMetres(lat1, lon1, lat2, lon2) {
    const R  = 6371000; // Earth radius in metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a  = Math.sin(Δφ/2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Score = 1000 × e^(−distance / 200)
   * Perfect (0m) = 1000 pts.  200m ≈ 368 pts.  500m ≈ 82 pts.
   * Also adds a time bonus: up to 200 extra pts for fast answers.
   */
  function calculate(distM, timeLeftSec, totalTimeSec) {
    const base      = Math.round(1000 * Math.exp(-distM / 200));
    const timeBonus = Math.round(200 * (timeLeftSec / totalTimeSec));
    return Math.max(0, base + timeBonus);
  }

  /**
   * Human-readable distance label.
   */
  function formatDistance(distM) {
    if (distM < 10)   return 'Right on it!';
    if (distM < 50)   return `${Math.round(distM)} metres away`;
    if (distM < 1000) return `${Math.round(distM)} metres away`;
    return `${(distM / 1000).toFixed(1)} km away`;
  }

  /**
   * Emoji + title based on distance.
   */
  function grade(distM) {
    if (distM < 25)  return { emoji: '🎯', title: 'Pinpoint!',    color: '#00C853' };
    if (distM < 75)  return { emoji: '⭐', title: 'Excellent!',   color: '#64DD17' };
    if (distM < 150) return { emoji: '👍', title: 'Good one!',    color: '#FFD600' };
    if (distM < 300) return { emoji: '🤏', title: 'Close enough', color: '#FF9800' };
    if (distM < 600) return { emoji: '😬', title: 'Way off…',     color: '#FF5722' };
    return               { emoji: '🗺️', title: 'Lost?',          color: '#B71C1C' };
  }

  /**
   * Final rank label for end screen.
   */
  function finalRank(total) {
    if (total >= 4500) return '🏅 Mohalla Legend';
    if (total >= 3500) return '🌟 Street Expert';
    if (total >= 2500) return '🗺️ Navigator';
    if (total >= 1500) return '🚶 Local Explorer';
    return                    '📍 Just Getting Started';
  }

  return { distanceMetres, calculate, formatDistance, grade, finalRank };
})();

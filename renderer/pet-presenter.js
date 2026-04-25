const PetPresenter = {
  PERSONALITY_EMOJIS: {
    quirky: '✨',
    cute: '💕',
    funny: '😂',
    absurd: '🌀',
    unhinged: '⚡',
    sardonic: '😏'
  },

  displayStage(stage) {
    return stage.charAt(0).toUpperCase() + stage.slice(1);
  },

  displayHealthColor(health) {
    if (health > 60) return '#4CAF50';
    if (health > 30) return '#FF9800';
    return '#E53935';
  },

  displayPersonalityEmoji(personality) {
    return PetPresenter.PERSONALITY_EMOJIS[personality] || '';
  },

  displayAge(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  },

  displayMoodRingColor(stats) {
    const lowest = Math.min(stats.hunger, stats.happiness, stats.energy, stats.hygiene);
    if (stats.hunger === lowest) return '#FF8C42';
    if (stats.happiness === lowest) return '#FF6B9D';
    if (stats.energy === lowest) return '#4ECDC4';
    return '#45B7A0';
  },

  HOBBY_LABELS: {
    painting: 'Painting',
    gardening: 'Garden',
    rock_stacking: 'Rocks',
    singing: 'Singing'
  },

  displayHobbyName(key) {
    return PetPresenter.HOBBY_LABELS[key] || key;
  }
};

if (typeof window !== 'undefined') {
  window.PetPresenter = PetPresenter;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PetPresenter };
}

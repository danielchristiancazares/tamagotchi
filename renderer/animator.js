const ANIM_CONST = {
  FRAME_CYCLE: 15,
  PARTICLE_MAX: 50,
  SICK_SHAKE_SPEED: 100,
  SICK_SHAKE_AMP: 1.5,
  SNEEZE_CHANCE: 0.01,
  ZZZ_FRAME_INTERVAL: 20,
  HEART_ON_FRAME: 0,
  SPRITE_SIZE: 24
};

const SEASON_CONFIG = {
  BG_COLORS: {
    spring: { day: '#E8F5E9', night: '#1a2e1a' },
    summer: { day: '#FFFDE7', night: '#1a1a0e' },
    fall:   { day: '#FFF8E1', night: '#1a1510' },
    winter: { day: '#ECEFF1', night: '#0e1520' }
  },
  PARTICLES: {
    spring: { type: 'petal', rate: 3, max: 5 },
    summer: { type: 'golden', rate: 2, max: 8 },
    fall:   { type: 'leaf', rate: 2, max: 6 },
    winter: { type: 'snow', rate: 1, max: 15 }
  },
  HOLIDAYS: [
    { month: 11, dayStart: 20, dayEnd: 25, name: 'christmas' },
    { month: 9,  dayStart: 31, dayEnd: 31, name: 'halloween' },
    { month: 1,  dayStart: 14, dayEnd: 14, name: 'valentine' },
    { month: 6,  dayStart: 4,  dayEnd: 4,  name: 'independence' }
  ],
  COMPANION_PARTICLE_MAX: 3
};

const SPRITE_PATHS = {
  poop: 'data/sprites/poop.png',
  heart: 'data/sprites/icon-heart.png',
  zzz: 'data/sprites/icon-zzz.png',
  angry: 'data/sprites/icon-angry.png',
  apple: 'data/sprites/food-apple.png',
  cookie: 'data/sprites/food-cookie.png',
  ball: 'data/sprites/toy-ball.png',
  sparkle: 'data/sprites/effect-sparkle.png',
  ghost: 'data/sprites/effect-ghost.png',
  bubble: 'data/sprites/effect-bubble.png',
  petEgg: 'data/pet-sprites/egg_normal_idle.png',
  petBaby: 'data/pet-sprites/baby_normal_idle.png',
  petChild: 'data/pet-sprites/child_normal_idle.png',
  petTeen: 'data/pet-sprites/teen_normal_idle.png',
  petAdult: 'data/pet-sprites/adult_normal_idle.png',
  seasonSpringFlower: 'data/sprites/season-spring-flower.png',
  seasonSummerSparkle: 'data/sprites/season-summer-sparkle.png',
  seasonFallLeaf1: 'data/sprites/season-fall-leaf1.png',
  seasonFallLeaf2: 'data/sprites/season-fall-leaf2.png',
  seasonWinterSnowflake: 'data/sprites/season-winter-snowflake.png',
  seasonWinterIcicle: 'data/sprites/season-winter-icicle.png'
};

class Animator {
  constructor(canvasId, config = {}) {
    this._stations = config.stations || null;

    if (config.canvas) {
      this.canvas = config.canvas;
    } else if (typeof document !== 'undefined') {
      this.canvas = document.getElementById(canvasId);
    } else {
      this.canvas = null;
    }

    if (!this.canvas) {
      throw new Error(`[Animator] Canvas #${canvasId} not found`);
    }

    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) {
      throw new Error(`[Animator] Canvas #${canvasId} does not support 2d context`);
    }

    this.frame = 0;
    this.frameTimer = 0;
    this.particles = [];
    this._pendingTimeouts = [];
    this._sprites = {};
    this._spritesLoaded = false;
    this.companionMode = false;
    this._cachedMonth = null;
    this._cachedSeason = null;
    this._cachedHoliday = null;
    this._seasonalSpawnAccum = 0;
    this.pawPrints = [];
    this._lastPetPos = { x: -1, y: -1 };

    this.ctx.imageSmoothingEnabled = false;
    this._loadSprites();
  }

  _loadSprites() {
    if (this._spritesLoaded || typeof document === 'undefined') return;

    let loaded = 0;
    const total = Object.keys(SPRITE_PATHS).length;

    for (const [key, src] of Object.entries(SPRITE_PATHS)) {
      const img = new Image();
      img.onload = () => {
        loaded++;
        if (loaded === total) {
          this._spritesLoaded = true;
          console.log('[Animator] All sprites loaded');
        }
      };
      img.onerror = () => {
        loaded++;
        console.warn(`[Animator] Failed to load sprite: ${src}`);
      };
      img.src = src;
      this._sprites[key] = img;
    }
  }

  _drawSprite(key, x, y, scale = 1) {
    const img = this._sprites[key];
    if (!img || !img.complete || !this.ctx) return false;

    const size = ANIM_CONST.SPRITE_SIZE * scale;
    this.ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    return true;
  }

  _hasSprite(key) {
    const img = this._sprites[key];
    return img && img.complete && img.naturalWidth > 0;
  }

  static _getSeason(month) {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'fall';
    return 'winter';
  }

  static _getHoliday(month, day) {
    for (const h of SEASON_CONFIG.HOLIDAYS) {
      if (month === h.month && day >= h.dayStart && day <= h.dayEnd) {
        return h.name;
      }
    }
    return null;
  }

  static _getSeasonalParticleMax(season, companionMode = false) {
    if (!season) return 0;
    return companionMode
      ? SEASON_CONFIG.COMPANION_PARTICLE_MAX
      : SEASON_CONFIG.PARTICLES[season].max;
  }

  update(pet) {
    const { px, py } = this._petScreenPos(pet);

    if (pet.isSick && Math.random() < ANIM_CONST.SNEEZE_CHANCE) {
      this.addParticle(px + 25, py - 20, 'sneeze');
    }

    if (pet.state === 'sleeping' && this.frameTimer % ANIM_CONST.ZZZ_FRAME_INTERVAL === 0) {
      let color = null;
      if (pet.dreamState === 'happy') {
        color = `hsl(${(this.frameTimer * 12) % 360}, 80%, 70%)`;
      } else if (pet.dreamState === 'nightmare') {
        color = '#8B0000';
      }
      this.addParticle(px + 20 + Math.random() * 10, py - 30, 'zzz', color);
      if (pet.dreamState === 'happy' && Math.random() < 0.3) {
        this.addParticle(px + (Math.random() - 0.5) * 30, py - 20, 'sparkle');
      }
      if (pet.dreamState === 'nightmare' && Math.random() < 0.2) {
        this.addParticle(px + (Math.random() - 0.5) * 20, py - 10, 'sneeze');
      }
    }

    if (pet.state === 'happy' && this.frameTimer === ANIM_CONST.HEART_ON_FRAME) {
      this.addParticle(px + 15, py - 20, 'heart');
    }

    if (pet.state === 'eating' && this.frameTimer % 5 === 0) {
      this.addParticle(px + 15, py, 'food');
    }

    if (pet.state === 'happy' && pet.stateTimer > 3) {
      this.addParticle(
        px + (Math.random() - 0.5) * 60,
        py - 20 + (Math.random() - 0.5) * 40,
        'sparkle'
      );
    }

    this._spawnSeasonalParticles();
  }

  _spawnSeasonalParticles() {
    const season = this._cachedSeason;
    if (!season) return;

    const config = SEASON_CONFIG.PARTICLES[season];
    const type = config.type;
    const rate = config.rate;
    const max = Animator._getSeasonalParticleMax(season, this.companionMode);

    const currentCount = this.particles.filter(p => p.type === type).length;
    if (currentCount >= max) return;

    this._seasonalSpawnAccum++;
    if (this._seasonalSpawnAccum >= rate) {
      this._seasonalSpawnAccum = 0;
      const x = Math.random() * this.canvas.width;
      const y = -5;
      this.addParticle(x, y, type);
    }
  }

  _petScreenPos(pet) {
    const pos = pet.position;
    return { px: pos.x * this.canvas.width, py: pos.y * this.canvas.height };
  }

  draw(pet) {
    const { ctx, canvas } = this;

    this._cachedHour = new Date().getHours();
    this._cachedNow = Date.now();
    this._cachedMonth = new Date().getMonth();
    this._cachedSeason = Animator._getSeason(this._cachedMonth);
    this._cachedHoliday = Animator._getHoliday(this._cachedMonth, new Date().getDate());

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { px, py } = this._petScreenPos(pet);
    if (this._lastPetPos.x >= 0) {
      const dx = px - this._lastPetPos.x;
      const dy = py - this._lastPetPos.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 12) {
        this.pawPrints.push({
          x: px - dx * 0.3,
          y: py - dy * 0.3 + 8,
          life: 3600,
          maxLife: 3600
        });
        if (this.pawPrints.length > 24) this.pawPrints.shift();
      }
    }
    this._lastPetPos = { x: px, y: py };

    if (this.companionMode) {
      this._drawCompanion(ctx, canvas, pet);
    } else {
      this._drawNormal(ctx, canvas, pet);
    }

    this.frameTimer += 1;
    if (this.frameTimer > ANIM_CONST.FRAME_CYCLE) {
      this.frame = (this.frame + 1) % 2;
      this.frameTimer = 0;
    }
  }

  _drawNormal(ctx, canvas, pet) {
    this._drawBackground(ctx, canvas);
    this._drawSkyDetails(ctx, canvas);
    this._drawStations(ctx, canvas);
    this._drawPoops(ctx, pet, canvas);
    this._drawPawPrints(ctx);

    const { px, py } = this._petScreenPos(pet);

    this._drawMoodRing(ctx, px, py, pet);

    this._drawStatusIcons(ctx, pet, px, py);

    const bounceY = this._getBounceOffset(pet);
    this._drawPet(pet, px, py + bounceY);

    this._drawStateOverlays(ctx, pet, px, py);

    this._updateAndDrawParticles(ctx);
    this._drawSickOverlay(ctx, canvas, pet);
  }

  _drawCompanion(ctx, canvas, pet) {
    this._drawBackground(ctx, canvas);
    this._drawPawPrints(ctx);

    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.55;

    this._drawMoodRing(ctx, cx, cy, pet);

    const bounceY = this._getBounceOffset(pet);
    this._drawPet(pet, cx, cy + bounceY);

    this._drawCompanionMoodIcons(ctx, canvas, pet);
    this._drawStateOverlays(ctx, pet, cx, cy);
    this._updateAndDrawParticles(ctx);
    this._drawSickOverlay(ctx, canvas, pet);
  }

  _drawCompanionMoodIcons(ctx, canvas, pet) {
    if (!pet.isAlive) return;
    const iconSize = 12;
    const margin = 8;
    let idx = 0;

    const drawIcon = (emoji) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = col === 0 ? margin : canvas.width - margin - iconSize;
      const y = margin + row * (iconSize + 4);
      ctx.font = `${iconSize}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(emoji, x, y);
      idx++;
    };

    if (pet.stats.hunger < 30) drawIcon('🍽️');
    if (pet.stats.energy < 30) drawIcon('💤');
    if (pet.stats.happiness < 30) drawIcon('😢');
    if (pet.stats.hygiene < 30) drawIcon('🧼');
    if (pet.isSick) drawIcon('🤒');
  }

  _drawStations(ctx, canvas) {
    const stations = this._stations;
    if (!stations) return;

    const floorY = canvas.height * 0.78;

    const bedX = stations.bed.x * canvas.width;
    ctx.fillStyle = '#8D6E63';
    this._fillRoundedRect(ctx, bedX - 24, floorY - 4, 48, 12, 4);
    ctx.fillStyle = '#D7CCC8';
    this._fillRoundedRect(ctx, bedX - 20, floorY - 2, 40, 8, 3);

    const foodX = stations.food.x * canvas.width;
    ctx.fillStyle = '#5D4037';
    ctx.beginPath();
    ctx.ellipse(foodX, floorY + 6, 14, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8D6E63';
    this._fillRoundedRect(ctx, foodX - 13, floorY - 2, 26, 8, 2);
    ctx.fillStyle = '#FFB74D';
    this._fillRoundedRect(ctx, foodX - 9, floorY - 5, 18, 4, 2);

    const toyX = stations.toy.x * canvas.width;
    if (this._hasSprite('ball')) {
      this._drawSprite('ball', toyX, floorY, 0.65);
    } else {
      ctx.fillStyle = '#FF6B9D';
      ctx.beginPath(); ctx.arc(toyX, floorY, 7, 0, Math.PI * 2); ctx.fill();
    }
  }

  _drawBackground(ctx, canvas) {
    const isNight = this._cachedHour < 6 || this._cachedHour > 20;
    const season = this._cachedSeason;
    const colors = SEASON_CONFIG.BG_COLORS[season];

    if (isNight) {
      ctx.fillStyle = colors.night;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (!this.companionMode) {
        ctx.fillStyle = '#F5F5DC';
        ctx.beginPath();
        ctx.arc(260, 50, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = colors.night;
        ctx.beginPath();
        ctx.arc(268, 46, 16, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = colors.day;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (!this.companionMode) {
        ctx.fillStyle = '#FFF9C4';
        ctx.beginPath();
        ctx.arc(270, 50, 18, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    this._drawSeasonalDecorations(ctx, canvas, isNight);
  }

  _drawSeasonalDecorations(ctx, canvas, isNight) {
    const season = this._cachedSeason;
    if (!season) return;

    if (season === 'winter') {
      ctx.fillStyle = 'rgba(200, 230, 255, 0.15)';
      const floorY = canvas.height * 0.85;
      ctx.fillRect(0, floorY, canvas.width, canvas.height - floorY);

      if (this._hasSprite('seasonWinterIcicle')) {
        for (let i = 0; i < 5; i++) {
          this._drawSprite('seasonWinterIcicle', 30 + i * 70, 5, 0.8);
        }
      } else {
        ctx.fillStyle = 'rgba(200, 230, 255, 0.6)';
        for (let i = 0; i < 5; i++) {
          const ix = 30 + i * 70;
          ctx.beginPath();
          ctx.moveTo(ix, 0);
          ctx.lineTo(ix + 4, 0);
          ctx.lineTo(ix + 2, 12);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    if (season === 'spring' && !isNight) {
      if (this._hasSprite('seasonSpringFlower')) {
        this._drawSprite('seasonSpringFlower', 20, canvas.height * 0.82, 0.7);
        this._drawSprite('seasonSpringFlower', canvas.width - 20, canvas.height * 0.80, 0.6);
        this._drawSprite('seasonSpringFlower', canvas.width * 0.5, canvas.height * 0.88, 0.5);
      } else {
        ctx.fillStyle = '#FFB6C1';
        this._drawProceduralFlower(ctx, 20, canvas.height * 0.82);
        this._drawProceduralFlower(ctx, canvas.width - 20, canvas.height * 0.80);
        this._drawProceduralFlower(ctx, canvas.width * 0.5, canvas.height * 0.88);
      }
    }

    if (season === 'fall') {
      ctx.fillStyle = 'rgba(139, 90, 43, 0.08)';
      ctx.fillRect(0, canvas.height * 0.85, canvas.width, canvas.height * 0.15);
    }
  }

  _drawProceduralFlower(ctx, x, y) {
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * 4, y + Math.sin(angle) * 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawSkyDetails(ctx, canvas) {
    const isNight = this._cachedHour < 6 || this._cachedHour > 20;

    if (isNight) {
      ctx.fillStyle = '#FFFFFF';
      const stars = [
        [40, 30], [90, 60], [140, 25], [180, 70],
        [230, 40], [300, 80], [50, 90], [160, 50]
      ];
      stars.forEach(([sx, sy], i) => {
        const twinkle = Math.sin(this._cachedNow / 500 + i) > 0 ? 2 : 1;
        ctx.beginPath();
        ctx.arc(sx, sy, twinkle, 0, Math.PI * 2);
        ctx.fill();
      });
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      this._drawCloud(ctx, 50, 40, 25);
      this._drawCloud(ctx, 180, 60, 30);
      this._drawCloud(ctx, 260, 35, 20);
    }
  }

  _drawCloud(ctx, x, y, size) {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.arc(x + size * 0.4, y - size * 0.2, size * 0.4, 0, Math.PI * 2);
    ctx.arc(x + size * 0.7, y, size * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawPoops(ctx, pet, canvas) {
    pet.poops.forEach(p => {
      const px = p.x * canvas.width;
      const py = p.y * canvas.height;

      if (this._hasSprite('poop')) {
        this._drawSprite('poop', px, py, 0.9);
      } else {
        ctx.fillStyle = '#8B4513';
        ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px - 4, py + 2, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 4, py + 2, 4, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  _drawStatusIcons(ctx, pet, px, py) {
    const cx = px;
    const cy = py - 45;

    if (pet.stats.hunger < 15 && pet.isAlive) {
      this._drawSprite('angry', cx + 35, cy - 10, 0.7);
    }

    if (pet.stats.happiness < 15 && pet.isAlive) {
      this._drawSprite('angry', cx - 35, cy - 10, 0.6);
    }

    if (pet.state === 'dead') {
      const floatY = Math.sin(this._cachedNow / 800) * 5;
      this._drawSprite('ghost', cx, cy + 20 + floatY, 1.0);
    }
  }

  _drawStateOverlays(ctx, pet, px, py) {
    const cx = px;
    const cy = py + 35;

    if (pet.state === 'eating') {
      const food = (Math.floor(this._cachedNow / 1000) % 2 === 0) ? 'apple' : 'cookie';
      const bounce = Math.sin(this._cachedNow / 200) * 3;
      this._drawSprite(food, cx + 30, cy - 20 + bounce, 0.8);
      this._drawSprite(food, cx - 30, cy - 15 - bounce, 0.7);
    }

    if (pet.state === 'playing') {
      const bounce = Math.abs(Math.sin(this._cachedNow / 300)) * 15;
      this._drawSprite('ball', cx + 40, cy - 10 - bounce, 0.9);
    }

    if (pet.state === 'happy' && pet.stateTimer > 0) {
      const sparklePhase = Math.sin(this._cachedNow / 400) * 8;
      this._drawSprite('sparkle', cx + 35 + sparklePhase, cy - 35, 0.7);
      this._drawSprite('sparkle', cx - 35 - sparklePhase, cy - 30, 0.6);
    }

    if (pet.state === 'eating' && this._hasSprite('bubble')) {
      if (pet.stats.hygiene < 30) {
        this._drawSprite('bubble', cx - 20, cy - 10, 0.5);
      }
    }
  }

  _getBounceOffset(pet) {
    if (pet.currentAntic === 'dance') {
      return Math.sin(this.frameTimer * 0.4) * 6 + Math.abs(Math.sin(this.frameTimer * 0.2)) * -4;
    }
    if (pet.currentAntic === 'tail_chase') {
      return Math.sin(this.frameTimer * 0.5) * 2;
    }
    if (pet.state === 'idle' || pet.state === 'happy') {
      return Math.sin(this.frameTimer * 0.2) * 3;
    }
    if (pet.state === 'playing') {
      return Math.abs(Math.sin(this.frameTimer * 0.5)) * -8;
    }
    if (pet.state === 'sad' || pet.state === 'dead') {
      return 4;
    }
    return 0;
  }

  _getPetSpriteKey(stage) {
    switch (stage) {
      case 'egg': return 'petEgg';
      case 'baby': return 'petBaby';
      case 'child': return 'petChild';
      case 'teen': return 'petTeen';
      case 'adult': return 'petAdult';
      default: return null;
    }
  }

  _drawPet(pet, x, y) {
    const size = this._getPetSize(pet);
    const spriteKey = this._getPetSpriteKey(pet.stage);
    const facing = pet.facing || 'right';

    if (spriteKey && this._hasSprite(spriteKey)) {
      this._drawPetSprite(this.ctx, spriteKey, x, y, size, facing);
    } else {
      this._drawProceduralPet(this.ctx, pet, x, y, size);
    }
  }

  _drawPetSprite(ctx, key, x, y, targetSize, facing = 'right') {
    const img = this._sprites[key];
    if (!img || !img.complete || !ctx) return;

    const drawH = targetSize * 2;
    const drawW = drawH * (img.naturalWidth / img.naturalHeight);

    if (facing === 'left') {
      ctx.save();
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -drawW / 2, y - drawH / 2, drawW, drawH);
      ctx.restore();
    } else {
      ctx.drawImage(img, x - drawW / 2, y - drawH / 2, drawW, drawH);
    }
  }

  _getPetSize(pet) {
    switch (pet.stage) {
      case 'egg': return 28;
      case 'baby': return 36;
      case 'child': return 44;
      case 'teen': return 50;
      case 'adult': return 56;
      default: return 44;
    }
  }

  _drawProceduralPet(ctx, pet, x, y, size) {
    const color = this._getPetColor(pet);
    const half = size / 2;

    let offsetX = pet.isSick
      ? Math.sin(this._cachedNow / ANIM_CONST.SICK_SHAKE_SPEED) * ANIM_CONST.SICK_SHAKE_AMP
      : 0;
    if (pet.dreamState === 'nightmare') {
      offsetX += Math.sin(this._cachedNow / 50) * 1.2;
    }
    const drawX = x + offsetX;

    ctx.fillStyle = color;
    const bodyY = pet.currentAntic === 'sit' ? y - half * 0.7 : y - half;
    const bodyH = pet.currentAntic === 'sit' ? size * 0.7 : size;
    this._fillRoundedRect(ctx, drawX - half, bodyY, size, bodyH, 8);

    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(drawX - half + 4, y + half - 6, size - 8, 6);

    const eyeY = y - half / 2;
    const eyeOffset = size * 0.22;

    if (pet.state === 'sleeping') {
      ctx.fillStyle = '#333';
      ctx.fillRect(drawX - eyeOffset - 5, eyeY, 10, 2);
      ctx.fillRect(drawX + eyeOffset - 5, eyeY, 10, 2);
    } else if (pet.state === 'sad' || pet.state === 'dead') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(drawX - eyeOffset - 5, eyeY - 2, 10, 8);
      ctx.fillRect(drawX + eyeOffset - 5, eyeY - 2, 10, 8);
      ctx.fillStyle = '#333';
      ctx.fillRect(drawX - eyeOffset - 3, eyeY + 2, 6, 4);
      ctx.fillRect(drawX + eyeOffset - 3, eyeY + 2, 6, 4);
      ctx.fillStyle = '#4ECDC4';
      ctx.fillRect(drawX - eyeOffset - 1, eyeY + 8, 2, 4);
      ctx.fillRect(drawX + eyeOffset - 1, eyeY + 8, 2, 4);
    } else {
      ctx.fillStyle = '#fff';
      ctx.fillRect(drawX - eyeOffset - 6, eyeY - 4, 12, 12);
      ctx.fillRect(drawX + eyeOffset - 6, eyeY - 4, 12, 12);
      ctx.fillStyle = '#333';
      if (pet.currentAntic === 'stare') {
        ctx.fillRect(drawX - eyeOffset - 2, eyeY + 2, 4, 4);
        ctx.fillRect(drawX + eyeOffset - 2, eyeY + 2, 4, 4);
      } else {
        const pupilOffset = pet.state === 'playing' ? 2 : 0;
        ctx.fillRect(drawX - eyeOffset - 3 + pupilOffset, eyeY, 6, 6);
        ctx.fillRect(drawX + eyeOffset - 3 + pupilOffset, eyeY, 6, 6);
      }
      ctx.fillStyle = '#fff';
      ctx.fillRect(drawX - eyeOffset, eyeY - 2, 3, 3);
      ctx.fillRect(drawX + eyeOffset, eyeY - 2, 3, 3);
    }

    if (pet.state === 'happy' || pet.state === 'eating' || pet.state === 'playing') {
      ctx.fillStyle = '#FF6B9D';
      ctx.fillRect(drawX - 5, y + half / 2 - 2, 10, 4);
      ctx.fillRect(drawX - 7, y + half / 2 - 5, 5, 5);
      ctx.fillRect(drawX + 2, y + half / 2 - 5, 5, 5);
    } else if (pet.state === 'sad' || pet.state === 'dead') {
      ctx.fillStyle = '#333';
      ctx.fillRect(drawX - 5, y + half / 2 + 2, 10, 2);
    } else if (pet.state !== 'sleeping') {
      ctx.fillStyle = '#333';
      ctx.fillRect(drawX - 4, y + half / 2 - 1, 8, 3);
    }

    if (pet.state === 'happy' || pet.state === 'eating') {
      ctx.fillStyle = 'rgba(255, 107, 157, 0.4)';
      ctx.beginPath(); ctx.arc(drawX - half - 2, y + 4, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(drawX + half + 2, y + 4, 5, 0, Math.PI * 2); ctx.fill();
    }

    if (pet.stage === 'egg') {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(drawX - 6, y - 10, 8, 8);
      ctx.fillRect(drawX + 4, y + 6, 5, 5);
      ctx.fillRect(drawX - 2, y + 2, 4, 4);
    }
    if (pet.stage === 'baby') {
      ctx.fillStyle = color;
      ctx.fillRect(drawX - 3, y - half - 10, 6, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(drawX, y - half - 12, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (pet.stage === 'teen') {
      ctx.fillStyle = color;
      ctx.fillRect(drawX - 4, y - half - 8, 8, 8);
      ctx.fillRect(drawX - 6, y - half - 6, 4, 6);
      ctx.fillRect(drawX + 2, y - half - 6, 4, 6);
    }
    if (pet.stage === 'adult') {
      if (pet.variant === 'excellent') {
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(drawX - 10, y - half - 10, 20, 6);
        ctx.fillRect(drawX - 8, y - half - 16, 5, 10);
        ctx.fillRect(drawX + 3, y - half - 16, 5, 10);
        ctx.fillRect(drawX - 2, y - half - 14, 4, 8);
        ctx.fillStyle = '#FF6B6B';
        ctx.beginPath(); ctx.arc(drawX, y - half - 10, 3, 0, Math.PI * 2); ctx.fill();
      }
      if (pet.variant === 'good') {
        ctx.fillStyle = '#FF6B9D';
        ctx.beginPath();
        ctx.moveTo(drawX, y + half - 8);
        ctx.lineTo(drawX - 10, y + half - 14);
        ctx.lineTo(drawX - 10, y + half - 2);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(drawX, y + half - 8);
        ctx.lineTo(drawX + 10, y + half - 14);
        ctx.lineTo(drawX + 10, y + half - 2);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(drawX, y + half - 8, 3, 0, Math.PI * 2); ctx.fill();
      }
    }

    if (pet.currentAntic === 'tail_chase') {
      const tailAngle = this.frameTimer * 0.5;
      const tailX = drawX + Math.cos(tailAngle) * (half + 6);
      const tailY = y + Math.sin(tailAngle) * 4;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(tailX, tailY, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  _getPetColor(pet) {
    if (pet.stage === 'dead') return '#B0BEC5';
    if (pet.stage === 'egg') return '#FFE4B5';
    if (pet.variant === 'excellent') return '#FFD700';
    if (pet.variant === 'poor') return '#8B7D6B';
    if (pet.stage === 'baby') return '#FFB6C1';
    if (pet.stage === 'child') return '#87CEEB';
    if (pet.stage === 'teen') return '#DDA0DD';
    return '#98D8C8';
  }

  _fillRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  addParticle(x, y, type, color = null) {
    const cap = this.companionMode ? 10 : ANIM_CONST.PARTICLE_MAX;
    if (this.particles.length >= cap) {
      this.particles.shift();
    }

    let vx, vy, life, maxLife, scale, sway, spriteVariant;
    switch (type) {
      case 'snow':
        vx = (Math.random() - 0.5) * 0.6;
        vy = 0.3 + Math.random() * 0.5;
        life = 300;
        maxLife = 300;
        scale = 0.6 + Math.random() * 0.4;
        sway = Math.random() * Math.PI * 2;
        break;
      case 'petal':
        vx = (Math.random() - 0.5) * 0.4;
        vy = 0.2 + Math.random() * 0.4;
        life = 240;
        maxLife = 240;
        scale = 0.5 + Math.random() * 0.3;
        sway = Math.random() * Math.PI * 2;
        break;
      case 'leaf':
        vx = (Math.random() - 0.5) * 0.8;
        vy = 0.3 + Math.random() * 0.5;
        life = 260;
        maxLife = 260;
        scale = 0.5 + Math.random() * 0.4;
        sway = Math.random() * Math.PI * 2;
        spriteVariant = Math.random() > 0.5 ? 'seasonFallLeaf1' : 'seasonFallLeaf2';
        break;
      case 'golden':
        vx = (Math.random() - 0.5) * 0.2;
        vy = (Math.random() - 0.5) * 0.2;
        life = 180;
        maxLife = 180;
        scale = 0.4 + Math.random() * 0.3;
        break;
      default:
        vx = (Math.random() - 0.5) * 1.5;
        vy = type === 'zzz' ? -0.5 : type === 'heart' ? -1.5 : type === 'sneeze' ? -0.8 : (Math.random() - 0.5);
        life = type === 'zzz' ? 120 : type === 'sneeze' ? 80 : 60;
        maxLife = life;
        scale = type === 'zzz' ? 0.8 : 1;
    }

    const p = { x, y, vx, vy, life, maxLife, type, scale };
    if (sway !== undefined) p.sway = sway;
    if (spriteVariant !== undefined) p.spriteVariant = spriteVariant;
    if (color) p.color = color;
    this.particles.push(p);
  }

  _updateAndDrawParticles(ctx) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      if (p.sway !== undefined) {
        p.x += p.vx + Math.sin(p.sway + p.life * 0.03) * 0.3;
      } else {
        p.x += p.vx;
      }
      p.y += p.vy;
      p.life--;
      const alpha = p.life / p.maxLife;

      if (p.type === 'heart') {
        if (this._hasSprite('heart')) {
          ctx.globalAlpha = alpha;
          this._drawSprite('heart', p.x, p.y, p.scale);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = `rgba(255, 107, 157, ${alpha})`;
          ctx.font = `${12 * p.scale}px "Press Start 2P"`;
          ctx.fillText('♥', p.x, p.y);
        }
      } else if (p.type === 'zzz') {
        if (this._hasSprite('zzz') && !p.color) {
          ctx.globalAlpha = alpha;
          this._drawSprite('zzz', p.x, p.y, p.scale);
          ctx.globalAlpha = 1;
        } else {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color || '#FFFFFF';
          ctx.font = `${10 * p.scale}px "Press Start 2P"`;
          ctx.fillText('z', p.x, p.y);
          ctx.globalAlpha = 1;
        }
        p.scale += 0.005;
      } else if (p.type === 'food') {
        ctx.fillStyle = `rgba(139, 69, 19, ${alpha})`;
        ctx.fillRect(p.x, p.y, 3, 3);
        p.vy += 0.05;
      } else if (p.type === 'sneeze') {
        ctx.fillStyle = `rgba(76, 175, 80, ${alpha})`;
        ctx.font = `${10 * p.scale}px "Press Start 2P"`;
        ctx.fillText('*', p.x, p.y);
        p.scale += 0.003;
      } else if (p.type === 'sparkle') {
        if (this._hasSprite('sparkle')) {
          ctx.globalAlpha = alpha;
          this._drawSprite('sparkle', p.x, p.y, p.scale * 0.6);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
          ctx.fillRect(p.x, p.y, 2, 2);
        }
      } else if (p.type === 'snow') {
        const spriteKey = 'seasonWinterSnowflake';
        if (this._hasSprite(spriteKey)) {
          ctx.globalAlpha = alpha;
          this._drawSprite(spriteKey, p.x, p.y, p.scale * 0.5);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2 * p.scale, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.type === 'petal') {
        ctx.fillStyle = `rgba(255, 182, 193, ${alpha})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 3 * p.scale, 2 * p.scale, p.life * 0.02, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'leaf') {
        const spriteKey = p.spriteVariant || 'seasonFallLeaf1';
        if (this._hasSprite(spriteKey)) {
          ctx.globalAlpha = alpha;
          this._drawSprite(spriteKey, p.x, p.y, p.scale * 0.5);
          ctx.globalAlpha = 1;
        } else {
          const colors = ['rgba(255, 140, 0, ', 'rgba(139, 69, 19, ', 'rgba(178, 34, 34, '];
          ctx.fillStyle = colors[Math.floor(p.sway * 3) % colors.length] + alpha + ')';
          ctx.fillRect(p.x, p.y, 4 * p.scale, 3 * p.scale);
        }
      } else if (p.type === 'golden') {
        const spriteKey = 'seasonSummerSparkle';
        if (this._hasSprite(spriteKey)) {
          ctx.globalAlpha = alpha * 0.7;
          this._drawSprite(spriteKey, p.x, p.y, p.scale * 0.5);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.7})`;
          ctx.fillRect(p.x, p.y, 2 * p.scale, 2 * p.scale);
        }
      }

      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  _drawSickOverlay(ctx, canvas, pet) {
    if (pet.isSick) {
      ctx.fillStyle = 'rgba(0, 255, 0, 0.12)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  _drawMoodRing(ctx, px, py, pet) {
    if (!pet.isAlive) return;
    if (typeof ctx.createRadialGradient !== 'function') return;
    const color = PetPresenter.displayMoodRingColor(pet.stats);
    const size = this._getPetSize(pet) * 1.6;
    const gradient = ctx.createRadialGradient(px, py, size * 0.3, px, py, size);
    gradient.addColorStop(0, color + '18');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawPawPrints(ctx) {
    for (let i = this.pawPrints.length - 1; i >= 0; i--) {
      const pp = this.pawPrints[i];
      pp.life--;
      if (pp.life <= 0) {
        this.pawPrints.splice(i, 1);
        continue;
      }
      const alpha = (pp.life / pp.maxLife) * 0.3;
      ctx.fillStyle = `rgba(120, 110, 100, ${alpha})`;
      ctx.beginPath(); ctx.ellipse(pp.x - 2, pp.y, 2, 1.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(pp.x + 2, pp.y, 2, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawGameOver(pet) {
    const ctx = this.ctx;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#E53935';
    ctx.font = '20px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 30);

    ctx.fillStyle = '#FFF8F0';
    ctx.font = '10px "Press Start 2P"';
    ctx.fillText(`${pet.name} lived ${PetPresenter.displayAge(pet.age)}`, this.canvas.width / 2, this.canvas.height / 2 + 5);
    ctx.fillText(`Reached: ${PetPresenter.displayStage(pet.stage)}`, this.canvas.width / 2, this.canvas.height / 2 + 25);
  }

  spawnHearts(count = 3, pet = null) {
    let cx, cy;
    if (pet) {
      const pos = this._petScreenPos(pet);
      cx = pos.px;
      cy = pos.py - 20;
    } else {
      cx = this.canvas.width / 2;
      cy = this.canvas.height / 2 - 20;
    }
    for (let i = 0; i < count; i++) {
      const id = setTimeout(() => {
        this.addParticle(
          cx + (Math.random() - 0.5) * 40,
          cy,
          'heart'
        );
      }, i * 200);
      this._pendingTimeouts.push(id);
    }
  }

  clearPendingTimeouts() {
    this._pendingTimeouts.forEach(id => clearTimeout(id));
    this._pendingTimeouts = [];
  }

  reset() {
    this.particles = [];
    this.pawPrints = [];
    this._lastPetPos = { x: -1, y: -1 };
    this.frame = 0;
    this.frameTimer = 0;
    this._seasonalSpawnAccum = 0;
    this._cachedMonth = null;
    this._cachedSeason = null;
    this._cachedHoliday = null;
    this._cachedHour = null;
    this._cachedNow = null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Animator, SEASON_CONFIG };
}

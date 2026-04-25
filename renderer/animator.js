// ============================================
// Tamagotchi Canvas Animator
// Renders pet, background, particles, and sprite overlays.
// update() = logic (spawn particles). draw() = pure rendering.
// ============================================

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

/** Sprite paths relative to renderer/ */
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
  bubble: 'data/sprites/effect-bubble.png'
};

class Animator {
  constructor(canvasId) {
    this.canvas = typeof document !== 'undefined' ? document.getElementById(canvasId) : null;
    this.ctx = null;
    this.frame = 0;
    this.frameTimer = 0;
    this.particles = [];
    this._pendingTimeouts = [];
    this._sprites = {};      // loaded Image objects
    this._spritesLoaded = false;

    if (!this.canvas) {
      if (typeof document !== 'undefined') {
        console.error(`[Animator] Canvas #${canvasId} not found`);
      }
      return;
    }

    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this._loadSprites();
  }

  /** Lazy-load all sprite images */
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

  /** Draw a sprite by key at x,y with optional scale */
  _drawSprite(key, x, y, scale = 1) {
    const img = this._sprites[key];
    if (!img || !img.complete || !this.ctx) return false;

    const size = ANIM_CONST.SPRITE_SIZE * scale;
    this.ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    return true;
  }

  /** Check if a sprite is ready to draw */
  _hasSprite(key) {
    const img = this._sprites[key];
    return img && img.complete && img.naturalWidth > 0;
  }

  // ---------- Update (logic, called from game tick) ----------

  update(pet) {
    this._cachedHour = new Date().getHours();
    this._cachedNow = Date.now();

    if (pet.isSick && Math.random() < ANIM_CONST.SNEEZE_CHANCE) {
      this.addParticle(
        this.canvas.width / 2 + 25,
        this.canvas.height / 2 - 20,
        'sneeze'
      );
    }

    if (pet.state === 'sleeping' && this.frameTimer % ANIM_CONST.ZZZ_FRAME_INTERVAL === 0) {
      this.addParticle(
        this.canvas.width / 2 + 20 + Math.random() * 10,
        this.canvas.height / 2 - 30,
        'zzz'
      );
    }

    if (pet.state === 'happy' && this.frameTimer === ANIM_CONST.HEART_ON_FRAME) {
      this.addParticle(
        this.canvas.width / 2 + 15,
        this.canvas.height / 2 - 20,
        'heart'
      );
    }

    if (pet.state === 'eating' && this.frameTimer % 5 === 0) {
      this.addParticle(this.canvas.width / 2 + 15, this.canvas.height / 2, 'food');
    }

    // Evolution sparkles
    if (pet.state === 'happy' && pet.stateTimer > 3) {
      this.addParticle(
        this.canvas.width / 2 + (Math.random() - 0.5) * 60,
        this.canvas.height / 2 - 20 + (Math.random() - 0.5) * 40,
        'sparkle'
      );
    }
  }

  // ---------- Draw (pure rendering) ----------

  draw(pet) {
    const { ctx, canvas } = this;
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this._drawBackground(ctx, canvas);
    this._drawSkyDetails(ctx, canvas);
    this._drawPoops(ctx, pet, canvas);

    // Status emotion icons (floating above pet)
    this._drawStatusIcons(ctx, pet, canvas);

    const bounceY = this._getBounceOffset(pet);
    this._drawPet(pet, canvas.width / 2, canvas.height / 2 - 10 + bounceY);

    // State-specific overlays
    this._drawStateOverlays(ctx, pet, canvas);

    this._updateAndDrawParticles(ctx);
    this._drawSickOverlay(ctx, canvas, pet);

    this.frameTimer += 1;
    if (this.frameTimer > ANIM_CONST.FRAME_CYCLE) {
      this.frame = (this.frame + 1) % 2;
      this.frameTimer = 0;
    }
  }

  // ---------- Background ----------

  _drawBackground(ctx, canvas) {
    const isNight = this._cachedHour < 6 || this._cachedHour > 20;

    if (isNight) {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#F5F5DC';
      ctx.beginPath();
      ctx.arc(260, 50, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.arc(268, 46, 16, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#E8F5E9';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#FFF9C4';
      ctx.beginPath();
      ctx.arc(270, 50, 18, 0, Math.PI * 2);
      ctx.fill();
    }
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

  // ---------- Poops (sprite or procedural fallback) ----------

  _drawPoops(ctx, pet, canvas) {
    pet.poops.forEach(p => {
      const px = p.x * canvas.width;
      const py = p.y * canvas.height;

      if (this._hasSprite('poop')) {
        this._drawSprite('poop', px, py, 0.9);
      } else {
        // Procedural fallback
        ctx.fillStyle = '#8B4513';
        ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px - 4, py + 2, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 4, py + 2, 4, 0, Math.PI * 2); ctx.fill();
      }
    });
  }

  // ---------- Status emotion icons ----------

  _drawStatusIcons(ctx, pet, canvas) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2 - 55;

    // Very hungry → angry cloud
    if (pet.stats.hunger < 15 && pet.isAlive) {
      this._drawSprite('angry', cx + 35, cy - 10, 0.7);
    }

    // Very sad → sad indicator
    if (pet.stats.happiness < 15 && pet.isAlive) {
      this._drawSprite('angry', cx - 35, cy - 10, 0.6);
    }

    // Dead → ghost floats up
    if (pet.state === 'dead') {
      const floatY = Math.sin(this._cachedNow / 800) * 5;
      this._drawSprite('ghost', cx, cy + 20 + floatY, 1.0);
    }
  }

  // ---------- State overlays (food, toy, bubble, sparkle) ----------

  _drawStateOverlays(ctx, pet, canvas) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2 + 25;

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
      // Sparkle during happy/evolve
      const sparklePhase = Math.sin(this._cachedNow / 400) * 8;
      this._drawSprite('sparkle', cx + 35 + sparklePhase, cy - 35, 0.7);
      this._drawSprite('sparkle', cx - 35 - sparklePhase, cy - 30, 0.6);
    }

    if (pet.state === 'eating' && this._hasSprite('bubble')) {
      // Soap bubbles during eating (represents cleaning after messy eating)
      if (pet.stats.hygiene < 30) {
        this._drawSprite('bubble', cx - 20, cy - 10, 0.5);
      }
    }
  }

  // ---------- Pet body ----------

  _getBounceOffset(pet) {
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

  _drawPet(pet, x, y) {
    const size = this._getPetSize(pet);
    this._drawProceduralPet(this.ctx, pet, x, y, size);
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

    const offsetX = pet.isSick
      ? Math.sin(this._cachedNow / ANIM_CONST.SICK_SHAKE_SPEED) * ANIM_CONST.SICK_SHAKE_AMP
      : 0;
    const drawX = x + offsetX;

    // Body
    ctx.fillStyle = color;
    this._fillRoundedRect(ctx, drawX - half, y - half, size, size, 8);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(drawX - half + 4, y + half - 6, size - 8, 6);

    // Eyes
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
      const pupilOffset = pet.state === 'playing' ? 2 : 0;
      ctx.fillRect(drawX - eyeOffset - 3 + pupilOffset, eyeY, 6, 6);
      ctx.fillRect(drawX + eyeOffset - 3 + pupilOffset, eyeY, 6, 6);
      ctx.fillStyle = '#fff';
      ctx.fillRect(drawX - eyeOffset, eyeY - 2, 3, 3);
      ctx.fillRect(drawX + eyeOffset, eyeY - 2, 3, 3);
    }

    // Mouth
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

    // Cheeks
    if (pet.state === 'happy' || pet.state === 'eating') {
      ctx.fillStyle = 'rgba(255, 107, 157, 0.4)';
      ctx.beginPath(); ctx.arc(drawX - half - 2, y + 4, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(drawX + half + 2, y + 4, 5, 0, Math.PI * 2); ctx.fill();
    }

    // Stage features
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

  // ---------- Particles ----------

  addParticle(x, y, type) {
    if (this.particles.length >= ANIM_CONST.PARTICLE_MAX) {
      this.particles.shift();
    }
    this.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 1.5,
      vy: type === 'zzz' ? -0.5 : type === 'heart' ? -1.5 : type === 'sneeze' ? -0.8 : (Math.random() - 0.5),
      life: type === 'zzz' ? 120 : type === 'sneeze' ? 80 : 60,
      maxLife: type === 'zzz' ? 120 : type === 'sneeze' ? 80 : 60,
      type,
      scale: type === 'zzz' ? 0.8 : 1
    });
  }

  _updateAndDrawParticles(ctx) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
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
        if (this._hasSprite('zzz')) {
          ctx.globalAlpha = alpha;
          this._drawSprite('zzz', p.x, p.y, p.scale);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.font = `${10 * p.scale}px "Press Start 2P"`;
          ctx.fillText('z', p.x, p.y);
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

  spawnHearts(count = 3) {
    for (let i = 0; i < count; i++) {
      const id = setTimeout(() => {
        this.addParticle(
          this.canvas.width / 2 + (Math.random() - 0.5) * 40,
          this.canvas.height / 2 - 20,
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
}

// Conditional export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Animator };
}

/* ==========================================================
   JUEGO 1 — EL MUNDO AUDIOVISUAL (Plataformas submarinas)
   ========================================================== */

const Game1 = (() => {
  let canvas, ctx, raf, running = false;
  let W = 0, H = 0, DPR = 1;
  let pulpoImg = new Image();
  const keys = { left:false, right:false, jump:false };

  const GRAVITY = 0.55;
  const MOVE_SPEED = 4.2;
  const JUMP_FORCE = -11.5;
  const GROUND_FRICTION = 0.82;

  let player, camX, level, levelIndex, score, lives, startTime, items;

  const OBSTACLE_TYPES = ['camara','tripode','claqueta','luz','monitor','cable'];
  const COLLECT_TYPES = ['claqueta','lente','memoria','estrella','foco'];

  function buildLevel(idx){
    // genera un nivel procedural con dificultad creciente
    const rnd = mulberry32(1000 + idx*77);
    const groundY = H - 70;
    const platforms = [{x:0, y:groundY, w:900, h:120}];
    const obstacles = [];
    const collectibles = [];
    let cursorX = 260;
    const segments = 8 + idx*2;
    for(let i=0;i<segments;i++){
      const gap = 90 + rnd()*70;
      const platW = 140 + rnd()*160;
      const platY = groundY - (rnd() > 0.5 ? (60 + rnd()*90) : 0);
      cursorX += gap;
      platforms.push({x:cursorX, y:platY, w:platW, h: (H - platY)});
      if(rnd() > 0.35){
        obstacles.push({
          x: cursorX + platW*0.3 + rnd()*platW*0.3, y: platY - 34, w:34, h:34,
          type: OBSTACLE_TYPES[Math.floor(rnd()*OBSTACLE_TYPES.length)]
        });
      }
      for(let c=0;c<2;c++){
        if(rnd() > 0.4){
          collectibles.push({
            x: cursorX + rnd()*platW, y: platY - 60 - rnd()*40, r:12, collected:false,
            type: COLLECT_TYPES[Math.floor(rnd()*COLLECT_TYPES.length)]
          });
        }
      }
      cursorX += platW;
    }
    const goalX = cursorX + 140;
    platforms.push({x: cursorX + 40, y: groundY, w: 260, h: 120});
    return { platforms, obstacles, collectibles, goalX, groundY, width: goalX + 200 };
  }

  function mulberry32(seed){
    return function(){
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function resize(){
    const stage = canvas.parentElement;
    W = stage.clientWidth; H = stage.clientHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W+'px'; canvas.style.height = H+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }

  function resetPlayer(){
    player = { x: 60, y: H-160, w:40, h:40, vx:0, vy:0, onGround:false, dir:1, anim:0 };
    camX = 0;
  }

  function startLevel(idx){
    levelIndex = idx;
    level = buildLevel(idx);
    resetPlayer();
    document.getElementById('g1-level').textContent = idx + 1;
  }

  function start(){
    canvas = document.getElementById('canvas-g1');
    ctx = canvas.getContext('2d');
    pulpoImg.src = App.pulpoSrc;
    resize();
    window.addEventListener('resize', resize);
    score = 0; lives = 3; items = 0; startTime = Date.now();
    updateScoreHUD();
    startLevel(0);
    bindControls();
    running = true;
    cancelAnimationFrame(raf);
    loop();
  }

  function stop(){
    running = false;
    cancelAnimationFrame(raf);
    unbindControls();
  }

  function updateScoreHUD(){
    document.getElementById('g1-score').textContent = String(score).padStart(6,'0');
  }

  /* ---------------- controles ---------------- */
  function onKeyDown(e){
    if(['ArrowLeft','a','A'].includes(e.key)) keys.left = true;
    if(['ArrowRight','d','D'].includes(e.key)) keys.right = true;
    if(['ArrowUp','w','W',' '].includes(e.key)) keys.jump = true;
  }
  function onKeyUp(e){
    if(['ArrowLeft','a','A'].includes(e.key)) keys.left = false;
    if(['ArrowRight','d','D'].includes(e.key)) keys.right = false;
    if(['ArrowUp','w','W',' '].includes(e.key)) keys.jump = false;
  }
  let touchHandlers = [];
  function bindControls(){
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    const wrap = document.getElementById('touch-g1');
    wrap.querySelectorAll('[data-k]').forEach(btn => {
      const k = btn.dataset.k;
      const down = (ev) => { ev.preventDefault(); keys[k] = true; };
      const up = (ev) => { ev.preventDefault(); keys[k] = false; };
      btn.addEventListener('touchstart', down, {passive:false});
      btn.addEventListener('touchend', up, {passive:false});
      btn.addEventListener('mousedown', down);
      btn.addEventListener('mouseup', up);
      btn.addEventListener('mouseleave', up);
      touchHandlers.push({btn, down, up});
    });
  }
  function unbindControls(){
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    touchHandlers.forEach(({btn,down,up}) => {
      btn.removeEventListener('touchstart', down);
      btn.removeEventListener('touchend', up);
      btn.removeEventListener('mousedown', down);
      btn.removeEventListener('mouseup', up);
      btn.removeEventListener('mouseleave', up);
    });
    touchHandlers = [];
    keys.left = keys.right = keys.jump = false;
  }

  /* ---------------- física ---------------- */
  function rectsOverlap(a,b){
    return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
  }

  function update(){
    if(keys.left){ player.vx -= 0.9; player.dir = -1; }
    if(keys.right){ player.vx += 0.9; player.dir = 1; }
    player.vx *= GROUND_FRICTION;
    player.vx = Math.max(-MOVE_SPEED, Math.min(MOVE_SPEED, player.vx));

    if(keys.jump && player.onGround){
      player.vy = JUMP_FORCE;
      player.onGround = false;
      App.playSfx('jump');
    }
    // gravedad reducida (sensación acuática)
    player.vy += GRAVITY;
    if(player.vy > 12) player.vy = 12;

    player.x += player.vx;
    player.y += player.vy;
    player.anim += Math.abs(player.vx) * 0.2 + 0.05;

    if(player.x < 0) player.x = 0;

    player.onGround = false;
    for(const p of level.platforms){
      const feet = { x: player.x+6, y: player.y+player.h, w: player.w-12, h: 8 };
      if(player.vy >= 0 && feet.x < p.x+p.w && feet.x+feet.w > p.x &&
         player.y+player.h <= p.y+16 && player.y+player.h+player.vy >= p.y){
        player.y = p.y - player.h;
        player.vy = 0;
        player.onGround = true;
      }
    }

    if(player.y > H + 200){ // cayó al vacío
      loseLife();
    }

    for(const o of level.obstacles){
      if(rectsOverlap(player, o)){
        loseLife();
        break;
      }
    }

    for(const c of level.collectibles){
      if(c.collected) continue;
      const dx = (player.x+player.w/2) - c.x, dy = (player.y+player.h/2) - c.y;
      if(Math.sqrt(dx*dx+dy*dy) < 30){
        c.collected = true;
        score += 100; items++;
        updateScoreHUD();
        App.playSfx('collect');
      }
    }

    if(player.x + player.w/2 > level.goalX){
      completeLevel();
    }

    camX = Math.max(0, player.x - W*0.35);
  }

  function loseLife(){
    lives--;
    App.playSfx('hit');
    if(lives <= 0){
      running = false;
      cancelAnimationFrame(raf);
      App.onGameOver();
    } else {
      resetPlayer();
    }
  }

  function completeLevel(){
    if(levelIndex < 1){
      startLevel(levelIndex + 1);
    } else {
      running = false;
      cancelAnimationFrame(raf);
      const time = Math.round((Date.now()-startTime)/1000);
      App.onGameWin(1, { score, time, items });
    }
  }

  /* ---------------- dibujo ---------------- */
  const ICONS = {
    camara:'🎥', tripode:'🎦', claqueta:'🎬', luz:'💡', monitor:'🖥️', cable:'🔌',
    lente:'📷', memoria:'💾', estrella:'⭐', foco:'🔦'
  };

  function draw(){
    ctx.clearRect(0,0,W,H);
    // fondo con rayos de luz
    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,'#2C5670'); grad.addColorStop(1,'#0B171E');
    ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);

    ctx.save();
    ctx.translate(-camX, 0);

    // plataformas
    for(const p of level.platforms){
      ctx.fillStyle = '#1E3C4D';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#EF7A22';
      ctx.fillRect(p.x, p.y, p.w, 6);
    }

    // meta
    ctx.fillStyle = '#EF7A22';
    ctx.font = '48px sans-serif';
    ctx.fillText('🏁', level.goalX-10, level.groundY-10);

    // obstáculos
    ctx.font = '30px sans-serif';
    for(const o of level.obstacles){
      ctx.fillText(ICONS[o.type]||'⚠️', o.x-14, o.y+28);
    }

    // coleccionables
    ctx.font = '24px sans-serif';
    for(const c of level.collectibles){
      if(c.collected) continue;
      const bob = Math.sin(Date.now()/300 + c.x) * 4;
      ctx.fillText(ICONS[c.type]||'⭐', c.x-12, c.y+8+bob);
    }

    // pulpo
    const bob = Math.sin(player.anim) * 3;
    ctx.save();
    ctx.translate(player.x+player.w/2, player.y+player.h/2+bob);
    if(player.dir < 0) ctx.scale(-1,1);
    if(pulpoImg.complete && pulpoImg.naturalWidth){
      ctx.drawImage(pulpoImg, -player.w/2, -player.h/2, player.w, player.h);
    } else {
      ctx.fillStyle = '#EF7A22';
      ctx.beginPath(); ctx.arc(0,0,player.w/2,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();

    ctx.restore();

    // vidas
    ctx.font = '20px sans-serif';
    for(let i=0;i<lives;i++) ctx.fillText('🐙', 16 + i*28, H-16);
  }

  function loop(){
    if(!running) return;
    update();
    draw();
    raf = requestAnimationFrame(loop);
  }

  return { start, stop };
})();

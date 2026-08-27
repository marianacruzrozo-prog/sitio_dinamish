/* ==========================================================
   JUEGO 3 — PULPO-MAN (Laberinto submarino, tipo arcade)
   ========================================================== */

const Game3 = (() => {
  let canvas, ctx, W, H, DPR;
  let pulpoImg = new Image();
  let running = false, raf;
  let cols, rows, cellSize, mazeOffX, mazeOffY;
  let walls; // grid[r][c] = {n,s,e,w}
  let dots, powerPellets, totalToCollect, collected;
  let player, enemies, score, lives, startTime, items;
  let levelIndex, frightTimer = 0, speedBoostTimer = 0, message = null;

  const DIRS = { up:{dx:0,dy:-1}, down:{dx:0,dy:1}, left:{dx:-1,dy:0}, right:{dx:1,dy:0}, none:{dx:0,dy:0} };
  const OPP = { up:'down', down:'up', left:'right', right:'left', none:'none' };

  const LEVELS = [
    { cols:11, rows:9,  enemies:1, speed:1.6 },
    { cols:13, rows:9,  enemies:2, speed:1.85 },
    { cols:13, rows:11, enemies:3, speed:2.1 },
  ];

  function mulberry32(seed){
    return function(){
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------------- generación del laberinto (DFS backtracker) ---------------- */
  function generateMaze(c, r, seed){
    const grid = [];
    for(let i=0;i<r;i++){
      const row = [];
      for(let j=0;j<c;j++) row.push({n:true,s:true,e:true,w:true,visited:false});
      grid.push(row);
    }
    const rnd = mulberry32(seed);
    const stack = [[0,0]];
    grid[0][0].visited = true;
    while(stack.length){
      const [cr,cc] = stack[stack.length-1];
      const neighbors = [];
      if(cr>0 && !grid[cr-1][cc].visited) neighbors.push(['n',cr-1,cc]);
      if(cr<r-1 && !grid[cr+1][cc].visited) neighbors.push(['s',cr+1,cc]);
      if(cc>0 && !grid[cr][cc-1].visited) neighbors.push(['w',cr,cc-1]);
      if(cc<c-1 && !grid[cr][cc+1].visited) neighbors.push(['e',cr,cc+1]);
      if(neighbors.length === 0){ stack.pop(); continue; }
      const [dir, nr, nc] = neighbors[Math.floor(rnd()*neighbors.length)];
      const opp = { n:'s', s:'n', e:'w', w:'e' };
      grid[cr][cc][dir] = false;
      grid[nr][nc][opp[dir]] = false;
      grid[nr][nc].visited = true;
      stack.push([nr,nc]);
    }
    // agrega algunos atajos extra para que no sea un laberinto perfecto (más divertido)
    for(let i=0;i<Math.floor(c*r*0.06);i++){
      const rr = Math.floor(rnd()*r), cc = Math.floor(rnd()*c);
      const dirs = ['n','s','e','w'];
      const d = dirs[Math.floor(rnd()*4)];
      const deltas = { n:[-1,0], s:[1,0], e:[0,1], w:[0,-1] };
      const [dr,dc] = deltas[d];
      const tr = rr+dr, tc = cc+dc;
      if(tr>=0 && tr<r && tc>=0 && tc<c){
        const opp = { n:'s', s:'n', e:'w', w:'e' };
        grid[rr][cc][d] = false;
        grid[tr][tc][opp[d]] = false;
      }
    }
    return grid;
  }

  function wallOpen(r,c,dir){
    if(r<0||r>=rows||c<0||c>=cols) return false;
    return !walls[r][c][dir];
  }

  function cellCenter(r,c){ return { x: mazeOffX + c*cellSize + cellSize/2, y: mazeOffY + r*cellSize + cellSize/2 }; }

  /* ---------------- construcción de nivel ---------------- */
  function buildLevel(idx){
    levelIndex = idx;
    const cfg = LEVELS[idx];
    cols = cfg.cols; rows = cfg.rows;
    walls = generateMaze(cols, rows, 42 + idx*991);
    layoutCanvas();

    dots = [];
    powerPellets = [];
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        if((r===0&&c===0) || (r===rows-1&&c===cols-1)) continue;
        dots.push({ r, c, collected:false, power:false });
      }
    }
    // pellets de poder en las 4 esquinas disponibles
    const corners = [[0,cols-1],[rows-1,0],[Math.floor(rows/2), Math.floor(cols/2)]];
    corners.forEach(([r,c]) => {
      const d = dots.find(d => d.r===r && d.c===c);
      if(d) d.power = true;
    });

    totalToCollect = dots.length;
    collected = 0;

    const start = cellCenter(0,0);
    player = { x:start.x, y:start.y, r:0, c:0, dir:'none', nextDir:'none', mouth:0 };

    enemies = [];
    const enemyDefs = [
      { key:'camara', icon:'📷', name:'CÁMARA FANTASMA', behavior:'chase' },
      { key:'medusa', icon:'🎐', name:'MEDUSA LED', behavior:'patrol' },
      { key:'robot',  icon:'🤖', name:'ROBOT DE PRODUCCIÓN', behavior:'wander' },
    ];
    for(let i=0;i<cfg.enemies;i++){
      const def = enemyDefs[i % enemyDefs.length];
      const er = rows-1, ec = cols-1;
      const p = cellCenter(er, ec - Math.min(i, cols-1));
      enemies.push({ ...def, x:p.x, y:p.y, r:er, c:ec-Math.min(i,cols-1), dir:'none', speed: cfg.speed, frightened:false });
    }

    document.getElementById('g3-level').textContent = idx+1;
    frightTimer = 0; speedBoostTimer = 0;
  }

  function layoutCanvas(){
    const stage = canvas.parentElement;
    W = stage.clientWidth; H = stage.clientHeight;
    DPR = Math.min(window.devicePixelRatio||1, 2);
    canvas.width = W*DPR; canvas.height = H*DPR;
    canvas.style.width = W+'px'; canvas.style.height = H+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
    const margin = 40;
    cellSize = Math.floor(Math.min((W-margin)/cols, (H-margin-40)/rows));
    mazeOffX = (W - cols*cellSize)/2;
    mazeOffY = 50 + (H-40 - rows*cellSize)/2;
  }

  /* ---------------- controles ---------------- */
  const keyToDir = { ArrowUp:'up', w:'up', W:'up', ArrowDown:'down', s:'down', S:'down',
    ArrowLeft:'left', a:'left', A:'left', ArrowRight:'right', d:'right', D:'right' };
  function onKeyDown(e){
    const dir = keyToDir[e.key];
    if(dir) player.nextDir = dir;
  }
  let touchHandlers = [];
  function bindControls(){
    window.addEventListener('keydown', onKeyDown);
    const wrap = document.getElementById('touch-g3');
    wrap.querySelectorAll('[data-k]').forEach(btn => {
      const k = btn.dataset.k;
      const press = (ev) => { ev.preventDefault(); player.nextDir = k; };
      btn.addEventListener('touchstart', press, {passive:false});
      btn.addEventListener('mousedown', press);
      touchHandlers.push({btn, press});
    });
  }
  function unbindControls(){
    window.removeEventListener('keydown', onKeyDown);
    touchHandlers.forEach(({btn,press}) => {
      btn.removeEventListener('touchstart', press);
      btn.removeEventListener('mousedown', press);
    });
    touchHandlers = [];
  }

  /* ---------------- movimiento tipo grid con centros de celda ---------------- */
  function tryMove(entity, baseSpeed){
    const speed = baseSpeed;
    const center = cellCenter(entity.r, entity.c);
    const alignedX = Math.abs(entity.x - center.x) < speed*0.6;
    const alignedY = Math.abs(entity.y - center.y) < speed*0.6;
    if(alignedX && alignedY){
      entity.x = center.x; entity.y = center.y;
      if(entity.nextDir && entity.nextDir !== 'none'){
        const nd = DIRS[entity.nextDir];
        if(wallOpen(entity.r, entity.c, entity.nextDir)){
          entity.dir = entity.nextDir;
        }
      }
      if(entity.dir !== 'none' && !wallOpen(entity.r, entity.c, entity.dir)){
        entity.dir = 'none';
      }
      // actualizar índice de celda si nos movemos a la siguiente
      const d = DIRS[entity.dir];
      const targetR = entity.r + d.dy, targetC = entity.c + d.dx;
      entity._movingTo = (entity.dir !== 'none') ? [targetR, targetC] : null;
    }
    if(entity.dir !== 'none'){
      const d = DIRS[entity.dir];
      entity.x += d.dx * speed;
      entity.y += d.dy * speed;
      if(entity._movingTo){
        const tgt = cellCenter(entity._movingTo[0], entity._movingTo[1]);
        const passed = (d.dx>0 && entity.x>=tgt.x) || (d.dx<0 && entity.x<=tgt.x) ||
                        (d.dy>0 && entity.y>=tgt.y) || (d.dy<0 && entity.y<=tgt.y);
        if(passed){
          entity.r = entity._movingTo[0]; entity.c = entity._movingTo[1];
          entity.x = tgt.x; entity.y = tgt.y;
        }
      }
    }
  }

  function chooseEnemyDir(en){
    const options = ['up','down','left','right'].filter(d => wallOpen(en.r, en.c, d) && d !== OPP[en.dir]);
    const allOptions = options.length ? options : ['up','down','left','right'].filter(d => wallOpen(en.r, en.c, d));
    if(!allOptions.length) return 'none';
    if(en.behavior === 'wander'){
      return allOptions[Math.floor(Math.random()*allOptions.length)];
    }
    // chase / patrol: evaluar distancia al jugador
    let best = allOptions[0], bestScore = en.frightened ? -Infinity : Infinity;
    for(const d of allOptions){
      const dd = DIRS[d];
      const nr = en.r+dd.dy, nc = en.c+dd.dx;
      const dist = Math.hypot(nr-player.r, nc-player.c);
      if(en.frightened){
        if(dist > bestScore){ bestScore = dist; best = d; }
      } else if(en.behavior === 'chase'){
        if(dist < bestScore){ bestScore = dist; best = d; }
      } else { // patrol: semi-aleatorio, prefiere mantenerse cerca de su ruta
        if(Math.random() < 0.5){ return allOptions[Math.floor(Math.random()*allOptions.length)]; }
        if(dist < bestScore){ bestScore = dist; best = d; }
      }
    }
    return best;
  }

  function update(){
    tryMove(player, (speedBoostTimer>0 ? 1.6 : 1) * cellSize*0.055);

    // recolección
    const dot = dots.find(d => !d.collected && d.r===player.r && d.c===player.c);
    if(dot){
      dot.collected = true; collected++;
      if(dot.power){
        score += 50; App.playSfx('power');
        frightTimer = 360; // ~6s a 60fps
        message = { text:'¡MODO DIRECTOR!', t: Date.now() };
      } else {
        score += 10; App.playSfx('collect');
      }
      updateScoreHUD();
    }

    if(frightTimer > 0) frightTimer--;
    if(speedBoostTimer > 0) speedBoostTimer--;

    for(const en of enemies){
      en.frightened = frightTimer > 0;
      const center = cellCenter(en.r, en.c);
      const aligned = Math.abs(en.x-center.x)<1 && Math.abs(en.y-center.y)<1;
      if(aligned || en.dir==='none'){
        en.nextDir = chooseEnemyDir(en);
      }
      tryMove(en, en.speed * (en.frightened ? 0.6 : 1));
      // colisión con jugador
      if(Math.hypot(en.x-player.x, en.y-player.y) < cellSize*0.5){
        if(en.frightened){
          const home = cellCenter(rows-1, cols-1);
          en.r = rows-1; en.c = cols-1; en.x = home.x; en.y = home.y; en.dir='none';
          score += 300; updateScoreHUD();
          App.playSfx('power');
        } else {
          loseLife();
          return;
        }
      }
    }

    if(collected >= totalToCollect){
      completeLevel();
    }
  }

  function loseLife(){
    lives--;
    App.playSfx('hit');
    if(lives <= 0){
      running = false;
      cancelAnimationFrame(raf);
      App.onGameOver();
    } else {
      const start = cellCenter(0,0);
      player.x = start.x; player.y = start.y; player.r=0; player.c=0; player.dir='none'; player.nextDir='none';
      enemies.forEach((en,i) => {
        const p = cellCenter(rows-1, cols-1-Math.min(i,cols-1));
        en.x=p.x; en.y=p.y; en.r=rows-1; en.c=cols-1-Math.min(i,cols-1); en.dir='none';
      });
    }
  }

  function completeLevel(){
    if(levelIndex < LEVELS.length-1){
      score += 500;
      updateScoreHUD();
      buildLevel(levelIndex+1);
    } else {
      running = false;
      cancelAnimationFrame(raf);
      const time = Math.round((Date.now()-startTime)/1000);
      App.onGameWin(3, { score, time, items: collected });
    }
  }

  function updateScoreHUD(){
    document.getElementById('g3-score').textContent = String(score).padStart(6,'0');
  }

  /* ---------------- dibujo ---------------- */
  function drawMaze(){
    ctx.strokeStyle = '#EF7A22';
    ctx.lineWidth = Math.max(2, cellSize*0.08);
    ctx.lineCap = 'round';
    for(let r=0;r<rows;r++){
      for(let c=0;c<cols;c++){
        const x0 = mazeOffX + c*cellSize, y0 = mazeOffY + r*cellSize;
        const cell = walls[r][c];
        ctx.beginPath();
        if(cell.n){ ctx.moveTo(x0,y0); ctx.lineTo(x0+cellSize,y0); }
        if(cell.w){ ctx.moveTo(x0,y0); ctx.lineTo(x0,y0+cellSize); }
        if(r===rows-1 && cell.s){ ctx.moveTo(x0,y0+cellSize); ctx.lineTo(x0+cellSize,y0+cellSize); }
        if(c===cols-1 && cell.e){ ctx.moveTo(x0+cellSize,y0); ctx.lineTo(x0+cellSize,y0+cellSize); }
        ctx.stroke();
      }
    }
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,'#1E3C4D'); grad.addColorStop(1,'#0B171E');
    ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);

    drawMaze();

    // dots / pellets
    for(const d of dots){
      if(d.collected) continue;
      const p = cellCenter(d.r,d.c);
      if(d.power){
        ctx.font = Math.floor(cellSize*0.55)+'px sans-serif';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(['⚡','🎬','💡','🎥'][(d.r+d.c)%4], p.x, p.y);
      } else {
        ctx.fillStyle = '#EF7A22';
        ctx.beginPath(); ctx.arc(p.x,p.y, Math.max(2,cellSize*0.07),0,Math.PI*2); ctx.fill();
      }
    }

    // enemigos
    ctx.font = Math.floor(cellSize*0.7)+'px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    const now = Date.now();
    for(const en of enemies){
      ctx.save();
      ctx.translate(en.x, en.y);
      
      // Movimiento dinámico: pequeño rebote y giro
      if (en.dir !== 'none') {
        const bounce = Math.sin(now / 120 + en.x) * (cellSize * 0.08);
        ctx.translate(0, bounce);
        // Si el enemigo se mueve a la izquierda, lo volteamos para que mire hacia allá
        if (en.dir === 'left') {
          ctx.scale(-1, 1);
        }
      }
      
      ctx.globalAlpha = en.frightened ? 0.6 : 1;
      ctx.fillText(en.frightened ? '😨' : en.icon, 0, 0);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // pulpo jugador
    const size = cellSize*0.9;
    ctx.save();
    ctx.translate(player.x, player.y);
    
    // Rotación estilo Pacman según la dirección
    if(player.dir==='left') { ctx.scale(-1,1); }
    else if(player.dir==='up') { ctx.rotate(-Math.PI/2); }
    else if(player.dir==='down') { ctx.rotate(Math.PI/2); }
    
    // Movimiento dinámico (squish / rebote) para simular que está nadando o comiendo
    if(player.dir !== 'none') {
      const squish = 1 + Math.sin(now / 80) * 0.1;
      ctx.scale(1, squish);
    }

    if(pulpoImg.complete && pulpoImg.naturalWidth){
      ctx.drawImage(pulpoImg, -size/2, -size/2, size, size);
    } else {
      ctx.fillStyle = '#EF7A22';
      ctx.beginPath(); ctx.arc(0,0,size/2,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();

    // mensajes flotantes
    if(message && Date.now()-message.t < 1200){
      ctx.fillStyle = '#EF7A22';
      ctx.font = 'bold 22px "Baloo 2", sans-serif';
      ctx.textAlign='center';
      ctx.fillText(message.text, W/2, 30);
    }

    // vidas
    ctx.font = '20px sans-serif';
    ctx.textAlign='left';
    for(let i=0;i<lives;i++) ctx.fillText('🐙', 16 + i*28, H-12);
  }

  function loop(){
    if(!running) return;
    update();
    if(running){ draw(); raf = requestAnimationFrame(loop); }
  }

  function start(){
    canvas = document.getElementById('canvas-g3');
    ctx = canvas.getContext('2d');
    pulpoImg.src = App.pulpoSrc;
    score = 0; lives = 3; startTime = Date.now();
    updateScoreHUD();
    buildLevel(0);
    bindControls();
    window.addEventListener('resize', layoutCanvas);
    running = true;
    cancelAnimationFrame(raf);
    loop();
  }

  function stop(){
    running = false;
    cancelAnimationFrame(raf);
    unbindControls();
    window.removeEventListener('resize', layoutCanvas);
  }

  return { start, stop };
})();

/* ==========================================================
   JUEGO 2 — ENCUENTRA AL PULPO
   ========================================================== */

const Game2 = (() => {
  let canvas, ctx, W, H, DPR;
  let pulpoImg = new Image();
  let level, score, items, startTime, timeLeft, timerId, scene, running = false;
  let feedback = null; // {type:'ok'|'err', x, y, t}

  const LEVELS = [
    { time:30, decoys:12, size:1.0,  label:'NIVEL 1' },
    { time:25, decoys:18, size:0.85, label:'NIVEL 2' },
    { time:20, decoys:24, size:0.75, label:'NIVEL 3' },
    { time:15, decoys:30, size:0.55, label:'NIVEL 4' },
    { time:12, decoys:34, size:0.5,  label:'NIVEL 5' },
    { time:10, decoys:42, size:0.42, label:'NIVEL FINAL' },
  ];

  const DECOR_ICONS = ['🎥','🎬','💡','🖥️','🎙️','🎦','🔌','📷','🐟','🌿','🫧','🐠','🔦','💾','🎚️','📼'];

  function resize(){
    const stage = canvas.parentElement;
    W = stage.clientWidth; H = stage.clientHeight;
    DPR = Math.min(window.devicePixelRatio||1, 2);
    canvas.width = W*DPR; canvas.height = H*DPR;
    canvas.style.width = W+'px'; canvas.style.height = H+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
    if(scene) buildScene(); // recompone si cambia el tamaño
  }

  function rand(min,max){ return min + Math.random()*(max-min); }

  function buildScene(){
    const cfg = LEVELS[level];
    const baseSize = Math.min(W,H) * 0.12 * cfg.size;
    const pulpo = {
      x: rand(baseSize, W-baseSize),
      y: rand(baseSize+40, H-baseSize),
      size: baseSize,
      rot: rand(-25,25)
    };
    const decoys = [];
    for(let i=0;i<cfg.decoys;i++){
      decoys.push({
        icon: DECOR_ICONS[Math.floor(Math.random()*DECOR_ICONS.length)],
        x: rand(20, W-20),
        y: rand(50, H-20),
        size: rand(22, 44),
        rot: rand(-30,30),
        alpha: rand(0.55,1)
      });
    }
    // en niveles avanzados, colocar un par de decoys justo encima del pulpo para camuflarlo
    if(level >= 4){
      for(let i=0;i<2;i++){
        decoys.push({
          icon: DECOR_ICONS[Math.floor(Math.random()*DECOR_ICONS.length)],
          x: pulpo.x + rand(-baseSize*0.4, baseSize*0.4),
          y: pulpo.y + rand(-baseSize*0.4, baseSize*0.4),
          size: rand(26,40), rot: rand(-30,30), alpha: 0.85
        });
      }
    }
    scene = { pulpo, decoys };
  }

  function startLevel(idx){
    level = idx;
    const cfg = LEVELS[level];
    document.getElementById('g2-level').textContent = (level+1);
    timeLeft = cfg.time;
    document.getElementById('g2-time').textContent = timeLeft;
    document.getElementById('g2-time').parentElement.classList.remove('warn');
    buildScene();
    clearInterval(timerId);
    timerId = setInterval(tick, 1000);
  }

  function tick(){
    timeLeft--;
    const timerEl = document.getElementById('g2-time');
    timerEl.textContent = timeLeft;
    const wrap = timerEl.parentElement;
    if(timeLeft <= 5){ wrap.classList.add('warn'); App.playSfx('tick'); }
    if(timeLeft <= 0){
      clearInterval(timerId);
      running = false;
      App.onGameOver();
    }
  }

  function updateScoreHUD(){
    document.getElementById('g2-score').textContent = String(score).padStart(6,'0');
  }

  function onPointerDown(ev){
    if(!running) return;
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - rect.left;
    const cy = (ev.touches ? ev.touches[0].clientY : ev.clientY) - rect.top;
    const p = scene.pulpo;
    const dx = cx - p.x, dy = cy - p.y;
    const dist = Math.sqrt(dx*dx+dy*dy);
    if(dist < p.size*0.6){
      // ¡Acierto!
      clearInterval(timerId);
      score += 200 + timeLeft*10;
      items++;
      updateScoreHUD();
      App.playSfx('success');
      feedback = { type:'ok', x:p.x, y:p.y, t:Date.now() };
      draw();
      setTimeout(() => {
        if(level < LEVELS.length-1){
          startLevel(level+1);
        } else {
          running = false;
          const time = Math.round((Date.now()-startTime)/1000);
          App.onGameWin(2, { score, time, items });
        }
      }, 650);
    } else {
      App.playSfx('error');
      feedback = { type:'err', x:cx, y:cy, t:Date.now() };
    }
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,'#2C5670'); grad.addColorStop(1,'#0B171E');
    ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);

    // decoraciones de fondo (elementos audiovisuales y marinos)
    for(const d of scene.decoys){
      ctx.save();
      ctx.globalAlpha = d.alpha;
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot*Math.PI/180);
      ctx.font = d.size+'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.icon, 0, 0);
      ctx.restore();
    }

    // pulpo escondido
    const p = scene.pulpo;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot*Math.PI/180);
    if(pulpoImg.complete && pulpoImg.naturalWidth){
      ctx.drawImage(pulpoImg, -p.size/2, -p.size/2, p.size, p.size);
    } else {
      ctx.fillStyle = '#EF7A22';
      ctx.beginPath(); ctx.arc(0,0,p.size/2,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();

    // retroalimentación de clic
    if(feedback){
      const age = Date.now() - feedback.t;
      if(age < 650){
        ctx.save();
        ctx.globalAlpha = 1 - age/650;
        ctx.translate(feedback.x, feedback.y);
        if(feedback.type === 'ok'){
          ctx.font = (60 + age*0.1)+'px sans-serif';
          ctx.textAlign='center';
          ctx.fillText('🎬', 0, -30);
          ctx.fillStyle = '#EF7A22';
          ctx.font = 'bold 20px "Baloo 2", sans-serif';
          ctx.fillText('¡ENCONTRADO!', 0, 40);
        } else {
          ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-14,-14); ctx.lineTo(14,14);
          ctx.moveTo(14,-14); ctx.lineTo(-14,14); ctx.stroke();
        }
        ctx.restore();
      } else if(feedback.type==='err'){
        feedback = null;
      }
    }
  }

  let rafLoop;
  function loop(){
    if(!running) return;
    draw();
    rafLoop = requestAnimationFrame(loop);
  }

  function start(){
    canvas = document.getElementById('canvas-g2');
    ctx = canvas.getContext('2d');
    pulpoImg.src = App.pulpoSrc;
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('touchstart', onPointerDown, {passive:false});
    score = 0; items = 0; startTime = Date.now();
    updateScoreHUD();
    running = true;
    startLevel(0);
    cancelAnimationFrame(rafLoop);
    loop();
  }

  function stop(){
    running = false;
    clearInterval(timerId);
    cancelAnimationFrame(rafLoop);
    canvas?.removeEventListener('mousedown', onPointerDown);
    canvas?.removeEventListener('touchstart', onPointerDown);
    window.removeEventListener('resize', resize);
  }

  return { start, stop };
})();

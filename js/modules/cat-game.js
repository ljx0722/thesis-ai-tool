/**
 * 检索小游戏 — 守护小猫
 * 一只小猫到处跑，鼠标阻挡防止碰到屏幕边缘，坚持越久越好
 */
var _gameActive = false;
var _gameCanvas = null;
var _gameCtx = null;
var _gameScore = 0;
var _gameStartTime = 0;
var _gameLoop = null;

// 小猫状态
var _cat = { x: 0, y: 0, vx: 0, vy: 0, r: 22, tail: 0, eyeB: 0 };

function startCatGame() {
  if (_gameActive) return;
  _gameActive = true;

  // 新手提示
  var hintEl=document.createElement('div');
  hintEl.style.cssText='position:fixed;top:20%;left:50%;transform:translate(-50%,0);color:rgba(255,255,255,0.9);font-size:1.1rem;z-index:10002;font-family:-apple-system,"PingFang SC",sans-serif;pointer-events:none;transition:opacity .6s;text-shadow:0 2px 8px rgba(0,0,0,0.5);text-align:center';
  hintEl.innerHTML='🐱 守护小猫<br><span style="font-size:.75rem;opacity:.7">用鼠标挡住边缘 · 坚持越久越好</span>';
  document.body.appendChild(hintEl);
  setTimeout(function(){hintEl.style.opacity='0';setTimeout(function(){if(hintEl.parentElement)hintEl.parentElement.removeChild(hintEl);},600);},3000);

  // 创建全屏 Canvas
  var canvas = document.createElement('canvas');
  canvas.id = 'catGameCanvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10001;cursor:none';
  document.body.appendChild(canvas);
  _gameCanvas = canvas;
  _gameCtx = canvas.getContext('2d');

  // 调整大小
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // 初始化小猫在屏幕中央
  _cat = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    vx: (Math.random() - 0.5) * 5,
    vy: (Math.random() - 0.5) * 5,
    r: 28,
    tail: Math.random() * Math.PI * 2,
    eyeB: 0,
    frame: 0,
    dir: 1
  };
  _gameStartTime = Date.now();
  _gameScore = 0;

  // 鼠标位置追踪
  var mouseX = canvas.width / 2;
  var mouseY = canvas.height / 2;
  document.addEventListener('mousemove', function(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // 游戏循环
  function loop() {
    if (!_gameActive) { cancelAnimationFrame(_gameLoop); return; }
    var ctx = _gameCtx;
    var w = canvas.width, h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 背景：半透明深色
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, h);

    // 更新小猫
    _cat.frame++;
    _cat.tail += 0.15;

    // 检测鼠标靠近 → 推离小猫（挡板效果）
    var dx = _cat.x - mouseX;
    var dy = _cat.y - mouseY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var pushDist = 100; // 有效阻挡距离

    if (dist < pushDist && dist > 5) {
      // 鼠标靠近 → 小猫被推开
      var force = (pushDist - dist) / pushDist * 3;
      _cat.vx += dx / dist * force * 0.5;
      _cat.vy += dy / dist * force * 0.5;
      // 小猫看鼠标方向
      _cat.dir = dx > 0 ? 1 : -1;
    }

    // 小猫也随机跑
    if (Math.random() < 0.02) {
      _cat.vx += (Math.random() - 0.5) * 2;
      _cat.vy += (Math.random() - 0.5) * 2;
    }

    // 摩擦力
    _cat.vx *= 0.98;
    _cat.vy *= 0.98;
    // 速度上限
    var speed = Math.sqrt(_cat.vx * _cat.vx + _cat.vy * _cat.vy);
    var maxSpeed = 6;
    if (speed > maxSpeed) {
      _cat.vx = _cat.vx / speed * maxSpeed;
      _cat.vy = _cat.vy / speed * maxSpeed;
    }

    _cat.x += _cat.vx;
    _cat.y += _cat.vy;

    // 检查是否碰到屏幕边缘 → 游戏结束
    var margin = _cat.r + 5;
    if (_cat.x <= margin || _cat.x >= w - margin || _cat.y <= margin || _cat.y >= h - margin) {
      endGame();
      return;
    }

    // 绘制小猫 🐱
    var cx = _cat.x, cy = _cat.y;

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + 20, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 尾巴
    ctx.save();
    ctx.translate(cx - 10, cy + 5);
    ctx.rotate(Math.sin(_cat.tail) * 0.5 + 0.3);
    ctx.strokeStyle = '#e8a838';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-15, -8, -22, -16);
    ctx.stroke();
    // 尾巴尖
    ctx.fillStyle = '#f5c842';
    ctx.beginPath();
    ctx.arc(-22, -16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 身体
    var bodyGrad = ctx.createRadialGradient(cx - 5, cy - 3, 3, cx, cy, _cat.r);
    bodyGrad.addColorStop(0, '#f9e79f');
    bodyGrad.addColorStop(0.5, '#f5c542');
    bodyGrad.addColorStop(1, '#d4940a');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, _cat.r, 0, Math.PI * 2);
    ctx.fill();

    // 耳朵 - 左
    ctx.fillStyle = '#d4940a';
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy - 14);
    ctx.lineTo(cx - 10, cy - 28);
    ctx.lineTo(cx - 2, cy - 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f5c542';
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy - 15);
    ctx.lineTo(cx - 10, cy - 24);
    ctx.lineTo(cx - 5, cy - 15);
    ctx.closePath();
    ctx.fill();

    // 耳朵 - 右
    ctx.fillStyle = '#d4940a';
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy - 14);
    ctx.lineTo(cx + 10, cy - 28);
    ctx.lineTo(cx + 18, cy - 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f5c542';
    ctx.beginPath();
    ctx.moveTo(cx + 5, cy - 15);
    ctx.lineTo(cx + 10, cy - 24);
    ctx.lineTo(cx + 15, cy - 15);
    ctx.closePath();
    ctx.fill();

    // 脸部条纹
    ctx.fillStyle = '#d4940a';
    ctx.beginPath();
    ctx.ellipse(cx - 8, cy + 2, 4, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 8, cy + 2, 4, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛
    var eyeY = cy - 6;
    // 眨眼
    _cat.eyeB++;
    var eyeH = (_cat.eyeB % 80 < 4) ? 1 : 6;

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(cx - 8, eyeY, 7, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 8, eyeY, 7, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();

    if (eyeH > 2) {
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.arc(cx - 7, eyeY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 9, eyeY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // 高光
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx - 8, eyeY - 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 8, eyeY - 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 鼻子
    ctx.fillStyle = '#e87d8a';
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy);
    ctx.lineTo(cx + 3, cy);
    ctx.lineTo(cx, cy + 4);
    ctx.closePath();
    ctx.fill();

    // 嘴巴
    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 4);
    ctx.quadraticCurveTo(cx - 5, cy + 9, cx - 8, cy + 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy + 4);
    ctx.quadraticCurveTo(cx + 5, cy + 9, cx + 8, cy + 7);
    ctx.stroke();

    // 胡须
    ctx.strokeStyle = '#c0c0c0';
    ctx.lineWidth = 0.8;
    for (var w = -1; w <= 1; w += 2) {
      for (var wi = -1; wi <= 1; wi++) {
        ctx.beginPath();
        ctx.moveTo(cx + w * 8, cy + 1);
        ctx.lineTo(cx + w * 28, cy + wi * 7 - 4);
        ctx.stroke();
      }
    }

    // 鼠标 — 半透圆形
    var mGrad = ctx.createRadialGradient(mouseX, mouseY, 5, mouseX, mouseY, 35);
    mGrad.addColorStop(0, 'rgba(255,255,255,0.25)');
    mGrad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    mGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = mGrad;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 35, 0, Math.PI * 2);
    ctx.fill();

    // 光标点
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 4, 0, Math.PI * 2);
    ctx.fill();

    // UI 文字
    var elapsed = Math.floor((Date.now() - _gameStartTime) / 1000);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '600 16px -apple-system,"PingFang SC",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐱 守护小猫 · 用鼠标挡住边缘 · 坚持了 ' + elapsed + ' 秒', w / 2, 38);

    ctx.font = '400 12px -apple-system,"PingFang SC",sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('文献检索中，陪小猫玩一会儿吧~', w / 2, 58);

    // 边缘警告线（红色渐变）
    var edgeGrad = ctx.createLinearGradient(0, 0, margin, 0);
    edgeGrad.addColorStop(0, 'rgba(255,59,48,0.3)');
    edgeGrad.addColorStop(1, 'rgba(255,59,48,0)');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, margin, h);
    ctx.fillRect(w - margin, 0, margin, h);
    var edgeGrad2 = ctx.createLinearGradient(0, 0, 0, margin);
    edgeGrad2.addColorStop(0, 'rgba(255,59,48,0.3)');
    edgeGrad2.addColorStop(1, 'rgba(255,59,48,0)');
    ctx.fillStyle = edgeGrad2;
    ctx.fillRect(0, 0, w, margin);
    ctx.fillRect(0, h - margin, w, margin);

    _gameLoop = requestAnimationFrame(loop);
  }

  _gameLoop = requestAnimationFrame(loop);
}

function endGame() {
  _gameActive = false;
  cancelAnimationFrame(_gameLoop);

  var elapsed = Math.floor((Date.now() - _gameStartTime) / 1000);
  document.removeEventListener('mousemove', function() {});

  // 绘制结算画面
  var ctx = _gameCtx;
  var w = _gameCanvas.width, h = _gameCanvas.height;

  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5c542';
  ctx.font = 'bold 42px -apple-system,"PingFang SC",sans-serif';
  ctx.fillText('🐱', w / 2, h / 2 - 40);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px -apple-system,"PingFang SC",sans-serif';
  var msg = elapsed >= 60 ? '🎉 太厉害了！守护了 ' + elapsed + ' 秒！' :
          (elapsed >= 30 ? '👍 不错！守护了 ' + elapsed + ' 秒' :
          (elapsed >= 10 ? '😺 守护了 ' + elapsed + ' 秒，继续加油' :
          '😿 只守护了 ' + elapsed + ' 秒，再试一次吧'));
  ctx.fillText(msg, w / 2, h / 2 + 10);

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '400 14px -apple-system,"PingFang SC",sans-serif';
  ctx.fillText('点击任意位置关闭游戏', w / 2, h / 2 + 48);

  // 点击关闭
  function closeGame(e) {
    document.removeEventListener('click', closeGame);
    _gameCanvas.parentElement && _gameCanvas.parentElement.removeChild(_gameCanvas);
    _gameCanvas = null;
    window.removeEventListener('resize', function() {});
  }
  document.addEventListener('click', closeGame);
}

function stopCatGame() {
  _gameActive = false;
  cancelAnimationFrame(_gameLoop);
  if (_gameCanvas && _gameCanvas.parentElement) {
    _gameCanvas.parentElement.removeChild(_gameCanvas);
    _gameCanvas = null;
  }
}

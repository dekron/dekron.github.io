window.Drift = window.Drift || {};
(() => {
'use strict';
/* Отрисовка машины: вид сверху, неоновый кузов, фары, стоп-сигнал,
   пламя нитро и анимация падения в пустоту. Локальные координаты: нос вверх. */
function drawCar(ctx, c, t) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.h + Math.PI / 2);
  let sc = 1;
  if (c.crashT > 0) {
    const k = 1 - c.crashT / 1.05;
    sc = Math.max(.1, 1 - k * .9);
    ctx.rotate(k * 5);
    ctx.globalAlpha = Math.max(0, 1 - k * 1.1);
  } else if (c.inv > 0 && Math.floor(t * 12) % 2 === 0) {
    ctx.globalAlpha = .45;
  }
  ctx.scale(sc, sc);

  /* подсветка днища */
  ctx.fillStyle = 'rgba(255,43,214,.16)';
  ctx.beginPath(); ctx.ellipse(0, 4, 20, 27, 0, 0, Math.PI * 2); ctx.fill();

  /* конус фар */
  const hg = ctx.createLinearGradient(0, -22, 0, -120);
  hg.addColorStop(0, 'rgba(0,240,255,.2)'); hg.addColorStop(1, 'rgba(0,240,255,0)');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.moveTo(-8, -22); ctx.lineTo(-26, -120); ctx.lineTo(26, -120); ctx.lineTo(8, -22); ctx.closePath(); ctx.fill();

  /* пламя нитро */
  if (c.boosting) {
    const fl = 16 + Math.sin(t * 40) * 6 + Math.random() * 6;
    const fg = ctx.createLinearGradient(0, 22, 0, 22 + fl + 14);
    fg.addColorStop(0, 'rgba(0,240,255,.95)'); fg.addColorStop(.5, 'rgba(123,43,255,.7)'); fg.addColorStop(1, 'rgba(255,43,214,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(-7, 22); ctx.lineTo(0, 22 + fl + 14); ctx.lineTo(7, 22); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.beginPath(); ctx.moveTo(-3, 22); ctx.lineTo(0, 22 + fl * .6); ctx.lineTo(3, 22); ctx.closePath(); ctx.fill();
  }

  /* корпус */
  const bg = ctx.createLinearGradient(-11, 0, 11, 0);
  bg.addColorStop(0, '#2a0f42'); bg.addColorStop(.5, '#4a1e6e'); bg.addColorStop(1, '#2a0f42');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.quadraticCurveTo(9, -20, 10, -10);
  ctx.lineTo(11, 14);
  ctx.quadraticCurveTo(11, 21, 7, 22);
  ctx.lineTo(-7, 22);
  ctx.quadraticCurveTo(-11, 21, -11, 14);
  ctx.lineTo(-10, -10);
  ctx.quadraticCurveTo(-9, -20, 0, -24);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ff2bd6'; ctx.lineWidth = 1.6;
  ctx.shadowColor = '#ff2bd6'; ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;

  /* кокпит */
  ctx.fillStyle = '#0a0618';
  ctx.beginPath();
  ctx.moveTo(-6, -8); ctx.quadraticCurveTo(0, -12, 6, -8);
  ctx.lineTo(5, 4); ctx.quadraticCurveTo(0, 7, -5, 4);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,240,255,.75)'; ctx.lineWidth = 1.2; ctx.stroke();

  /* неоновая полоса по капоту */
  ctx.strokeStyle = 'rgba(0,240,255,.9)'; ctx.lineWidth = 1.6;
  ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 7;
  ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, -11); ctx.stroke();
  ctx.shadowBlur = 0;

  /* антикрыло */
  ctx.fillStyle = '#1c0b3d';
  ctx.fillRect(-11, 17, 22, 4);
  ctx.strokeStyle = 'rgba(255,43,214,.8)'; ctx.lineWidth = 1;
  ctx.strokeRect(-11, 17, 22, 4);

  /* фары и стоп-сигнал */
  ctx.fillStyle = '#c9f6ff';
  ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 8;
  ctx.fillRect(-8, -23, 4, 2.6); ctx.fillRect(4, -23, 4, 2.6);
  ctx.shadowColor = '#ff3355'; ctx.shadowBlur = c.braking ? 14 : 6;
  ctx.fillStyle = c.braking ? '#ff5a72' : '#ff3355';
  ctx.fillRect(-8, 20, 5, 2.4); ctx.fillRect(3, 20, 5, 2.4);
  ctx.shadowBlur = 0;

  ctx.restore();
}

Object.assign(window.Drift, { drawCar });
})();
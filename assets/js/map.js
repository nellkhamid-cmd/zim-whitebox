/* =====================================================================
   Brand Map — логика карты района. Без зависимостей, ~2 КБ.

   BrandMap.init(document.querySelector('.map'), {
     list: '.time[data-key]',   // необязательно: карточки «время → объект» с тем же data-key
     interval: 3400,            // автопереключение объектов, мс (0 — выключить)
     curve: 0.22,               // изгиб дуги маршрута
   });

   Что делает:
   · ставит метки и подписи по координатам viewBox (data-x/data-y) как object-fit: cover;
   · прячет подписи, которые не помещаются в кадр (узкий телефон);
   · при появлении на экране — раскрытие кругом от дома, метки выпрыгивают по очереди;
   · клик по метке или карточке списка — дуга-маршрут от дома до объекта;
   · пока посетитель ничего не трогает, объекты переключаются сами (только когда карта видна).
   ===================================================================== */
(function () {
  'use strict';
  const $$ = (s, c) => [...c.querySelectorAll(s)];

  function init(map, opts) {
    if (!map) return null;
    const o = Object.assign({ list: null, interval: 3400, curve: 0.22 }, opts);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) map.classList.add('map--anim');

    const [VW, VH] = map.dataset.vb.split(' ').map(Number);
    const home = map.querySelector('.pin--home');
    const HX = +home.dataset.x, HY = +home.dataset.y;
    const route = map.querySelector('.map__route');
    const pins = $$('.pin[data-key]', map);
    const items = o.list ? $$(o.list, document) : [];
    const keys = pins.map((p) => p.dataset.key);
    pins.forEach((p, i) => p.style.setProperty('--n', i));

    function layout() {
      const w = map.clientWidth, h = map.clientHeight;
      if (!w || !h) return;
      const s = Math.max(w / VW, h / VH);
      const ox = (w - VW * s) / 2, oy = (h - VH * s) / 2;
      $$('[data-x]', map).forEach((el) => {
        el.style.left = (ox + el.dataset.x * s).toFixed(1) + 'px';
        el.style.top = (oy + el.dataset.y * s).toFixed(1) + 'px';
        if (el.dataset.r) el.style.setProperty('--r', el.dataset.r + 'deg');
      });
      requestAnimationFrame(() => {
        const mr = map.getBoundingClientRect();
        $$('.map__lbl', map).forEach((el) => {
          el.hidden = false;
          const r = el.getBoundingClientRect();
          el.hidden = r.left < mr.left + 8 || r.right > mr.right - 8 || r.top < mr.top + 8 || r.bottom > mr.bottom - 24;
        });
      });
      map.style.setProperty('--cx', ((ox + HX * s) / w * 100).toFixed(1) + '%');
      map.style.setProperty('--cy', ((oy + HY * s) / h * 100).toFixed(1) + '%');
    }
    new ResizeObserver(layout).observe(map);
    layout();

    let current = null;
    function activate(key) {
      if (key === current) return;
      current = key;
      pins.forEach((p) => p.classList.toggle('is-active', p.dataset.key === key));
      items.forEach((t) => t.classList.toggle('is-active', t.dataset.key === key));
      const p = pins.find((x) => x.dataset.key === key);
      if (!p || !route) return;
      const tx = +p.dataset.x, ty = +p.dataset.y;
      pins.forEach((x) => x.classList.toggle('pin--below', x === p && ty > HY));   // подпись уходит от дома, не налезает на его подпись
      const mx = (HX + tx) / 2, my = (HY + ty) / 2, dx = tx - HX, dy = ty - HY;
      route.setAttribute('d', `M${HX} ${HY}Q${(mx - dy * o.curve).toFixed(0)} ${(my + dx * o.curve).toFixed(0)} ${tx} ${ty}`);
      route.classList.remove('is-drawn');
      void route.getBoundingClientRect();
      route.classList.add('is-drawn');
    }

    let timer = null, touched = false, visible = false;
    const stop = () => { clearInterval(timer); timer = null; };
    const cycle = () => {
      stop();
      if (touched || !visible || reduced || !o.interval) return;
      timer = setInterval(() => activate(keys[(keys.indexOf(current) + 1) % keys.length]), o.interval);
    };
    const pick = (key) => { touched = true; stop(); activate(key); };
    pins.forEach((p) => p.addEventListener('click', () => pick(p.dataset.key)));
    items.forEach((t) => {
      t.addEventListener('click', () => pick(t.dataset.key));
      t.addEventListener('mouseenter', () => { if (matchMedia('(hover: hover)').matches) pick(t.dataset.key); });
      t.addEventListener('focus', () => pick(t.dataset.key));
    });

    const start = () => {
      map.classList.add('is-in');
      setTimeout(() => { map.classList.add('is-ready'); if (!current && keys.length) activate(keys[0]); cycle(); }, reduced ? 0 : 1300);
    };
    if ('IntersectionObserver' in window) {
      let started = false;
      new IntersectionObserver(([en]) => {
        visible = en.isIntersecting;
        if (visible && !started) { started = true; start(); }
        else if (started) visible ? cycle() : stop();
      }, { threshold: 0.35 }).observe(map);
    } else { visible = true; start(); }

    return { activate, layout };
  }

  window.BrandMap = { init };
})();

/* ЖК «ЗИМ Галерея», Дом Кино, предчистовая отделка: показ при прокрутке, маска телефона, формы заявок */
(function () {
  "use strict";

  /* Настройки внедрения */
  const CONFIG = {
    FORM_ENDPOINT: "",   // URL обработчика заявок (CRM / вебхук). Пусто: заявка никуда не уходит, показывается только экран успеха
    YM_COUNTER: null,    // номер счётчика Яндекс Метрики
    GOALS: { catalog: "whitebox_catalog", show: "whitebox_show" },
    OFFER: "Предчистовая отделка, Дом Кино"
  };

  /* ---------- Показ при прокрутке ---------- */
  const items = document.querySelectorAll("[data-r]:not(.map__lbl)");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add("in"));
  }

  /* ---------- Карта района: без автопереключения и маршрутов ---------- */
  if (window.BrandMap) window.BrandMap.init(document.querySelector(".map"), { interval: 0 });

  /* ---------- Формы ---------- */
  const params = new URLSearchParams(location.search);
  const digits = (v) => v.replace(/\D/g, "");
  const formatPhone = (v) => {
    let n = digits(v);
    if (v.trim().startsWith("+7")) n = n.slice(1);
    else if (n.length >= 11 && /^[78]/.test(n)) n = n.slice(1);
    n = n.slice(0, 10);
    let out = "+7";
    if (n.length) out += " (" + n.slice(0, 3);
    if (n.length >= 3) out += ")";
    if (n.length > 3) out += " " + n.slice(3, 6);
    if (n.length > 6) out += "-" + n.slice(6, 8);
    if (n.length > 8) out += "-" + n.slice(8, 10);
    return out;
  };

  document.querySelectorAll("form[data-lead]").forEach((form) => {
    const kind = form.dataset.lead;
    const { name, phone, email, consent, ads_consent: ads } = form.elements;
    const status = form.querySelector(".form__status");
    const success = form.parentElement.querySelector(".success");
    let tried = false;

    /* метки рекламы из адреса страницы */
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((k) => {
      if (form.elements[k] && params.get(k)) form.elements[k].value = params.get(k);
    });

    phone.addEventListener("focus", () => { if (!phone.value) phone.value = "+7 "; });
    phone.addEventListener("blur", () => { if (digits(phone.value).length <= 1) phone.value = ""; });
    phone.addEventListener("input", () => {
      const end = phone.selectionStart === phone.value.length;
      phone.value = formatPhone(phone.value);
      if (end) phone.setSelectionRange(phone.value.length, phone.value.length);
      if (tried) validate();
    });
    [name, email, consent, ads].filter(Boolean).forEach((el) => {
      el.addEventListener("input", () => { if (tried) validate(); });
      el.addEventListener("change", () => { if (tried) validate(); });
    });

    function setErr(input, bad) {
      const err = input.id ? document.getElementById(input.id + "-err") : form.querySelector('[data-err="' + input.name + '"]');
      input.setAttribute("aria-invalid", bad ? "true" : "false");
      if (err) err.hidden = !bad;
    }
    function validate() {
      const checks = [
        [name, name.value.trim().length >= 2],
        [phone, digits(phone.value).replace(/^7/, "").length === 10]
      ];
      if (email) checks.push([email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())]);
      checks.push([consent, consent.checked], [ads, ads.checked]);
      let first = null;
      checks.forEach(([el, ok]) => {
        setErr(el, !ok);
        if (!ok && !first) first = el;
      });
      return first;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      tried = true;
      const bad = validate();
      if (bad) { bad.focus(); return; }
      const btn = form.querySelector('[type="submit"]');
      if (btn.getAttribute("aria-busy") === "true") return; // заявка уже отправляется: без этого повторный Enter создаёт дубль
      btn.setAttribute("aria-busy", "true");
      status.textContent = "Отправляем...";
      const data = Object.fromEntries(new FormData(form).entries());
      data.consent = true;
      data.ads_consent = true;
      data.offer = CONFIG.OFFER;
      data.request = kind === "show" ? "Показ" : "Каталог";
      data.page = location.href;
      data.submitted_at = new Date().toISOString();
      try {
        if (CONFIG.FORM_ENDPOINT) {
          const res = await fetch(CONFIG.FORM_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
          if (!res.ok) throw new Error("HTTP " + res.status);
        } else {
          await new Promise((r) => setTimeout(r, 500));
          console.warn("[ЗИМ] FORM_ENDPOINT не задан: заявка никуда не отправлена");
        }
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: CONFIG.GOALS[kind] });
        if (window.ym && CONFIG.YM_COUNTER) window.ym(CONFIG.YM_COUNTER, "reachGoal", CONFIG.GOALS[kind]);
        status.textContent = "";
        form.hidden = true;
        success.hidden = false;
        success.focus({ preventScroll: true });
        success.scrollIntoView({ block: "center" });
      } catch (err) {
        status.textContent = "Не получилось отправить. Проверьте интернет или позвоните нам: +7 (846) 205-22-88";
      } finally {
        btn.removeAttribute("aria-busy");
      }
    });
  });
})();

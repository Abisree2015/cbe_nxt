/* Coimbatore NXT 2026 — form validation for the Get Involved and Contact forms.
   Submissions are not sent anywhere yet: the forms get connected when the site moves to Framer. */
(function () {
  'use strict';
  function check(el) {
    var ok = el.checkValidity();
    el.setAttribute('aria-invalid', ok ? 'false' : 'true');
    return ok;
  }
  document.querySelectorAll('[data-nxt-form]').forEach(function (form) {
    var fields = Array.prototype.slice.call(form.querySelectorAll('input, select, textarea'));
    var status = form.querySelector('[data-form-status]');
    fields.forEach(function (f) {
      f.addEventListener('change', function () { if (f.getAttribute('aria-invalid') === 'true') check(f); });
      f.addEventListener('blur', function () { if (f.value) check(f); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstInvalid = null;
      fields.forEach(function (f) { if (!check(f) && !firstInvalid) firstInvalid = f; });
      if (firstInvalid) {
        firstInvalid.focus();
        status.textContent = 'Please check the highlighted fields.';
        status.className = 'form__status';
        return;
      }
      status.textContent = 'Thank you. This is a preview, so your details have not been sent. The form will be connected when the site goes live.';
      status.className = 'form__status form__status--success';
      form.reset();
      fields.forEach(function (f) { f.removeAttribute('aria-invalid'); });
    });
  });
})();

/* Vision 2030 — highlight the in-page nav link for the section in view */
(function () {
  'use strict';
  var links = Array.prototype.slice.call(document.querySelectorAll('.vision-nav a[href^="#"]'));
  if (!links.length || !('IntersectionObserver' in window)) return;
  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      links.forEach(function (a) { a.removeAttribute('aria-current'); });
      byId[e.target.id].setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  Object.keys(byId).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
})();

/* Home hero background video: pause/play toggle, and no motion for reduced-motion users */
(function () {
  'use strict';
  var video = document.querySelector('[data-hero-video]');
  var toggle = document.querySelector('[data-hero-video-toggle]');
  if (!video) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  function setPaused(paused) {
    if (paused) video.pause(); else { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
    if (toggle) {
      toggle.setAttribute('aria-pressed', paused ? 'true' : 'false');
      toggle.setAttribute('aria-label', paused ? 'Play background video' : 'Pause background video');
    }
  }
  if (reduce && reduce.matches) { video.removeAttribute('autoplay'); setPaused(true); }
  if (toggle) toggle.addEventListener('click', function () { setPaused(!video.paused); });
})();

/* Hero and scroll motion: nav state, scroll cue, hero parallax and scroll reveal.
   Content is only hidden for reveal after this script runs, and never for reduced-motion users. */
(function () {
  'use strict';
  var nav = document.querySelector('[data-globalnav]');
  var hero = document.querySelector('main > section:first-child');
  var isHero = hero && /\b(hero|list-hero|how-hero)\b/.test(hero.className);
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (isHero && !hero.querySelector('.scroll-cue')) {
    var cue = document.createElement('span');
    cue.className = 'scroll-cue';
    cue.setAttribute('aria-hidden', 'true');
    hero.appendChild(cue);
  }

  var ticking = false;
  var layers = isHero ? hero.querySelectorAll('.hero__bg, .hero__video, .how-hero__bg, .list-hero__mosaic') : [];
  var copy = isHero ? hero.querySelector('.hero__inner, .list-hero__inner, .how-hero__grid') : null;
  function update() {
    ticking = false;
    var y = window.scrollY || window.pageYOffset;
    if (nav) nav.classList.toggle('is-scrolled', y > 8);
    if (reduce || !isHero) return;
    var h = hero.offsetHeight || 1;
    if (y > h) return;
    var p = Math.min(y / h, 1);
    for (var i = 0; i < layers.length; i++) layers[i].style.translate = '0 ' + (y * 0.3).toFixed(1) + 'px';
    if (copy) { copy.style.opacity = (1 - p * 0.9).toFixed(3); copy.style.translate = '0 ' + (y * -0.12).toFixed(1) + 'px'; }
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } }, { passive: true });
  update();

  if (reduce || !('IntersectionObserver' in window)) return;

  // Reveal targets: section headers and headings, plus the items of grids and lists
  var main = document.querySelector('main');
  if (!main) return;
  var sections = Array.prototype.slice.call(main.children).filter(function (s) { return s !== hero && !/\b(localnav|vision-nav)\b/.test(s.className); });
  var targets = [];
  var inTarget = function (el) { for (var k = 0; k < targets.length; k++) if (targets[k].contains(el) || el.contains(targets[k])) return true; return false; };
  sections.forEach(function (sec) {
    sec.querySelectorAll('.split-header, .section-header, .how-header, header, .group__title, .group__lede, .eyebrow, h2, .lede-html, .section-cta').forEach(function (el) {
      if (!inTarget(el)) { el.setAttribute('data-reveal', ''); targets.push(el); }
    });
    sec.querySelectorAll('ul, ol, [class*="grid"], [class*="list"], [class*="rows"]').forEach(function (g) {
      var kids = Array.prototype.filter.call(g.children, function (c) { return c.offsetHeight > 0 && getComputedStyle(c).display !== 'inline'; });
      if (kids.length < 2 || inTarget(g) || g.closest('form, nav, .prose, .lede-html')) return;
      kids.forEach(function (c, n) { if (inTarget(c)) return; c.setAttribute('data-reveal', ''); c.style.setProperty('--reveal-i', n % 6); targets.push(c); });
    });
  });

  // Anything already on screen stays visible (no flash); the rest reveals as it scrolls in
  var vh = window.innerHeight;
  targets.forEach(function (el) { if (el.getBoundingClientRect().top < vh * 0.92) el.classList.add('is-revealed'); });
  document.documentElement.classList.add('motion');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-revealed'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  targets.forEach(function (el) { if (!el.classList.contains('is-revealed')) io.observe(el); });
})();

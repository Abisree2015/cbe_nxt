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

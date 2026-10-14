/* CoimbatoreNXT — site behaviour: navigation, dialogs, forms, search. */
(function () {
  'use strict';

  var root = document.body.getAttribute('data-root') || './';
  var mobileNav = window.matchMedia('(max-width: 833px)');

  /* ---------- Global navigation ---------- */
  var nav = document.querySelector('[data-globalnav]');
  var toggle = nav && nav.querySelector('[data-nav-toggle]');
  var triggers = nav ? Array.prototype.slice.call(nav.querySelectorAll('.globalnav__trigger')) : [];

  function setSubmenu(trigger, open) {
    var menu = document.getElementById(trigger.getAttribute('aria-controls'));
    trigger.setAttribute('aria-expanded', String(open));
    if (menu) menu.classList.toggle('is-open', open);
  }
  function closeSubmenus(except) {
    triggers.forEach(function (t) { if (t !== except) setSubmenu(t, false); });
  }
  function setMobileMenu(open) {
    if (!nav || !toggle) return;
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('is-locked', open);
    if (!open) closeSubmenus();
  }

  triggers.forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      var open = trigger.getAttribute('aria-expanded') !== 'true';
      if (!mobileNav.matches) closeSubmenus(trigger);
      setSubmenu(trigger, open);
      if (open && !mobileNav.matches) {
        var first = document.getElementById(trigger.getAttribute('aria-controls')).querySelector('a');
        if (first && trigger.dataset.keyboard === 'true') first.focus();
      }
    });
    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        trigger.dataset.keyboard = 'true';
        setSubmenu(trigger, true);
        var first = document.getElementById(trigger.getAttribute('aria-controls')).querySelector('a');
        if (first) first.focus();
      }
    });
  });

  if (nav) {
    // Arrow-key movement inside an open submenu
    nav.addEventListener('keydown', function (e) {
      var menu = e.target.closest && e.target.closest('.globalnav__submenu');
      if (!menu) return;
      var links = Array.prototype.slice.call(menu.querySelectorAll('a'));
      var i = links.indexOf(e.target);
      if (e.key === 'ArrowDown') { e.preventDefault(); links[(i + 1) % links.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); links[(i - 1 + links.length) % links.length].focus(); }
    });
    // Close desktop submenus when focus leaves them
    nav.addEventListener('focusout', function (e) {
      if (mobileNav.matches) return;
      var item = e.target.closest('.globalnav__item');
      if (item && !item.contains(e.relatedTarget)) {
        var t = item.querySelector('.globalnav__trigger');
        if (t) setSubmenu(t, false);
      }
    });
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      setMobileMenu(!nav.classList.contains('is-open'));
    });
  }

  document.addEventListener('click', function (e) {
    if (nav && !nav.contains(e.target) && !mobileNav.matches) closeSubmenus();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    var openTrigger = triggers.filter(function (t) { return t.getAttribute('aria-expanded') === 'true'; })[0];
    if (openTrigger && !mobileNav.matches) { setSubmenu(openTrigger, false); openTrigger.focus(); return; }
    if (nav && nav.classList.contains('is-open')) { setMobileMenu(false); toggle.focus(); }
  });

  // Leaving the mobile layout resets the menu; in-page links close it
  mobileNav.addEventListener && mobileNav.addEventListener('change', function () { setMobileMenu(false); });
  if (nav) {
    nav.querySelectorAll('.globalnav__menu a').forEach(function (a) {
      a.addEventListener('click', function () { if (mobileNav.matches) setMobileMenu(false); });
    });
  }

  /* ---------- Dialogs ---------- */
  var lastOpener = null;

  function openDialog(id, opener) {
    var dialog = document.getElementById(id);
    if (!dialog || typeof dialog.showModal !== 'function') return false;
    lastOpener = opener || document.activeElement;
    if (nav && nav.classList.contains('is-open')) setMobileMenu(false);
    dialog.showModal();
    document.body.classList.add('is-locked');
    var autofocus = dialog.querySelector('[data-autofocus], input:not([type=hidden]), textarea');
    if (autofocus && dialog.id !== 'dialog-contact') autofocus.focus();
    return true;
  }

  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-dialog-open]');
    if (opener) {
      if (opener.hasAttribute('data-download')) {
        pendingDownload = { href: opener.getAttribute('data-download'), name: opener.getAttribute('data-download-name') || '' };
        resetForm(document.querySelector('[data-download-form]'));
      }
      if (openDialog(opener.getAttribute('data-dialog-open'), opener)) e.preventDefault();
      return;
    }
    var closer = e.target.closest('[data-dialog-close]');
    if (closer) { closer.closest('dialog').close(); return; }
    // Click on the backdrop (outside the dialog box) closes it
    if (e.target.tagName === 'DIALOG' && e.target.open) {
      var r = e.target.getBoundingClientRect();
      var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) e.target.close();
    }
  });

  document.querySelectorAll('dialog').forEach(function (dialog) {
    dialog.addEventListener('close', function () {
      document.body.classList.remove('is-locked');
      if (lastOpener && document.contains(lastOpener)) lastOpener.focus();
      lastOpener = null;
    });
  });

  /* ---------- Form validation ---------- */
  function validateField(input) {
    var ok = input.checkValidity();
    input.setAttribute('aria-invalid', ok ? 'false' : 'true');
    return ok;
  }
  function validateForm(form) {
    var fields = Array.prototype.slice.call(form.querySelectorAll('.field__input'));
    var firstInvalid = null;
    fields.forEach(function (f) { if (!validateField(f) && !firstInvalid) firstInvalid = f; });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }
  function resetForm(form) {
    if (!form) return;
    form.reset();
    form.querySelectorAll('.field__input').forEach(function (f) { f.removeAttribute('aria-invalid'); });
    var status = form.querySelector('[data-form-status]');
    if (status) { status.textContent = ''; status.className = 'form__status'; }
  }
  document.querySelectorAll('.form').forEach(function (form) {
    form.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true') validateField(e.target);
    });
    form.addEventListener('focusout', function (e) {
      if (e.target.classList && e.target.classList.contains('field__input') && e.target.value) validateField(e.target);
    });
  });

  function setStatus(form, message, success) {
    var status = form.querySelector('[data-form-status]');
    if (!status) return;
    status.textContent = message;
    status.className = 'form__status' + (success ? ' form__status--success' : '');
  }
  function setBusy(button, busy, label) {
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
    if (label) button.textContent = label;
  }

  /* Contact form — composes an email to the CoimbatoreNXT contacts */
  var contactForm = document.querySelector('[data-contact-form]');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateForm(contactForm)) { setStatus(contactForm, 'Please check the highlighted fields.'); return; }
      var btn = contactForm.querySelector('[type=submit]');
      var d = new FormData(contactForm);
      setBusy(btn, true, 'Preparing…');
      var body = [
        'Name: ' + d.get('name'),
        'Email: ' + d.get('email'),
        d.get('phone') ? 'Phone: ' + d.get('phone') : '',
        d.get('organisation') ? 'Organisation: ' + d.get('organisation') : '',
        '',
        d.get('message'),
      ].filter(function (l, i) { return l !== '' || i === 4; }).join('\n');
      var href = 'mailto:shimna.p@cii.in?cc=vinod.shenoy@cii.in'
        + '&subject=' + encodeURIComponent('CoimbatoreNXT enquiry from ' + d.get('name'))
        + '&body=' + encodeURIComponent(body);
      window.location.href = href;
      setTimeout(function () {
        setBusy(btn, false, 'Send message');
        setStatus(contactForm, 'Thank you. Your email app should now be open with your message ready to send.', true);
      }, 600);
    });
  }

  /* Download gate — asks for an email address, then starts the download */
  var pendingDownload = null;
  var downloadForm = document.querySelector('[data-download-form]');
  if (downloadForm) {
    downloadForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateForm(downloadForm)) { setStatus(downloadForm, 'Please enter a valid email address to continue.'); return; }
      if (!pendingDownload) { setStatus(downloadForm, 'Please choose a file to download.'); return; }
      var a = document.createElement('a');
      a.href = pendingDownload.href;
      a.download = pendingDownload.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setStatus(downloadForm, 'Thank you for your support. Your download has started.', true);
    });
  }

  /* ---------- Search ---------- */
  var searchInput = document.getElementById('search-input');
  var searchResults = document.getElementById('search-results');
  var searchStatus = document.getElementById('search-status');
  var searchDialog = document.getElementById('dialog-search');

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function snippet(text, terms) {
    var lower = text.toLowerCase();
    var pos = lower.indexOf(terms[0]);
    var start = Math.max(0, pos - 60);
    var s = (start > 0 ? '…' : '') + text.slice(start, start + 180) + (start + 180 < text.length ? '…' : '');
    var out = escapeHtml(s);
    terms.forEach(function (t) {
      out = out.replace(new RegExp('(' + escapeRegExp(escapeHtml(t)) + ')', 'gi'), '<mark>$1</mark>');
    });
    return out;
  }

  function runSearch() {
    var q = searchInput.value.trim().toLowerCase();
    searchResults.innerHTML = '';
    if (q.length < 2) { searchStatus.textContent = 'Type to search pages, news and people.'; return; }
    var index = window.SEARCH_INDEX;
    if (!index) { searchStatus.textContent = 'Search is still loading. Please try again in a moment.'; return; }
    var terms = q.split(/\s+/).filter(Boolean);
    var hits = index.map(function (p) {
      var hay = (p.title + ' ' + p.description + ' ' + p.text).toLowerCase();
      if (!terms.every(function (t) { return hay.indexOf(t) !== -1; })) return null;
      var score = terms.reduce(function (s, t) { return s + (p.title.toLowerCase().indexOf(t) !== -1 ? 10 : 0) + hay.split(t).length; }, 0);
      return { page: p, score: score };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; }).slice(0, 8);

    if (!hits.length) {
      searchStatus.textContent = 'No results for “' + searchInput.value.trim() + '”. Try a different word, such as “textiles” or “education”.';
      return;
    }
    searchStatus.textContent = hits.length + (hits.length === 1 ? ' result' : ' results');
    searchResults.innerHTML = hits.map(function (h) {
      var src = h.page.text.toLowerCase().indexOf(terms[0]) !== -1 ? h.page.text : h.page.description;
      return '<li><a href="' + root + h.page.url + '"><span class="search-results__title">' + escapeHtml(h.page.title) + '</span>'
        + '<span class="search-results__snippet">' + snippet(src, terms) + '</span></a></li>';
    }).join('');
  }

  if (searchInput) {
    var timer;
    searchInput.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(runSearch, 120); });
    document.querySelector('[data-search-form]').addEventListener('submit', function (e) {
      e.preventDefault();
      var first = searchResults.querySelector('a');
      if (first) first.click(); else runSearch();
    });
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { var first = searchResults.querySelector('a'); if (first) { e.preventDefault(); first.focus(); } }
    });
    searchResults.addEventListener('keydown', function (e) {
      var links = Array.prototype.slice.call(searchResults.querySelectorAll('a'));
      var i = links.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && i < links.length - 1) { e.preventDefault(); links[i + 1].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? links[i - 1] : searchInput).focus(); }
    });
    searchDialog.addEventListener('close', function () { searchInput.value = ''; runSearch(); });
  }

  // Keyboard shortcut: "/" opens search
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !document.querySelector('dialog[open]') && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
      e.preventDefault();
      openDialog('dialog-search', document.activeElement);
    }
  });
})();

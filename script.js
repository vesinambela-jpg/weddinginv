(function () {
  'use strict';

  // Paste the Google Apps Script Web App URL here after deploying
  // google-apps-script.gs (see that file for setup steps). Leave blank
  // to keep the site working in local-only mode (wishes stay on each
  // visitor's own device instead of syncing to the spreadsheet).
  var GOOGLE_SHEET_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxch-GISiZAYHd94c-aIZ3DyT92-Tv3YfDqM4PyIbgIQJ8oftCvU1OfnCkzYyAemyUa/exec';

  var STORAGE_KEY = 'bastianvero-wishes';

  function loadWishes() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveWishes(wishes) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wishes));
    } catch (e) {
      /* storage unavailable, ignore */
    }
  }

  function renderWishList(wishes) {
    var list = document.getElementById('wishesList');
    var emptyItem = document.getElementById('wishesEmpty');
    if (!list) return;

    Array.prototype.slice.call(list.querySelectorAll('[data-wish]')).forEach(function (el) {
      el.remove();
    });

    if (!wishes || wishes.length === 0) {
      if (emptyItem) emptyItem.hidden = false;
      return;
    }
    if (emptyItem) emptyItem.hidden = true;

    wishes.forEach(function (wish) {
      var li = document.createElement('li');
      li.setAttribute('data-wish', '');
      var strong = document.createElement('strong');
      strong.textContent = wish.name;
      var p = document.createElement('p');
      p.style.margin = '0';
      p.textContent = wish.message;
      li.appendChild(strong);
      li.appendChild(p);
      list.appendChild(li);
    });
  }

  function renderLocalWishes() {
    var wishes = loadWishes().slice().reverse();
    renderWishList(wishes);
  }

  function loadWishesFromSheet() {
    if (!GOOGLE_SHEET_SCRIPT_URL) {
      renderLocalWishes();
      return;
    }
    fetch(GOOGLE_SHEET_SCRIPT_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (wishes) {
        if (!Array.isArray(wishes)) throw new Error('Unexpected response');
        renderWishList(wishes);
      })
      .catch(function (err) {
        if (window.console) {
          console.warn('Could not load wishes from the Google Sheet (' + err.message + '). ' +
            'Check the Apps Script is deployed with access set to "Anyone".');
        }
        // Sheet unreachable (offline, not deployed yet, etc). Fall back
        // to whatever this visitor has submitted locally.
        renderLocalWishes();
      });
  }

  function initRsvpForm() {
    var form = document.getElementById('rsvpForm');
    if (!form) return;
    var status = document.getElementById('rsvpStatus');
    var guestsField = document.getElementById('rsvpGuestsField');

    // "Number of guests" only applies to guests who are coming.
    function syncGuests() {
      var declined = form.attend.value === 'no';
      guestsField.hidden = declined;
      form.guests.required = !declined;
      if (declined) form.guests.value = '';
    }
    form.attend.addEventListener('change', syncGuests);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.name.value.trim();
      var attend = form.attend.value;
      var guests = attend === 'no' ? '0' : form.guests.value;
      var message = form.message.value.trim();
      if (!name || !attend) return;

      var entry = {
        name: name,
        attend: attend,
        guests: guests,
        message: message,
        at: Date.now()
      };

      var wishes = loadWishes();
      wishes.push(entry);
      saveWishes(wishes);

      if (GOOGLE_SHEET_SCRIPT_URL) {
        fetch(GOOGLE_SHEET_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(entry)
        }).catch(function () {
          /* best effort; the local copy above is the fallback */
        });
      }

      if (message) {
        var list = document.getElementById('wishesList');
        var emptyItem = document.getElementById('wishesEmpty');
        if (list) {
          if (emptyItem) emptyItem.hidden = true;
          var li = document.createElement('li');
          li.setAttribute('data-wish', '');
          var strong = document.createElement('strong');
          strong.textContent = name;
          var p = document.createElement('p');
          p.style.margin = '0';
          p.textContent = message;
          li.appendChild(strong);
          li.appendChild(p);
          list.insertBefore(li, list.firstChild);
        }
      }

      form.reset();
      // Reset clears the locked name from the guest's link; put it back.
      if (form.name.readOnly) form.name.value = form.name.defaultValue = name;
      syncGuests();
      if (status) {
        status.hidden = false;
        status.textContent = attend === 'yes'
          ? 'Thank you, ' + name + '! We can\'t wait to celebrate with you.'
          : 'Thank you, ' + name + '. We\'ll miss you, but we appreciate your wishes.';
      }
    });
  }

  // Wires up the overlay/close-button/Escape behavior shared by every
  // .modal on the page. Returns a close() function so callers can also
  // close the modal themselves (e.g. after handling a click elsewhere).
  function bindModalClose(modal) {
    function close() {
      modal.hidden = true;
    }
    Array.prototype.slice.call(modal.querySelectorAll('[data-modal-close]')).forEach(function (el) {
      el.addEventListener('click', close);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) close();
    });
    return close;
  }

  function initGiftModal() {
    var btn = document.getElementById('giftBtn');
    var modal = document.getElementById('giftModal');
    if (!btn || !modal) return;

    bindModalClose(modal);
    btn.addEventListener('click', function () {
      modal.hidden = false;
    });

    Array.prototype.slice.call(modal.querySelectorAll('[data-copy-btn]')).forEach(function (btnEl) {
      btnEl.addEventListener('click', function () {
        var card = btnEl.closest('.bank-card');
        var numberEl = card ? card.querySelector('[data-copy-value]') : null;
        var value = numberEl ? numberEl.getAttribute('data-copy-value') : '';
        if (!value) return;

        var done = function () {
          var original = btnEl.textContent;
          btnEl.textContent = 'Copied!';
          btnEl.setAttribute('data-copied', '');
          setTimeout(function () {
            btnEl.textContent = original;
            btnEl.removeAttribute('data-copied');
          }, 1800);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(value).then(done).catch(function () {
            fallbackCopy(value);
            done();
          });
        } else {
          fallbackCopy(value);
          done();
        }
      });
    });
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  function initPhotoLightbox() {
    var modal = document.getElementById('photoModal');
    var img = document.getElementById('photoModalImg');
    var caption = document.getElementById('photoModalCaption');
    var photos = Array.prototype.slice.call(document.querySelectorAll('.polaroid, .gallery__photo'));
    if (!modal || !img || !caption || photos.length === 0) return;

    bindModalClose(modal);

    photos.forEach(function (btn) {
      btn.addEventListener('click', function () {
        img.src = btn.getAttribute('data-full') || btn.querySelector('img').src;
        img.alt = btn.querySelector('img').alt || '';
        var captionText = btn.getAttribute('data-caption') || '';
        caption.textContent = captionText;
        caption.hidden = !captionText;
        modal.hidden = false;
      });
    });
  }

  // Pins the whole "Our Story" section while the visitor scrolls through
  // its (tall, invisible) track: the chapter title/blurb crossfade and a
  // new photo lands on the pile roughly once per "step" of scroll distance.
  function initStory() {
    var track = document.querySelector('[data-story]');
    if (!track) return;

    var pin = track.querySelector('.story__pin');
    var chaptersEl = track.querySelector('.story__chapters');
    var chapters = Array.prototype.slice.call(track.querySelectorAll('.story__chapter'));
    var stack = track.querySelector('.story__stack');
    var polaroids = Array.prototype.slice.call(track.querySelectorAll('.polaroid'));
    if (!pin || !stack || polaroids.length === 0) return;

    var STEP_PX = 220; // scroll distance, in pixels, spent revealing each photo
    // Height of one repeat of the toile background (background-size 540px
    // on a 1080x1620 image). The pinned scroll distance is rounded to a
    // whole number of these so the pin's background lines up with the
    // page's again when it unpins, instead of leaving a visible seam.
    var TILE_PX = 810;
    var invitation = track.closest('.invitation');
    var PEEK_PX = 12; // vertical offset each further photo adds to the pile

    // A little natural variety in how each card sits in the pile, picked
    // once so it stays put across the re-layouts below.
    polaroids.forEach(function (p, i) {
      var rot = (Math.random() * 8 - 4).toFixed(2); // -4deg..4deg
      var peek = (Math.random() * 16 - 8).toFixed(1); // -8px..8px sideways jitter
      p.style.setProperty('--rot', rot + 'deg');
      p.style.setProperty('--peekx', peek + 'px');
      p.style.top = (i * PEEK_PX) + 'px';
      p.style.zIndex = String(i + 1);
    });

    function setActiveChapter(index) {
      chapters.forEach(function (c) {
        var active = Number(c.getAttribute('data-chapter')) === index;
        c.classList.toggle('is-active', active);
        c.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
    }

    if (!window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      polaroids.forEach(function (p) { p.classList.add('is-visible'); });
      chapters.forEach(function (c) { c.removeAttribute('aria-hidden'); });
      return;
    }

    function layout() {
      var maxChapterHeight = chapters.reduce(function (max, c) {
        return Math.max(max, c.offsetHeight);
      }, 0);
      chaptersEl.style.height = maxChapterHeight + 'px';

      var steps = polaroids.length - 1;
      // Photos are absolutely positioned (so the stack doesn't get its
      // height from them); size the stack from one photo's own height
      // plus the peeking sliver each further photo adds underneath it.
      stack.style.height = (polaroids[0].offsetHeight + steps * PEEK_PX) + 'px';
      var pinnedScroll = Math.max(1, Math.round(steps * STEP_PX / TILE_PX)) * TILE_PX;
      track.style.height = (pin.offsetHeight + pinnedScroll) + 'px';
    }

    // Offsets the pin's background so its pattern continues the page's
    // exactly where the pin starts (re-run on scroll since lazy images
    // above can still shift this section's position after load).
    function alignBackground() {
      if (!invitation) return;
      var t = track.getBoundingClientRect();
      var inv = invitation.getBoundingClientRect();
      pin.style.backgroundPosition = (inv.left - t.left) + 'px ' + (inv.top - t.top) + 'px';
    }

    function update() {
      alignBackground();
      var rect = track.getBoundingClientRect();
      var stickyTop = parseFloat(getComputedStyle(pin).top) || 0;
      var maxScroll = track.offsetHeight - pin.offsetHeight;
      var progress = maxScroll > 0 ? (stickyTop - rect.top) / maxScroll : 0;
      progress = Math.min(Math.max(progress, 0), 1);

      var steps = polaroids.length - 1;
      var activeChapter = 0;
      polaroids.forEach(function (p, i) {
        var threshold = steps > 0 ? i / steps : 0;
        var visible = progress >= threshold - 0.001;
        p.classList.toggle('is-visible', visible);
        if (visible) activeChapter = Number(p.getAttribute('data-chapter'));
      });
      setActiveChapter(activeChapter);
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        update();
        ticking = false;
      });
    }

    layout();
    update();
    // Fonts/images can still be settling in at DOMContentLoaded, which
    // would measure a too-short stack; re-measure once everything's in.
    window.addEventListener('load', function () {
      layout();
      update();
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () {
      layout();
      update();
    });
  }

  // Opening cover. A guest link looks like ?to=<name>&k=<code>; the code is
  // made by the Apps Script (GUEST_URL in the "List undangan" tab) from the
  // name and a private key, so the cover asks the script to confirm it before
  // letting anyone in. Edited names, missing codes or guests removed from
  // the list get an error instead of the invitation.
  function initCover() {
    var cover = document.getElementById('cover');
    var openBtn = document.getElementById('coverOpen');
    var retryBtn = document.getElementById('coverRetry');
    var greeting = document.getElementById('coverGreeting');
    var status = document.getElementById('coverStatus');
    if (!cover || !openBtn) return;

    var params = new URLSearchParams(window.location.search);
    var name = (params.get('to') || '').trim();
    var code = (params.get('k') || '').trim();

    function showStatus(message, canRetry) {
      greeting.hidden = true;
      openBtn.hidden = true;
      status.textContent = message;
      status.hidden = false;
      retryBtn.hidden = !canRetry;
    }

    function welcome(guestName) {
      document.getElementById('coverGuest').textContent = guestName;
      // Pre-fill the RSVP name with the exact name from the guest list, so
      // RSVP rows match the "List undangan" tab (its Attend? lookup).
      // It's locked (read-only) so the RSVP always matches the invited guest.
      var rsvpName = document.getElementById('rsvpName');
      if (rsvpName) {
        rsvpName.value = rsvpName.defaultValue = guestName;
        rsvpName.readOnly = true;
      }
      status.hidden = true;
      retryBtn.hidden = true;
      greeting.hidden = false;
      openBtn.hidden = false;
    }

    var INVALID = 'Sorry, this invitation link isn\u2019t valid. Please open the exact link that was sent to you.';
    var OFFLINE = 'We couldn\u2019t open your invitation just now. Please check your connection and try again.';
    var OPEN_LABEL = openBtn.textContent;
    // 'pending' | 'ok' | 'invalid' | 'error'
    var state = 'pending';
    // The guest tapped Open before the check came back.
    var openRequested = false;

    function openInvitation() {
      window.scrollTo(0, 0);
      document.body.classList.remove('is-cover-open');
      cover.classList.add('is-opened');
      cover.setAttribute('aria-hidden', 'true');
    }

    function setOpenWaiting(waiting) {
      openBtn.disabled = waiting;
      openBtn.textContent = waiting ? 'Opening\u2026' : OPEN_LABEL;
    }

    function fail(message, canRetry) {
      openRequested = false;
      setOpenWaiting(false);
      stopMusic();
      showStatus(message, canRetry);
    }

    function check() {
      state = 'pending';
      var url = GOOGLE_SHEET_SCRIPT_URL + '?action=verify&to=' + encodeURIComponent(name) +
        '&k=' + encodeURIComponent(code);
      fetch(url)
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (result) {
          if (result && result.ok) {
            state = 'ok';
            if (result.name && result.name !== name) welcome(result.name);
            if (openRequested) openInvitation();
          } else {
            state = 'invalid';
            fail(INVALID, false);
          }
        })
        .catch(function () {
          state = 'error';
          // Stay quiet unless the guest is already waiting on it; a tap on
          // Open retries.
          if (openRequested) fail(OFFLINE, true);
        });
    }

    if (!name || !code || !GOOGLE_SHEET_SCRIPT_URL) {
      showStatus(INVALID, false);
      return;
    }

    // The Apps Script check takes a couple of seconds (much longer when it
    // has been idle), so greet the guest straight away and check in the
    // background. Open only goes through once the link is confirmed; tapping
    // it earlier just waits for the answer.
    welcome(name);
    check();

    openBtn.addEventListener('click', function () {
      // Start the song inside this tap (browsers block it later); it's
      // stopped again if the link turns out to be invalid.
      startMusic();
      if (state === 'ok') {
        openInvitation();
        return;
      }
      openRequested = true;
      setOpenWaiting(true);
      if (state === 'error') check();
    });
    retryBtn.addEventListener('click', function () {
      status.hidden = true;
      retryBtn.hidden = true;
      greeting.hidden = false;
      openBtn.hidden = false;
      openRequested = true;
      setOpenWaiting(true);
      check();
    });
  }

  // Background song. Has to start inside the Open tap, since browsers
  // block sound that starts without one. The floating button pauses and
  // resumes it, and it pauses while the tab is in the background.
  var music = document.getElementById('bgMusic');
  var musicToggle = document.getElementById('musicToggle');
  var musicWanted = false;

  function setMusicButton(playing) {
    if (!musicToggle) return;
    musicToggle.classList.toggle('is-paused', !playing);
    musicToggle.setAttribute('aria-pressed', playing ? 'true' : 'false');
    musicToggle.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
  }

  function playMusic() {
    var attempt = music.play();
    if (attempt && attempt.catch) {
      attempt.catch(function () { musicWanted = false; setMusicButton(false); });
    }
  }

  function startMusic() {
    if (!music || !musicToggle) return;
    musicWanted = true;
    musicToggle.hidden = false;
    setMusicButton(true);
    playMusic();
  }

  function stopMusic() {
    if (!music || !musicToggle) return;
    musicWanted = false;
    music.pause();
    musicToggle.hidden = true;
  }

  function initMusic() {
    if (!music || !musicToggle) return;
    musicToggle.addEventListener('click', function () {
      musicWanted = music.paused;
      if (musicWanted) playMusic(); else music.pause();
      setMusicButton(musicWanted);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) music.pause();
      else if (musicWanted) playMusic();
    });
  }

  function initCountdown() {
    var el = document.getElementById('countdown');
    if (!el) return;

    // 14 November 2026, 08:30 WIB (UTC+7)
    var target = new Date('2026-11-14T08:30:00+07:00').getTime();
    var nums = {
      days: el.querySelector('[data-cd="days"]'),
      hours: el.querySelector('[data-cd="hours"]'),
      minutes: el.querySelector('[data-cd="minutes"]'),
      seconds: el.querySelector('[data-cd="seconds"]')
    };

    function pad(n) {
      return String(n).padStart(2, '0');
    }

    function tick() {
      var diff = target - Date.now();
      if (diff < 0) diff = 0;

      var days = Math.floor(diff / 86400000);
      var hours = Math.floor((diff % 86400000) / 3600000);
      var minutes = Math.floor((diff % 3600000) / 60000);
      var seconds = Math.floor((diff % 60000) / 1000);

      nums.days.textContent = pad(days);
      nums.hours.textContent = pad(hours);
      nums.minutes.textContent = pad(minutes);
      nums.seconds.textContent = pad(seconds);
    }

    tick();
    setInterval(tick, 1000);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initCover();
    initMusic();
    loadWishesFromSheet();
    initRsvpForm();
    initGiftModal();
    initPhotoLightbox();
    initStory();
    initCountdown();
  });
})();

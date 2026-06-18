(function() {
  var wrapper = document.getElementById('ai-widget-wrapper');
  var toggleBtn = document.getElementById('ai-widget-toggle');
  var reopenBtn = document.getElementById('ai-widget-reopen');
  var hidden = localStorage.getItem('ai_widget_hidden') === 'true';

  function applyHidden() {
    if (hidden) {
      wrapper.style.display = 'none';
      reopenBtn.style.display = 'flex';
    } else {
      wrapper.style.display = 'block';
      reopenBtn.style.display = 'none';
    }
  }
  applyHidden();

  var observer = new MutationObserver(function() {
    var readdyRoot = wrapper.querySelector('[class*="readdy"], [id*="readdy"]') || wrapper.children[1];
    if (readdyRoot && toggleBtn.style.display === 'none') {
      toggleBtn.style.display = 'flex';
    }
  });
  observer.observe(wrapper, { childList: true, subtree: true });

  toggleBtn.addEventListener('click', function() {
    hidden = true;
    localStorage.setItem('ai_widget_hidden', 'true');
    applyHidden();
  });

  reopenBtn.addEventListener('click', function() {
    hidden = false;
    localStorage.setItem('ai_widget_hidden', 'false');
    applyHidden();
    setTimeout(function() {
      var input = wrapper.querySelector('input, textarea, [contenteditable]');
      if (input) input.focus();
    }, 300);
  });
})();
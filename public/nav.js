// Phone navigation: a disclosure for the main nav under 760 px (design audit F-16).
// Without JavaScript the links simply wrap, as before; the CSS only collapses them
// under `scripting: enabled`, so nothing shifts while this file loads.
(() => {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.getElementById('site-nav');
  if (!toggle || !menu) return;
  const set = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
  };
  toggle.addEventListener('click', () => set(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      set(false);
      toggle.focus();
    }
  });
  matchMedia('(min-width: 761px)').addEventListener('change', (e) => { if (e.matches) set(false); });
})();

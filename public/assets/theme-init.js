(function () {
  try {
    var saved = localStorage.getItem('cosmos.settings.v1');
    var theme = saved ? (JSON.parse(saved).theme || 'dark') : 'dark';
    if (theme !== 'light' && theme !== 'dark') theme = 'dark';
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
})();

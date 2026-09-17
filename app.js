(async () => {
  try {
    await import('./v02-main.js');
    const {initThemes}=await import('./themes.js');
    initThemes();
  } catch (error) {
    console.error('Trade Wars failed to load', error);
    const toast=document.getElementById('toast');
    if(toast){toast.textContent='Trade Wars update failed to load. Refresh to retry.';toast.classList.add('show');}
  }
})();

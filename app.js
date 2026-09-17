(async () => {
  try {
    await import('./v02-main.js');
  } catch (error) {
    console.error('Trade Wars core failed to load', error);
    const toast=document.getElementById('toast');
    if(toast){toast.textContent='Trade Wars core failed to load. Refresh to retry.';toast.classList.add('show');}
    return;
  }

  try {
    const {initThemes}=await import('./themes.js?v=4');
    initThemes();
  } catch (error) {
    console.error('Trade Wars theme layer failed to load', error);
    const toast=document.getElementById('toast');
    if(toast){toast.textContent=`Theme layer failed: ${error?.message || 'unknown error'}`;toast.classList.add('show');}
  }
})();

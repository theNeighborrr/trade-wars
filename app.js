(async () => {
  try {
    await import('./v02-main.js?cache=13');
  } catch (error) {
    console.error('Trade Wars core failed to load', error);
    const toast=document.getElementById('toast');
    if(toast){toast.textContent=`Trade Wars core failed: ${error?.message || 'unknown error'}`;toast.classList.add('show');}
    return;
  }

  try {
    const {initThemes}=await import('./themes.js?cache=7');
    initThemes();
  } catch (error) {
    console.error('Trade Wars theme layer failed to load', error);
    const toast=document.getElementById('toast');
    if(toast){toast.textContent=`Theme layer failed: ${error?.message || 'unknown error'}`;toast.classList.add('show');}
  }
})();

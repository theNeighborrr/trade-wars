(async () => {
  try {
    await import('./v02-main.js?cache=17');
  } catch (error) {
    console.error('Trade Wars core failed to load', error);
    const toast=document.getElementById('toast');
    if(toast){toast.textContent=`Trade Wars core failed: ${error?.message || 'unknown error'}`;toast.classList.add('show');}
    return;
  }

  try {
    const {initThemes}=await import('./themes.js?cache=15');
    initThemes();
  } catch (error) {
    console.error('Trade Wars theme layer failed to load', error);
    const toast=document.getElementById('toast');
    if(toast){toast.textContent=`Theme layer failed: ${error?.message || 'unknown error'}`;toast.classList.add('show');}
  }
  try {
    const {initLeaderboard}=await import('./v07-leaderboard.js?cache=17');
    initLeaderboard();
  } catch (error) {
    console.warn('Optional leaderboard interface could not load', error);
    document.addEventListener('tw:leaderboard',()=>{
      const toast=document.getElementById('toast');
      if(toast){toast.textContent='Leaderboard unavailable. Your campaign is safe; refresh to retry.';toast.classList.add('show');}
    });
  }
})();

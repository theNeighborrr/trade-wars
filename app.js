(() => {
  import('./v02-main.js').catch(error => {
    console.error('Trade Wars v0.2 failed to load', error);
    const toast=document.getElementById('toast');
    if(toast){toast.textContent='Trade Wars update failed to load. Refresh to retry.';toast.classList.add('show');}
  });
})();

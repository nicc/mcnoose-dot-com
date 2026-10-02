// A note for visitors while the site is unfinished: shown once per browser, then remembered.
// If storage is unavailable (private mode, blocked), it shows on each visit rather than never.
export const NOTICE_SEEN = 'mcnoose-wip-seen';

export function showNotice(): void {
  try {
    if (localStorage.getItem(NOTICE_SEEN)) return;
    localStorage.setItem(NOTICE_SEEN, '1');
  } catch {
    // show it anyway
  }
  const dialog = document.createElement('dialog');
  dialog.className = 'notice';
  dialog.tabIndex = -1; // focus the card, not the button, so no focus ring shows until someone tabs
  dialog.innerHTML = '<p>This site is still being built.</p><form method="dialog"><button>OK</button></form>';
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close()); // a tap outside the card
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  dialog.focus();
}

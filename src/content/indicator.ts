/**
 * @module content/indicator
 * @description Transient "extension active" visual indicator for the content script.
 *
 * Injects a small fixed-position badge onto the Okta page for a few seconds so the
 * user can see the extension has attached, then fades it out and removes it.
 *
 * @see `content/index` for the DOM-ready wiring that invokes this on load.
 */

/**
 * Inject the "Okta Unbound Active" badge into the page, then fade and remove it
 * after a short delay.
 */
export function injectIndicator(): void {
  const indicator = document.createElement('div');
  indicator.id = 'okta-extension-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #1a1a1a;
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    z-index: 999999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  indicator.textContent = 'Okta Unbound Active';

  document.body.appendChild(indicator);
  setTimeout(() => {
    indicator.style.transition = 'opacity 0.3s';
    indicator.style.opacity = '0';
    setTimeout(() => indicator.remove(), 300);
  }, 3000);
}

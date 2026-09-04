const query = '(prefers-color-scheme: dark)';

function apply(dark: boolean): void {
  document.documentElement.classList.toggle('dark', dark);
}

export function followSystemTheme(): void {
  const media = window.matchMedia(query);
  apply(media.matches);
  media.addEventListener('change', (event) => apply(event.matches));
}

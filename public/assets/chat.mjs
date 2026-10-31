if (new URLSearchParams(location.search).has('advanced')) {
  await import('./app.mjs');
} else {
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/assets/chat.css';
  await new Promise((resolve, reject) => {
    css.onload = resolve;
    css.onerror = () => reject(new Error('工作台样式加载失败，请刷新页面。'));
    document.head.append(css);
  });
  await import('./workspace.mjs');
}

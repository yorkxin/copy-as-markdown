window.addEventListener('message', (event) => {
  switch (event.data.cmd) {
    case 'copy': {
      const { text } = event.data;
      if (text === '' || !text) {
        event.source.postMessage({ topic: 'iframe-copy-response', ok: false, reason: 'no text' }, event.origin);
      }

      const textBox = document.getElementById('copy');
      textBox.innerHTML = text;
      textBox.select();
      const result = document.execCommand('Copy');
      if (result) {
        event.source.postMessage({ topic: 'iframe-copy-response', ok: true }, event.origin);
      } else {
        event.source.postMessage({ topic: 'iframe-copy-response', ok: false, reason: 'execCommand returned false' }, event.origin);
      }
      textBox.innerHTML = '';
      break;
    }

    default: {
      event.source.postMessage({ topic: 'iframe-copy-response', ok: false, reason: `unknown command ${event.data.cmd}` }, event.origin);
    }
  }
});

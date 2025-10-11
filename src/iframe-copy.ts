interface CopyMessage {
  cmd: string;
  text?: string;
}

interface CopyResponse {
  topic: string;
  ok: boolean;
  reason?: string;
}

window.addEventListener('message', (event: MessageEvent<CopyMessage>) => {
  switch (event.data.cmd) {
    case 'copy': {
      const { text } = event.data;
      if (text === '' || !text) {
        (event.source as Window).postMessage(
          { topic: 'iframe-copy-response', ok: false, reason: 'no text' } as CopyResponse,
          event.origin,
        );
        return;
      }

      const textBox = document.getElementById('copy') as HTMLTextAreaElement;
      textBox.innerHTML = text;
      textBox.select();
      const result = document.execCommand('Copy');
      if (result) {
        (event.source as Window).postMessage(
          { topic: 'iframe-copy-response', ok: true } as CopyResponse,
          event.origin,
        );
      } else {
        (event.source as Window).postMessage(
          { topic: 'iframe-copy-response', ok: false, reason: 'execCommand returned false' } as CopyResponse,
          event.origin,
        );
      }
      textBox.innerHTML = '';
      break;
    }

    default: {
      (event.source as Window).postMessage(
        { topic: 'iframe-copy-response', ok: false, reason: `unknown command ${event.data.cmd}` } as CopyResponse,
        event.origin,
      );
    }
  }
});

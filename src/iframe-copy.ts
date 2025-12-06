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
  if (!event.source) {
    throw new Error('No event source');
  }
  const options: WindowPostMessageOptions = {
    targetOrigin: event.origin,
  };
  switch (event.data.cmd) {
    case 'copy': {
      const { text } = event.data;
      if (text === '' || !text) {
        event.source.postMessage(
          { topic: 'iframe-copy-response', ok: false, reason: 'no text' } as CopyResponse,
          options,
        );
        return;
      }

      const textBox = document.getElementById('copy') as HTMLTextAreaElement;
      textBox.value = text;
      textBox.select();
      const result = document.execCommand('Copy');
      if (result) {
        event.source.postMessage(
          { topic: 'iframe-copy-response', ok: true } as CopyResponse,
          options,
        );
      } else {
        event.source.postMessage(
          { topic: 'iframe-copy-response', ok: false, reason: 'execCommand returned false' } as CopyResponse,
          options,
        );
      }
      textBox.value = '';
      break;
    }

    default: {
      event.source.postMessage(
        { topic: 'iframe-copy-response', ok: false, reason: `unknown command ${event.data.cmd}` } as CopyResponse,
        options,
      );
    }
  }
});

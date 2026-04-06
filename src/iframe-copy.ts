interface CopyMessage {
  cmd: string;
  text?: string;
}

interface CopyResponse {
  topic: string;
  ok: boolean;
  reason?: string;
}

window.addEventListener('message', async (event: MessageEvent<CopyMessage>) => {
  const replyPort = event.ports[0];

  const respond = (response: CopyResponse) => {
    if (replyPort) {
      replyPort.postMessage(response);
      return;
    }
    if (!event.source) {
      throw new Error('No reply channel');
    }
    event.source.postMessage(response, {
      targetOrigin: '*',
    });
  };

  switch (event.data.cmd) {
    case 'copy': {
      const { text } = event.data;
      if (text === '' || !text) {
        respond({ topic: 'iframe-copy-response', ok: false, reason: 'no text' } as CopyResponse);
        return;
      }

      try {
        await navigator.clipboard.writeText(text);
        respond({ topic: 'iframe-copy-response', ok: true } as CopyResponse);
        return;
      } catch {
        const textBox = document.getElementById('copy') as HTMLTextAreaElement;
        textBox.value = text;
        textBox.select();
        const result = document.execCommand('Copy');
        if (result) {
          respond({ topic: 'iframe-copy-response', ok: true } as CopyResponse);
        } else {
          respond({ topic: 'iframe-copy-response', ok: false, reason: 'execCommand returned false' } as CopyResponse);
        }
        textBox.value = '';
      }
      break;
    }

    default: {
      respond({ topic: 'iframe-copy-response', ok: false, reason: `unknown command ${event.data.cmd}` } as CopyResponse);
    }
  }
});

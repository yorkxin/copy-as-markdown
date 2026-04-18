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
      targetOrigin: event.origin,
    });
  };

  switch (event.data.cmd) {
    case 'copy': {
      const { text } = event.data;
      if (text === '' || !text) {
        // NOTE: in this case the caller from content-script.ts would try the next method,
        // but really since there is no text it should not try anymore.
        // The call site should instead avoid calling clipboard service when the text is empty,
        // becuase there is nothing that can be written to the clipboard.
        respond({ topic: 'iframe-copy-response', ok: false, reason: 'no text' } as CopyResponse);
        return;
      }

      try {
        await navigator.clipboard.writeText(text);
        respond({ topic: 'iframe-copy-response', ok: true } as CopyResponse);
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

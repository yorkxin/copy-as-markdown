import messageHandler from './lib/message-handler.js'
import { flashSuccessBadge } from '../lib/badge.js'

// listen to keyboard shortcuts
browser.commands.onCommand.addListener(command => {
  return messageHandler({
    topic: "copy",
    params: {
      action: command
    }
  })
  .then(response => flashSuccessBadge(response.size))
});

// listen to messages from popup
browser.runtime.onMessage.addListener(payload => {
  return messageHandler(payload)
})

function flashBadge(type, text) {
  let color;

  switch (type) {
    case "success":
      color = "#738a05";
      break;
    case "fail":
      color = "#d11b24";
      text = "!";
      break;
    default:
      return; // don't know what it is. quit.
  }

  browser.browserAction.setBadgeText({
    "text": String(text)
  });

  browser.browserAction.setBadgeBackgroundColor({
    "color": color
  });

  setTimeout(clearBadge, 3000);
}

function clearBadge() {
  browser.browserAction.setBadgeText({
    text: ""
  });

  browser.browserAction.setBadgeBackgroundColor({
    color: [0, 0, 0, 255] // opaque
  });
}

export default flashBadge;

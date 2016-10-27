// context menu event detection
var contextInfo = {
   anchorElem: null,
   imgElem: null,
   src: null,
   alt: null,
   innerText: null,
   href: null,
};

document.addEventListener("contextmenu", function(e) {
   var elem = e.target;
   var innerText, href, alt, src;
   // If target was an image
   if (elem instanceof HTMLImageElement) {
      contextInfo.imgElem = elem.target;
      src = elem.src;
      alt = elem.getAttribute('alt');
      console.log("sfinktah: received right-click for ![" + alt + "](" + src + ")");
      // It won't send whole elements
      contextInfo.src = src;
      contextInfo.alt = alt;
   }
   // regardless, also traverse up tree for a containing `<a href>`
   while (elem) {
      if (elem instanceof HTMLAnchorElement) {
         var href = elem.href;
         if (elem.innerText == null) {
            innerText = '';
         } else {
            innerText = elem.innerText.trim();
         }
         console.log("sfinktah: received right-click for [" + innerText + "](" + href + ")");

         // It won't send whole elements 
         // contextInfo.anchorElem = elem;
         contextInfo.innerText = innerText;
         contextInfo.href = href;
         break;
      } else {
         elem = elem.parentNode;
      }
   }
}, {
   capture: true,
   passive: true 
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if(request == "getContextInfo") {
        sendResponse(contextInfo);
    }
});

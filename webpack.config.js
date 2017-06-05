const path = require("path");

module.exports = {
  entry: {
    background: [
      "./background/context-menu.js",
      "./background/command.js",
      "./background/service.js"
    ],
    options: [
      "./common/options.js",
      "./options/ui.js"
    ],
    popup: [
      "./popup/popup.js"
    ]
  },
  output: {
    path: path.resolve(__dirname, "extension"),
    filename: "[name].dist.js"
  },
  resolve: {
    modules: [
      path.resolve(__dirname, "common"),
      "node_modules"
    ]
  }
};

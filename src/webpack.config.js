const path = require("path");
const CopyWebpackPlugin = require('copy-webpack-plugin');

if (!process.env.TARGET) {
  throw Error("Please specify env var TARGET, 'chrome' or 'firefox'.")
} else if (!(process.env.TARGET === 'chrome' || process.env.TARGET === 'firefox')) {
  throw Error("TARGET can only be 'chrome' or 'firefox'.")
} else {
  console.info(`\x1b[1;32mBuilding for target ${process.env.TARGET}...\x1b[m`)
}

module.exports = {
  entry: {
    background: [
      "./background/context-menu.js",
      "./background/command.js",
      "./background/service.js"
    ],
    options: "./ui/options.js",
    popup: "./ui/popup.js"
  },
  output: {
    path: path.resolve(__dirname, "build", process.env.TARGET),
    filename: "[name].dist.js"
  },
  resolve: {
    modules: [
      path.resolve(__dirname, "common"),
      "node_modules"
    ]
  },
  plugins: [
    new CopyWebpackPlugin([
      { from: './static/', to: './' }
    ])
  ]
};

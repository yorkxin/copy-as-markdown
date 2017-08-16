const path = require("path");
const CopyWebpackPlugin = require('copy-webpack-plugin');

if (!process.env.TARGET) {
  throw Error("Please specify env var TARGET, 'chrome' or 'firefox'.")
} else if (!(process.env.TARGET === 'chrome' || process.env.TARGET === 'firefox')) {
  throw Error("TARGET can only be 'chrome' or 'firefox'.")
} else {
  console.info(`\x1b[1;32mBuilding for target ${process.env.TARGET}...\x1b[m`)
}

let config = {
  context: path.resolve(__dirname, "src"),
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
      path.resolve(__dirname, "src", "common"),
      path.resolve(__dirname, "node_modules")
    ]
  },
  plugins: [
    new CopyWebpackPlugin([
      { from: './static/', to: './' },
      { from: `./manifest.${process.env.TARGET}.json`, to: `./manifest.json` }
    ])
  ]
};

if (process.env.TARGET === 'firefox') {
  config.entry["content-script"] = [
    "./content-script/clipboard.js"
  ];
}

module.exports = config;

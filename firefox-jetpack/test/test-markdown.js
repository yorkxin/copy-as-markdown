const Markdown = require("../lib/markdown");

exports["test formatLink"] = function(assert) {
  var actual;

  actual = Markdown.formatLink("http://example.com", "text");
  assert.equal(actual, "[text](http://example.com)", "normal input");

  actual = Markdown.formatLink("http://example.com", "");
  assert.equal(actual, "[(No Title)](http://example.com)", "empty title");

  actual = Markdown.formatLink("http://example.com", '[Shin_Bangumi] Anime \\ Yuruyuri <S> San * High');
  assert.equal(actual, '[[Shin_Bangumi] Anime \\ Yuruyuri <S> San * High](http://example.com)', "no escape by default");

  actual = Markdown.formatLink("http://example.com", '[Shin_Bangumi] Anime \\ Yuruyuri <S> San * High', { escape: true });
  assert.equal(actual, '[\\\[Shin\\\_Bangumi\\\] Anime \\\\ Yuruyuri \\\<S\\\> San \\\* High](http://example.com)', "escapes when explicitly requested");

  actual = Markdown.formatLink("http://example.com",
    '![test](https://media.giphy.com/media/ACQ6dBWweIEIU/giphy.gif)',
    { escape: false }
  );
  assert.equal(actual, '[![test](https://media.giphy.com/media/ACQ6dBWweIEIU/giphy.gif)](http://example.com)', "disabled escape");
};

exports["test formatImage"] = function(assert) {
  var actual;

  actual = Markdown.formatImage("https://media.giphy.com/media/ACQ6dBWweIEIU/giphy.gif", "coin jump");
  assert.equal(actual, "![coin jump](https://media.giphy.com/media/ACQ6dBWweIEIU/giphy.gif)", "normal input");
};

exports["test formatList"] = function(assert) {
  var actual;

  actual = Markdown.formatList(["el", "psy", "congroo"]);
  assert.equal(actual, "- el\n- psy\n- congroo\n", "normal input");
};

require("sdk/test").run(exports);

var views = require("mojo-views");

module.exports = views.Base.extend({
  paper: require("./index.pc"),
  sections: {
    articles: require("./articles")
  }
});
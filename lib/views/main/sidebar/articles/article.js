var views = require("mojo-views");

module.exports = views.Base.extend({
  paper: require("./article.pc"),
  sections: {
    headlines: {
      type: "list",
      source: "model.article.headlines",
      modelViewClass: require("./headline")
    }
  }
});
var async     = require("async"),
child_process = require("child_process"),
spawn         = child_process.spawn,
exec          = child_process.exec,
mkdirp        = require("mkdirp"),
glob          = require("glob"),
fs            = require("fs"),
path          = require("path"),
marked        = require("marked"),
bindable      = require("bindable"),
rmdir = require("rmdir");

exports.generate = function (options, complete) {

  options.tmpDir = "/tmp/doc-generator";
  options.outputFile = process.env.HOME + "/Desktop/test.html";
  options.cache = true;

  async.waterfall([
    makeTmpDir.bind(this, options),
    downloadRepositories.bind(this, options),
    parseDocs.bind(this, options),
    generateDocs.bind(this, options),
    writeDocs.bind(this, options)
  ], complete);

};

function makeTmpDir (options, complete) {
  console.log("make temp directory %s", options.tmpDir);

  async.waterfall([
    function (next) {
      if (options.cache) return next();
      rmdir(options.tmpDir, function () {
        next();
      });
    },
    function (next) {
      mkdirp(options.tmpDir, function () {
        next();
      });
    }
  ], complete);
}

function downloadRepositories (options, complete) {
  console.log("cloning repositories");
  async.eachSeries(options.repositories, function (repository, next) {  
    console.log("clone %s -> %s", repository, options.tmpDir);
    var proc = spawn("git", ["clone", repository], { cwd: options.tmpDir });
    // proc.stdout.pipe(process.stdout);
    // proc.stderr.pipe(process.stderr);
    proc.on("exit", function () {
      next();
    });
  }, complete);
}

function parseDocs (options, complete) {
  packageFiles = glob.sync(options.tmpDir + "/*/package.json");

  async.mapSeries(packageFiles, function (packageFile, next) {

    var package = require(packageFile),
    readme      = fs.readFileSync(path.dirname(packageFile) + "/README.md", "utf8");


    var doc = {
      name: package.name,
      version: package.version,
      description: package.description,
      repository: package.repository ? package.repository.url : void 0,
      article: parseReadme(readme)
    }

    next(null, new bindable.Object(doc));
  }, function (err, docs) {
    if (err) return complete(err);
    complete(null, new bindable.Collection(docs));
  });
}

function parseReadme (readme) {
  var content = marked(readme);

  var doc = {
    headlines: new bindable.Collection(),
    content: content
  };

  var headlines = content.match(/<h\d .*?>.*?<\/h\d>/g) || [];

  for (var i = 0, n = headlines.length; i < n; i++) {
    var headline = headlines[i], info = headline.match(/<(h\d) .*?>(.*?)<\/h\d>/);
    var type = info[1],
    title = info[2].replace(/<.*?>(.*?)<\/.*?>/g, "$1"); // strip all HTML

    doc.headlines.push(new bindable.Object({
      type: type,
      title: title
    }));
  }

  return new bindable.Object(doc);
}

require("paperclip/lib/register");

var Application = require("mojo-application"),
MainView      = require("./views/main");

function generateDocs (options, docs, complete) {

  console.log("generating docs");

  var app = new Application();
  app.use(require("mojo-views"));
  app.use(require("mojo-paperclip"));

  var view = new MainView({
    articles: docs
  }, app);

  complete(null, String(view.render()));
}

function writeDocs (options, html, complete) {
  console.log("writing docs");
  fs.writeFile(options.outputFile, html, complete);
}

exports.generate({
  repositories: [
    "https://github.com/mojo-js/mojo-views.git",
    "https://github.com/mojo-js/mojo-router.git",
    "https://github.com/mojo-js/mojo-paperclip.git",
    "https://github.com/mojo-js/mojo-models.git"
  ]
}, function (err, doc) {

});
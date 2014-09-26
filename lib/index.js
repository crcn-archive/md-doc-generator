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

  if (!options.tmpDir) options.tmpDir =  "/tmp/doc-generator"

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
      article: parseReadme(package.name, readme)
    }

    next(null, new bindable.Object(doc));
  }, function (err, docs) {
    if (err) return complete(err);
    complete(null, new bindable.Collection(docs));
  });
}


function getCleanTitle (text) {
  return text.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function stripHTML (text) {
  return text.replace(/<[^>]*>/g,"");
}


function parseReadme (name, readme) {

  var renderer = new marked.Renderer();
  renderer.heading = function (text, level) {
    var _id = getLink(text);
    var buffer = "<h" + level + " class='headline' id='"+_id+"'>";
    buffer += "<a href='#"+ _id + "' class='link'><span class='glyphicon glyphicon-link'></span></a>"

    buffer += text;

    buffer += "</h" + level + ">";
    return buffer;
  }

  function getLink (text) {
    return name + getCleanTitle(stripHTML(text));
  }

  var content = marked(readme, { 
    renderer: renderer
  });

  var doc = {
    headlines: new bindable.Collection()
  };

  var headlines = content.match(/<h\d .*?>.*?<\/h\d>/g) || [];

  for (var i = 0, n = headlines.length; i < n; i++) {
    var headline = headlines[i], info = headline.match(/<(h\d) .*?>(.*?)<\/h\d>/);
    var type = info[1],
    title = stripHTML(info[2]); // strip all HTML
    link = getLink(title);

    doc.headlines.push(new bindable.Object({
      type: type,
      title: title,
      link: link
    }));
  }

  doc.content = content;

  return new bindable.Object(doc);
}

require("paperclip/lib/register");

var Application = require("mojo-application"),
MainView      = require("./views/main"),
BodyView      = require("./views/main/body");

function generateDocs (options, docs, complete) {

  console.log("generating docs");

  var app = new Application();
  app.use(require("mojo-views"));
  app.use(require("mojo-paperclip"));

  var view = new (options.bare ? BodyView : MainView)({
    articles: docs
  }, app);

  complete(null, String(view.render()));
}

function writeDocs (options, html, complete) {
  console.log("writing %s", options.output);

  mkdirp(path.dirname(options.output), function () {
    fs.writeFile(options.output, html, complete);
  });
}

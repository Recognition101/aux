/* global require, console, process */

var http   = require("http");
var https  = require("https");
var fs     = require("fs");
var path   = require("path");
var cli    = require("commander");
var express= require("express");
var exphbs = require("express3-handlebars");
var stream = require("connect-stream");
var aux    = require("./aux");
var main = {};
var __ = aux.curry._;

//Command Line Configuration / Utility
main.cfg = {};
main.httpsOpts = {};
main.loadOrError = function(fnm, isJson, err) {
    try {
        var read = fs.readFileSync(fnm);
        return isJson ? JSON.parse(read) : read;
    } catch(e) {
        console.error("FATAL ERROR: Could not load [" + fnm + "]." +
                      isJson ? " Ensure that it is valid JSON." : "");
        return null;
    }
};

cli.version("0.1")
    .usage("This runs the journaling server.")
    .option("-p, --port <n>", "The port number to listen on.", parseInt, 2000)
    .option("-c, --conf <f>", "The name of the configration file.",
            "config.json")
    .option("-k, --key <f>", "The name of the key pem file.", "key.pem")
    .option("-c, --cert <f>", "The name of the certificate file.", "cert.pem")
    .parse(process.argv);

main.cfg = main.loadOrError(cli.conf, true);
main.httpsOpts["key"]  = main.loadOrError(cli.key);
main.httpsOpts["cert"] = main.loadOrError(cli.cert);

if (!main.cfg || !main.httpsOpts.key || !main.httpsOpts.cert) {
    return;
}

//configure express+handlebars server
var hbs = exphbs.create({
    partialsDir: [
        "views/partials/"
    ]
});

var app = express();

main.loadPartials = function(req, res, next) {
    hbs.loadTemplates("views/partials/", {
        cache: app.enabled("view cache"),
        precompiled: true

    }, function(err, templates) {
        if (err) {return next(err);}
        var extRe = new RegExp(hbs.extname + "$");
        templates = Object.keys(templates).map(function(name) {
            return {
                name: name.replace(extRe, ""),
                template: templates[name]
            };
        });
        res.locals.templates = templates.length ? templates : [];
        next();
    });
};

var sessions = express.session({secret: main.cfg["sessionSalt"]});
app.engine("handlebars", hbs.engine);
app.set("view engine", "handlebars");
app.use(express.compress());
app.use(express.limit("30mb"));
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(sessions);

//start processing requests
app.use("/static", express.static('static'));
app.use(aux.auth(main.cfg["upPass"], "Up", main.cfg["login-throttle"]));
app.use(aux.auth(main.cfg["dnPass"], "Dn", main.cfg["login-throttle"]));
app.use(main.loadPartials);
app.use(app.router);

//redirect videos to HTTP server
app.use(aux.redirect(/https:\/\/([^:]*):(\d*)\/(?!thumbs)(.*\.(mp4|m4v))$/,
                     "http://$1:" + (cli.port + 1) + "/$3"));

//folder server
var serveFolder = function(folder) {
    app.use("/ajaxls" + folder, aux.lsApi(folder));
    app.use("/thumbs" + folder, aux.serveThumbs(folder));
    app.use(folder, aux.lsHtml(folder, true));
    app.use(folder, express.static("./files" + folder));
    app.use(folder, aux.renderErr("404", "not found"));
};

var streamer = aux.curry(function(pre, req, res) {
    res.stream(path.join(pre, decodeURI(req.url)));
});

//public folder
serveFolder("/public");

//download gate, private folders
app.use(aux.gate("Dn", false));
serveFolder("/");

https.createServer(main.httpsOpts, app).listen(cli.port);

//HTTP app (for video)
var appV = express();
appV.engine("handlebars", hbs.engine);
appV.set("view engine", "handlebars");
appV.use(express.compress());
appV.use(express.bodyParser());
appV.use(express.cookieParser());
appV.use(sessions);
appV.use(stream(path.resolve('files')));
appV.use("/static", express.static('static'));
appV.use("/public/", streamer("./public/"));
appV.use(aux.gate("Dn", true));
appV.use("/", streamer("/"));
appV.use(aux.renderErr("500", "not authorized"));
http.createServer(appV).listen(cli.port + 1);

console.log("Servers started on " + cli.port + " and " + (cli.port+1));

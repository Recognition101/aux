/* global require, module, process */
/* jshint asi: true */
/* jshint newcap: false */
module.exports = (function() {
var fs     = require("fs");
var fse    = require("fs-extra");
var path   = require("path");
var mm     = require("musicmetadata");
var Promise= require("bluebird");
Promise.longStackTraces();

//patch fs
/** @param {string} path **/
fs.statAsync = function(path) {return new Promise(function(rs,rj) {
    fs.stat(path, function(ex, c) {return ex ? rj(ex) : rs(c);});
});};

/** @param {string} path **/
fs.readdirAsync = function(path) {return new Promise(function(rs,rj) {
    fs.readdir(path, function(ex, c) {return ex ? rj(ex) : rs(c);});
});};

/** @param {string} fn **/
fs.existsAsync = function(fn) {return new Promise(function(rs,rj) {
    fs.exists(fn, function(ex) {rs({fn: fn, exists: ex});});
});};

/** @param {string} path
 *  @param {string=} cache **/
fs.realpathAsync = function(path, cache) {return new Promise(function(rs, rj) {
    fs.realpath(path, cache, function(ex, c) {return ex ? rj(ex) : rs(c);});
});};

/** @param {string} filename **/
fs.readFileAsync = function(filename) {return new Promise(function(rs, rj) {
    fs.readFile(filename, function(ex, c) {return ex ? rj(ex) : rs(c);});
});};

/** @param {string} fn the filename
 *  @param {Buffer} data what to write
 *  @param {string} enc? the encoding (optional) **/
fs.writeFileAsync = function(fn, data, enc){return new Promise(function(rs,rj){
    fs.writeFile(fn, data, enc, function(ex,c) {return ex? rj(ex) : rs(c);});
});};

/** @param {string} oldPath
 *  @param {string} newPath **/
fs.renameAsync = function(oldPath, newPath){return new Promise(function(rs,rj){
    fs.rename(oldPath, newPath, function(ex,c) {return ex? rj(ex) : rs(c);});
});};

/** @param {string} pth **/
fse.mkdirsAsync = function(pth) {return new Promise(function(rs,rj) {
    fse.mkdirs(pth, function(ex) {return ex ? rj(ex) : rs();});
});};

//common utilities
var U = {};
U.noErr = function(f) {return function(res) {f(null, res);};};
U.purify =function(f) {return f.call.bind(f);}
U.slice = U.purify(Array.prototype.slice);
U._ = {};
var __ = U._;
U.curry = function(f, aCnt) {
    aCnt = aCnt ? aCnt : f.length;
    return function rec() {
        var a = U.slice(arguments, 0, aCnt), i=0, sub=aCnt;
        while(i < aCnt && sub < arguments.length) {
            if (a[i] === U._) {a[i] = arguments[sub]; sub+=1;}
            i += 1;
        }
        return a.length < aCnt || a.indexOf(U._) !== -1 ?
            rec.bind.apply(rec, [this].concat(a)) :
            f.apply(this, a);
    };
};

U.curry._ = U._;
U.curryAll = function(o) {
    for (var k in o) {if (typeof o[k] === "function") {o[k] = U.curry(o[k]);}}
};
U.set = U.curry(function(kp, val, obj) {
    obj = obj ? obj : {};
    kp.split(".").reduce(function(s,e,i,arr) {
        return (i+1 >= arr.length) ? s[e] = val : !s[e] ? s[e]={} : s[e];
    }, obj);
    return obj;
});
U.get = U.curry(function(kp, o) {
    return kp.split(".").reduce(function(o,k){return o? o[k] : undefined;}, o);
});
U.starts = U.curry(function(pre, str) {return 0 === str.indexOf(pre);});
U.objFilter = U.curry(function(a,o){
    return a.reduce(function(c,i){return (c[i]=o[i],c)}, {}); });

//purified utilities and constants
U.cwd = path.join(process.cwd(), "files");

var aux = {};

aux.getThumb = function(fn, st) {
    return st.isDirectory()                    ? null :
           fn.match(/.*\.(jpg|jpeg|png|gif)$/) ? path.join("/",fn) :
           fn.match(/.*\.(mp4|m4v|mp3)$/)      ? "/thumbs/" + fn :
           fn.match(/.*\.(zip|rar|7z|tar|gz)$/)? "/static/zip.svg" :
           "/static/doc.svg";
};
aux.stat  = function(st, f) {
    return fs.statAsync(f).then(function(s) {
        st.hasDirs = st.hasDirs || s.isDirectory();
        st.hasFiles= st.hasFiles|| s.isFile();
        return U.set("isDir",s.isDirectory(),
               U.set("thumb",aux.getThumb(f.substr(U.cwd.length+1),s),
               U.set("fn",   f.substr(U.cwd.length+1),
               U.set("fnB",  path.basename(f).replace(/\.[^\.]*$/,""), s))));
    });
};
aux.getDir = function(pre, req, res, defs) {
    var lPth = path.join("./files", pre, decodeURI(req.url));
    var lCwd = path.join(U.cwd, pre).replace(/\/+$/, "");
    var globalStats = {hasDirs: false, hasFiles: false};
    var dir = null;

    return fs.realpathAsync(lPth).then(function(p) {
        if (!U.starts(lCwd,p)) {throw new aux.RenderError("Access Denied");}
        dir = p;
        return dir;
    })
    .then(fs.readdirAsync)
    .then(function(files) {
        files = files.map(function(f) {return path.join(dir, f || "")});
        return Promise.all(files.map(aux.stat(globalStats)));
    })
    .then(function(stats) {
        var props = ["size", "fn", "fnB", "thumb", "isDir"];
        var url = "";
        var curDirs = dir.substr(U.cwd.length+1).split(path.sep);
        var prevUrl = dir.substr(U.cwd.length+1).replace(/\/[^\/]*\/?$/,"/");
        return {
            privUp: req.session["privUp"],
            root: dir,
            uploadError: defs["uploadError"],
            title: {
                mainTitle: "Files",
                path: curDirs.map(function(v){return {nm:v, url:url+=v+"/"}}),
                prev: curDirs.length===1 && !curDirs[0].match(/^(public)?$/i) ?
                    {nm: "All Files", url: ""} :
                    {nm: curDirs[curDirs.length-2], url: prevUrl}
            },
            hasDirs:  globalStats.hasDirs,
            hasFiles: globalStats.hasFiles,
            files: stats.map(U.objFilter(props)).filter(function(f) {
                return !/\.ds_store$/i.test(f["fn"]);
            })
        };
    });
};
aux.upload = function(pre, req, res) {
    var ret = {};
    var pth = decodeURI(req.url);
    return(!req.files||!req.files["newFile"]||!req.files["newFile"].name)?ret:
        !req.session["privUp"] ? U.set("uploadError", "wrong password", ret) :
        !req.files["newFile"]  ? U.set("uploadError", "no file chosen", ret) :
        fs.renameAsync(req.files["newFile"].path,
                       path.join(U.cwd, pre, pth, req.files["newFile"].name))
            .then(function()  {return ret;})
            .catch(function(e){return U.set("uploadError", e, ret);});
};

aux.serveThumbs = function(fnPre, req, res, next) {
    var hasPic = false;
    var url = decodeURI(req.url).replace(/(\.jpe?g|png)$/, "");
    var mediaUrl = path.join(U.cwd, fnPre, url);
    var thumbUrl = path.join(process.cwd(), "thumbs-cache", fnPre, url)
                       .replace(/\.[^\.]*$/,"");
    var thumbDir = thumbUrl.replace(/\/[^\/]*$/,"");
    var thumbs   = [thumbUrl+".jpg", thumbUrl+".png", thumbUrl+".jpeg",
                    thumbUrl.replace(/\/[^\/]*$/,"/all.png")];

    var Send = function() {}
    Send.prototype = Object.create(Error.prototype);

    var pic = null, type = null, data = null;
    Promise.reduce(thumbs, function(all, fn) {
        return all && all.exists ? all : fs.existsAsync(fn);
    }, null).then(function(file) {
        if (file.exists) {res.sendfile(file.fn); throw new Error();}

    }).then(function(){return fse.mkdirsAsync(thumbDir);
    }).then(function(){return fs.statAsync(mediaUrl);
    }).then(function(st) {
        if (!st.isFile()) {throw new Send();}
        var pic = new mm(fs.createReadStream(mediaUrl));
        return new Promise(function(ac,rj) {
            pic.on("done", function(err) {return err ? rj(err) : ac(pic);});
        });

    }).then(function(pic) {
        type = U.get("metadata.picture.0.format",pic);
        data = U.get("metadata.picture.0.data",  pic);
        if (!data || !type || !type.match(/png|jpg|jpeg/)) {throw new Send();}
        fs.open(thumbUrl + "." + type, "w", function(e, f) {
            if (e) {return;}
            fs.write(f, data, 0, data.length, null);
        });
        res.setHeader('Content-Type', "image/" + type);
        res.send(data);

    }).catch(Send, function() {
        res.sendfile(mediaUrl.match(/.*mp3$/)      ? "./static/music.svg" :
                     mediaUrl.match(/.*(mp4|m4v)$/)? "./static/video.svg" :
                                                    "./static/doc.svg");
    }).catch(Error, function(e) {});
};

var auxAuthLast = {};
aux.auth = function(pwd, nm, throttleTime, req, res, next) {
    if (!req.session || !req.body) {return next();}

    var throttled = (auxAuthLast[nm]||0) + throttleTime > Date.now();
    auxAuthLast[nm] = req.body["pass"+nm] ? Date.now() : auxAuthLast[nm];
    if (throttled) {return next();}

    req.session["priv"+nm] = !req.body["logout"+nm] &&
        (req.body["pass"+nm] === pwd || req.session["priv"+nm] || pwd === "");
    next();
};

aux.render   =function(t,d,r,res){res.render(t, d);};
aux.renderErr=function(n,m,r,res){res.render("error",{title:""+n,msg:""+m});};
aux.json     =function(n,d,r,res){res.json(n, d);};
aux.jsonErr  =function(n,m,r,res){res.json(n, {"error": ""+m});};

aux.lsApi=function(pre, req, res) {
    return aux.getDir(pre, req, res, {})
        .then(aux.json(200,__,req,res))
        .catch(aux.jsonErr("500", __, req, res));
};
aux.lsHtml= function(pre, catchAll, req, res, next) {
    return Promise.resolve(aux.upload(pre, req,res))
        .then(aux.getDir(pre, req, res))
        .then(aux.render("directory", __, req, res))
        .catch(aux.RenderError, aux.renderErr("500", __, req, res))
        .catch(function(e) {
            return catchAll ? next() : aux.renderErr("500", e, req, res);
        });
};
aux.gate = function(type, err, req, res, cbk) {
    return req.session["priv"+type] ? cbk() :
        err ? aux.renderErr("500", "access denied", req, res) :
        res.render("login", {
            "curUrl": req.url,
            "errPass": !req.session["privDn"] && !!req.body["passDn"]
        });
};
aux.redirect = function(f, r, req, res, next) {
    var fullUrl = req.protocol + "://" + req.get("host") + req.url;
    return (fullUrl.match(f)) ? res.redirect(301, fullUrl.replace(f, r)) :
                                next();
};

U.curryAll(aux);

//Non-curried functions / objects
aux.curry = U.curry;

//Special Errors
aux.RenderError = function(m) {this.name="RenderError"; this.message=m||"";};
aux.RenderError.prototype = Object.create(Error.prototype);
aux.RenderError.prototype.toString = function() {return this.message;};


return aux;})();

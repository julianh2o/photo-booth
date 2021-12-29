const { createServer } = require('http');
const { exec } = require('child_process');
const express = require("express");
const app = express();
const { parse } = require('url');
const next = require('next');
var NodeWebcam = require( "node-webcam" );
const fs = require('fs');
const util = require("util");
const net = require("net");
const path = require("path");
const imageThumbnail = require("image-thumbnail");
const _ = require("lodash");

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const dev = process.env.NODE_ENV !== 'production';
const nextapp = next({ dev });
const handle = nextapp.getRequestHandler();

const FFmpeg = require('./FFmpeg');
const { resolve } = require('path');
const APP_PORT = 3000;

const photoDirectory = path.join(__dirname,"pictures");

let preview = null;
function startPreview() {
    if (preview) return;
    return new Promise((resolve,reject) => {
        console.log("Starting Preview");
        try {
            preview = exec(`sh -c 'gphoto2 --set-config /main/actions/viewfinder=1 --stdout --capture-movie | ffmpeg -i - -vcodec rawvideo -pix_fmt yuv420p -threads 0 -f v4l2 /dev/video0'`,function(error,stdout,stderr) {
                // if (error) {
                //     console.log(error.stack);
                //     console.log('Error code: '+error.code);
                //     console.log('Signal received: '+error.signal);
                // }
                // console.log('Child Process STDOUT: '+stdout);
                // console.log('Child Process STDERR: '+stderr);
            });

            const t = setTimeout(() => {
                reject("timeout reached!");
            },15000);
            preview.stdout.on("data",(data) => console.log("stdout: "+data));
            preview.stderr.on("data",(data) => {
                if (data.startsWith("frame=")) {
                    clearTimeout(t);
                    resolve();
                }
            });

            preview.on("exit",function(code) {
                console.log("Preview exited with "+code);
                preview = null;
            });
        } catch (err) {
            console.log("error while starting preview",err);
        }

    })
}

async function stopPreview() {
    if (!preview) return;

    console.log("Sending kill to preview");
    exec("killall ffmpeg gphoto2");;

    return new Promise((resolve,reject) => {
        preview.on("exit",async () => {
            await sleep(200);
            resolve();
        });
    });
}

async function singleShot() {
    return new Promise((resolve,reject) => {
        const stamp = new Date().getTime();
        const imagePath = path.join(photoDirectory,`${stamp}.jpg`);
        const cmd = `gphoto2 --trigger-capture --wait-event-and-download=FILEADDED --keep --filename '${imagePath}'`;
        const proc = exec(cmd,(error,stdout,stderr) => {
            if (error) return reject(error);
            if (stderr.includes("Out of Focus")) return reject(new Error("Out of focus!"));
            console.log(`Single shot took: ${(new Date().getTime() - stamp)}ms`);
            resolve(imagePath);
        });
    })
}

async function singleShot(noSave) {
    return new Promise((resolve,reject) => {
        const stamp = new Date().getTime();
        const imagePath = path.join(photoDirectory,`${stamp}.jpg`);
        const cmdSave = `gphoto2 --trigger-capture --wait-event-and-download=FILEADDED --keep --filename '${imagePath}'`;
        const cmdNoSave = `gphoto2 --trigger-capture`;
        const cmd = noSave ? cmdNoSave : cmdSave;
        const proc = exec(cmd,(error,stdout,stderr) => {
            if (error) return reject(error);
            if (stderr.includes("Out of Focus")) return reject(new Error("Out of focus!"));
            console.log(`Single shot took: ${(new Date().getTime() - stamp)}ms`);
            resolve(imagePath);
        });
    })
}

async function burst(count, delay) {
    console.log("Burst: ",{count,delay});
    const start = new Date().getTime();
    const filenames = [];
    for (let i=0; i<count; i++) {
        try {
            const [filename] = await Promise.all([singleShot(),sleep(delay)]);
            filenames.push(filename);
            console.log(new Date().getTime() - start);
        } catch (err) {
            console.log("Failed to take picture!");
        }
    }

    return filenames;
}

app.get("/start",async (req,res) => {
    try {
        await startPreview();
        res.sendStatus(200);
    } catch (err) {
        console.log("Caught err",err);
        res.sendStatus(500);
    }
});

app.get("/stop",async (req,res) => {
    console.log(!!preview);
    await stopPreview();
    res.sendStatus(200);
});

app.get("/togglePreview",async function(req,res) {
    try {
        if (preview) {
            await stopPreview();
        } else {
            await startPreview();
        }
        res.sendStatus(200);
    } catch (err) {
        console.log("caught err",err);
        res.sendStatus(500);
    }
});


app.get('/preview', function (req, res) {
    if (!preview) return res.send("no preview active");
    NodeWebcam.capture("test_picture", {width:400,height:300, callbackReturn:"buffer"}, function( err, data ) {
        if (err) {
            res.sendStatus(500);
        } else {
            res.writeHead(200,{"Content-Type":"image/jpeg"});
            res.end(data);
        }
    });
});

let capturing = false;
app.get('/image', async function (req, res) {
    const {count, delay} = req.query;
    if (capturing) res.send("busy");
    capturing = true;
    try {
        const previewOn = !!preview;
        if (previewOn) await stopPreview();
        const paths = await burst(count,delay);
        // if (previewOn) startPreview();

        res.json(_.map(paths,(f) => path.join("/photos",path.relative(photoDirectory,f))));
    } finally {
        capturing = false;
    }
});

app.get('/focus', async function (req, res) {
    if (capturing) res.send("busy");
    capturing = true;
    try {
        const previewOn = !!preview;
        if (previewOn) await stopPreview();
        await singleShot(true);
        if (previewOn) startPreview();

        res.sendStatus(200);
    } finally {
        capturing = false;
    }
});

app.get("/photos",(req,res) => {
    const files = fs.readdirSync(photoDirectory);
    res.json(_.map(_.filter(files,f => !f.includes("thumb")),name => `/photos/`+name));
});

function thumbnailPath(f) {
    if (f.includes("thumb")) return f;
    const {dir,name,ext} = path.parse(f);
    return `${dir}/${name}.thumb${ext}`;
}

app.get("/photos/:name",async (req,res) => {
    //TODO cache
    const f = path.join(photoDirectory,req.params.name);
    if (!fs.existsSync(f)) return res.sendStatus(404);
    const thumb = thumbnailPath(f);
    if (!fs.existsSync(thumb)) {
        const start = new Date().getTime();
        const thumbnail = await imageThumbnail(f,{width:400,height:300});
        fs.writeFileSync(thumb,thumbnail);
        console.log(`Created thumbnail in ${new Date().getTime()-start}ms (${req.params.name})`)
    }
    res.sendFile(thumb);
    // res.end(thumbnail);
});

app.get("*",(req,res) => {
    const parsedUrl = parse(req.url, true);
    nextapp.getRequestHandler()(req,res,parsedUrl);
});

// startPreview();
app.listen(APP_PORT, () => console.log(`App is listening on port ${APP_PORT}!`));
nextapp.prepare().then(() => console.log("Next ready"));
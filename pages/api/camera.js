var fs = require('fs');
var gphoto2 = require('gphoto2');
var GPhoto = new gphoto2.GPhoto2();
var util = require("util");
var net = require("net");


// export default async function handler(req, res) {
//     GPhoto.list(function (list) {
//         if (list.length === 0) return;
//         var camera = list[0];
//         var previewServer = net.createServer(function ( c ) {
//             res.writeHead(200, {
//                 'Content-Type': 'image/jpeg',
//             });
            
//             c.on('end', function () {
//                 previewServer.close();
//                 res.end();
//             });
//             c.pipe(res); // pipes preview stream to HTTP client
//         }); 
//         previewServer.listen(socketPath, function () {
//             camera.takePicture({preview:true, socket: socketPath}, function(er){
//                 // some logging, error handling
//             });
//         });
//     });
// }


let cameraInstance = null;
function getCamera() {
    if (cameraInstance) return cameraInstance;
    return new Promise((resolve,reject) => {
        console.log("getting new camera instance");
        GPhoto.list(function (list) {
            if (list.length === 0) return reject();
            cameraInstance = list[0];
            resolve(cameraInstance);
        });
    });
}

function callCamera(camera,fn,opt) {
    return new Promise((resolve,reject) => {
        camera[fn](opt,(er,data) => {
            if (er) return reject(er);
            return resolve(data);
        })
    });
}

let handlerRunning = false;
export default async function handler(req, res) {
    if (handlerRunning) res.send("busy");
    handlerRunning = true;
    try {
        const filenames = await burst();
        console.log(filenames);

        res.send("ok");
    } finally {
        handlerRunning = false;
    }

    // const readstream = fs.createReadStream(filename);
    // readstream.pipe(res);
}

export async function singleShot() {
    console.log("single shot called");
    const camera = await getCamera();

    const filename = await callCamera(camera,"takePicture",{keep:true});
    // const filename = `./pictures/${new Date().getTime()}.jpg`;
    // fs.writeFileSync(filename, data);
    return filename;
}

export async function burst(req, res) {
    const start = new Date().getTime();
    const filenames = [];
    for (let i=0; i<3; i++) {
        const [filename] = await Promise.all([singleShot(),sleep(5000)]);
        filenames.push(filename);
        console.log(new Date().getTime() - start);
    }

    return filenames;
}

    // Set configuration values
    // camera.setConfigValue('capturetarget', 1, function (er) {
    //     //...
    // });

    // Take picture with camera object obtained from list()
    // camera.takePicture({ download: true }, function (er, data) {
    //     fs.writeFileSync(__dirname + '/picture.jpg', data);
    // });

    // Take picture and keep image on camera
    // camera.takePicture({
    //     download: true,
    //     keep: true
    // }, function (er, data) {
    //     const filename = `./pictures/${new Date().getTime()}.jpg`;
    //     fs.writeFileSync(filename, data);
    //     const readstream = fs.createReadStream(filename);
    //     readstream.pipe(res);
    //     // res.send(data);
    //     // res.status(200).json({"status":"ok"});
    // });

    // get configuration tree
    // camera.getConfig(function (er, settings) {
    //     console.log(settings);
    // });

    // Take picture without downloading immediately
    // camera.takePicture({ download: false }, function (er, path) {
    //     console.log(path);
    // });

    // Take picture and download it to filesystem
    // camera.takePicture({
    //     targetPath: '/tmp/foo.XXXXXX'
    // }, function (er, tmpname) {
    //     fs.renameSync(tmpname, __dirname + '/picture.jpg');
    // });

    // Download a picture from camera
    // camera.downloadPicture({
    //     cameraPath: '/store_00020001/DCIM/100CANON/IMG_1231.JPG',
    //     targetPath: '/tmp/foo.XXXXXX'
    // }, function (er, tmpname) {
    //     fs.renameSync(tmpname, __dirname + '/picture.jpg');
    // });

    // Get preview picture (from AF Sensor, fails silently if unsupported)
    // camera.takePicture({
    //     preview: true,
    //     download: true,
    // }, function (er, data) {
    //     fs.writeFileSync('./picture.jpg', data);
    // });
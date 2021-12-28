const spawn = require('child_process').spawn;
const ffmpegPath = 'ffmpeg';
const ffmpegOptions = [
  '-loglevel', 'panic',
  '-y',
  '-f',
  'alsa',
  '-ac',
  '2',
  '-i',
  'pulse',
  '-f',
  'x11grab',
  '-r',
  '25',
  '-i',
  ':0.0+0,0',
  '-acodec',
  'libvorbis',
  '-preset',
  'ultrafast',
  '-vf',
  'scale=320:-1',
  "-vcodec", "libvpx-vp9",
  '-f', 'webm',
  'pipe:1',
];

module.exports = {
  start,
  getInstance,
  killInstance,
};

let instance = null;
let connections = 0;

function killInstance() {
  connections -= 1;
  if (connections < 1) {
    instance.kill();
    instance = null;
  }
};

function getInstance() {
  connections += 1;
  if (!instance) instance = start();
  return instance;
};

function start() {
  return spawn(ffmpegPath,ffmpegOptions, {shell:true});
  // return spawn("gphoto2 --stdout --capture-movie | ffmpeg -i - -vcodec -r 25 -ac 2 -y libvpx-vp9 --preset ultrafast -vf -threads 0 -f webm pipe:1", [], {shell:true});
};
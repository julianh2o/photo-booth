import Head from "next/head";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Stack from "react-bootstrap/Stack";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import React from "react";
import 'bootstrap/dist/css/bootstrap.min.css';
import _ from "lodash";
import useState from 'react-usestateref';

const TEST_MODE = true;

// const config = {
//   countdown: 3,
//   shots: 3,
//   delay: 3000,
//   previewRefresh: 500,
// };

const config = {
  countdown: 2,
  shots: 3,
  delay: 3000,
  previewRefresh: 500,
};

const width = 1280;
const height = 960;
const aspect = width / height;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function useInterval(callback, delay) {
  const savedCallback = React.useRef();

  // Remember the latest callback.
  React.useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  React.useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    if (delay !== null) {
      let id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

class KeyboardMonitor extends React.Component {
  componentDidMount(){
    document.addEventListener("keydown", this.props.keydown, false);
  }
  componentWillUnmount(){
    document.removeEventListener("keydown", this.props.keydown, false);
  }

  render() { return null; }
}

function Overlay(props) {
  const style = {
    position:"absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    fontSize: "10em",
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: "white",
  };
  return ( <div style={style}>
    {props.children}
  </div> )
}

function PhotoStrip(props) {
  const photos = props.photos;
  const isLarge = props.variant === "lg";

  return (<Card {...props}>
    <div className="d-flex flex-column justify-content-around flex-grow-1 mx-1">
    { _.map(photos,(photo,i) =>
      <img style={{height:isLarge ? "32.5vh" : null, borderRadius:5}} key={i} src={photo || `https://place-hold.it/400x300`} />
    )}
    </div>
  </Card> );
}

function PhotoCollage(props) {
  const photos = props.photos;
  const ref = React.useRef();

  useInterval(() => {
    const photoWidth = 300;
    const photoHeight = 225;
    if (props.photos.length === 0) return;
    const photo = _.sample(props.photos);
    const $img = $(`<div class="collage"><img src="${photo}" /></div>`);
    const maxX = $(ref.current).width()-photoWidth;
    const maxY = $(ref.current).height()-photoHeight;
    const photosToShow = 20;
    const maxCant = 30;
    $img.css({
      left: Math.random() * maxX,
      top: Math.random() * maxY,
      transform: `rotate(${-maxCant+2*maxCant*Math.random()}deg)`,
    });
    $img.find("img").css({
      width: photoWidth,
      height: photoHeight,
    })
    $(ref.current).append($img);
    while ($(ref.current).length > photosToShow) $(ref.current).children()[0].delete();
  }, 2000);

  if (props.hide) return null;
  return (<div ref={ref} className={props.className} style={{background: "blue", overflow: "hidden", position:"relative"}}></div>);
}

function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * 
 charactersLength));
   }
   return result;
}

function Preview(props) {
  let [src,setSrc] = React.useState(props.src);
  useInterval(() => {
    setSrc(props.src+"?r="+makeid(10));
  }, props.refresh);

  if (TEST_MODE) src = "https://place-hold.it/400x300";
  return ( <img style={{borderRadius:15,border:"6px solid white",width:"100%"}} src={src} /> );
}

export default function Home() {
  const [countdown,setCountdown] = React.useState(null);
  const [photos, setPhotos, photoRef] = useState([]);
  const [strip, setStrip] = useState([]);
  const [audio] = React.useState( typeof Audio !== "undefined" && new Audio("camera-shutter-sound.mp3"));

  const shutter = async (startTime) => new Promise((resolve,reject) => {
    audio.currentTime = startTime;
    audio.play();
    audio.timeupdate = (o) => console.log(o);
    audio.onpause = () => resolve();
  });

  const captureBurst = async (count, delay) => {
    const burst = await fetch("/image").then(res => res.json());
    return burst;
  }

  const fakeCaptureBurst = async (shots,delay) => {
    await sleep(1000);
    for (let i=0; i<shots; i++) {
      console.log("snap..");
      await sleep(delay);
    }
    return ["https://place-hold.it/400x300","https://place-hold.it/400x300","https://place-hold.it/400x300"];
  }

  const countdownTo = (t) => {
    return new Promise((resolve,reject) => {
      const timer = setInterval(() => {
        const remain = t - new Date().getTime();
        if (remain <= 0) {
          clearInterval(timer);
          setCountdown(-1);
          resolve();
          return;
        }
        setCountdown(Math.floor(remain / 1000));
      },50);
    });
  }

  const before = (t,before) => {
    return new Promise((resolve,reject) => {
      const timer = setInterval(() => {
        const remain = t - new Date().getTime() - before;
        if (remain <= 0) resolve();
      },50);
    });
  }

  const trigger = async (count) => {
    const startTime = new Date().getTime();
    const initialDelay = 500 + config.countdown*1000;
    const timeline = _.range(config.shots).map(n => startTime + initialDelay + config.delay * n);

    //Play the shutter sound a bit earlier so it lines up
    const capturePromise = before(timeline[0],1000).then(() => fakeCaptureBurst(config.shots,config.delay));

    for (const t of timeline) {
      before(t,1030).then(() => shutter(0));
      await countdownTo(t);
      await sleep(200);
    }

    const burst = await capturePromise;
    console.log("got burst",burst,photoRef.current);
    setPhotos([...photoRef.current,...burst]);
    setStrip(burst);
    setCountdown(null);
  }

  React.useEffect(() => {
    fetch("/photos")
      .then(res => res.json())
      .then(
        (result) => {
          setPhotos(result);
        },
        (error) => {
          console.log("got error",error)
        }
      )
  }, []);

  const handleKey = async (e) => {
    const code = e.keyCode;
    console.log(code);
    if (code === 49) trigger(config.countdown);
    if (code === 50) await fetch("/focus");
    if (code === 51) await fetch("/togglePreview");
    if (code === 52) window.location.reload();
  }

  return (
    <>
      <Head>
        <title>Treehouse Photobooth</title>
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true"/>
        <link href={"https://fonts.googleapis.com/css2?family=Pacifico&display=swap"} rel="stylesheet"/>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js" />
      </Head>

      <KeyboardMonitor keydown={e => handleKey(e) } />

      <Container fluid style={{position:"absolute",height:"100%", background:"url('background.webp')", backgroundSize:"cover", padding:0}}>
        <div className="d-flex align-items-stretch h-100">
          <div className="flex-grow-1 d-flex flex-column">
            <Row className="justify-content-center">
              <Card style={{width:"auto"}} className="m-3">
                <Card.Title style={{fontSize:"4em",fontFamily:"'Pacifico', cursive"}} className="m-1 text-center">Treehouse Photobooth</Card.Title>
              </Card>
            </Row>
            {countdown != null && <div className="flex-column flex-grow-1 d-flex align-items-center justify-content-center">
              <div className="flex-shrink-1" style={{position:"relative", width: "80%"}}>
                { countdown >= 0 && <Overlay>{countdown}</Overlay> }
                <Preview src={"/preview"} refresh={config.previewRefresh} />
              </div>
            </div> }
            <PhotoCollage hide={countdown !== null} className="flex-grow-1" photos={photos} />
          </div>
          {countdown === null && <div className="flex-shrink-1 d-flex m-1">
            <PhotoStrip variant="lg" photos={strip} className="d-flex" />
          </div> }
        </div>
      </Container>

      <style global jsx>{`
          .collage {
            position: absolute;
          }
          .collage img {
            transform-origin: center;
            animation-duration: 2s;
            animation-name: shrinkappear;
            position: absolute;
            top: 5px;
            left: 5px;
            bottom: 5px;
            right: 5px;
            border: 4px solid white;
            borderRadius: 5px;
          }
          @keyframes shrinkappear {
            from {
              transform: scale(1.3);
              opacity: .2;
            }
          
            to {
              transform: scale(1.0);
              opacity: 1;
            }
          }
        `}</style>
    </>
  )
}

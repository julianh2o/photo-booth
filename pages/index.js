import Head from "next/head";
import Webcam from "react-webcam";
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

// const config = {
//   countdown: 3,
//   shots: 3,
//   delay: 3000,
// };

const config = {
  countdown: 1,
  shots: 3,
  delay: 200,
};

const width = 1280;
const height = 960;
const aspect = width / height;


const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
  const strips = props.strips;
  const isLarge = props.variant === "lg";

  return _.map(strips || [[null,null,null]], (photos, index) => <>
    <Card {...props}>
      <div className="d-flex flex-column justify-content-around flex-grow-1 mx-1" key={index}>
      { _.map(photos,(photo,i) =>
        <img style={{height:isLarge ? "32.5vh" : null, borderRadius:5}} key={i} src={photo || `https://place-hold.it/400x300`} />
        // <div className="flex-grow-1 m-1" style={{background:"url('https://place-hold.it/400x300')",aspectRatio:"4/3"}}>
        // </div>
      )}
      </div>
    </Card>
  </>);
}

function PhotoCollage(props) {
  const ref = React.useRef();

  React.useEffect(() => {
    const interval = setInterval(() => {
      const photoWidth = 300;
      const photoHeight = 225;
      const $img = $(`<div class="collage"><img src="https://place-hold.it/${photoWidth}x${photoHeight}" /></div>`);
      const maxX = $(ref.current).width()-photoWidth;
      const maxY = $(ref.current).height()-photoHeight;
      const photosToShow = 50;
      const maxCant = 30;
      $img.css({
        left: Math.random() * maxX,
        top: Math.random() * maxY,
        transform: `rotate(${-maxCant+2*maxCant*Math.random()}deg)`,
      })
      $(ref.current).append($img);
      while ($(ref.current).length > photosToShow) $(ref.current).children()[0].delete();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (<div ref={ref} className={props.className} style={{overflow: "hidden",position:"relative"}}></div>);
}

export default function Home() {

  const [countdown,setCountdown] = React.useState(null);
  const webcamRef = React.useRef(null);
  const [audio] = React.useState( typeof Audio !== "undefined" && new Audio("camera-shutter-sound.mp3"));

  const [preview, setPreview, previewRef] = useState([]);

  const videoConstraints = { width, height };

  const shutter = async (startTime) => new Promise((resolve,reject) => {
    audio.currentTime = startTime;
    audio.play();
    audio.timeupdate = (o) => console.log(o);
    audio.onpause = () => resolve();
  });

  const capture = async (full) => {
    const startTime = full ? 0 : 450;
    const triggerTime = 650;
    const [,data] = await Promise.all([
      shutter(startTime / 1000),
      (async () => {
        await sleep(triggerTime - startTime);
        return webcamRef.current.getScreenshot();
      })()
    ]);
    return data;
  }

  const captureBurst = async (count, delay) => {
    const startTime = new Date().getTime();
    const photos = [];
    for (const i=0; i<count; i++) {
      const [,data] = await Promise.all([
        sleep(delay),
        capture(i===0),
      ]);
      photos.push(data);
    }
    return photos;
  }

  const trigger = (count) => {
    setCountdown(count);
    let timer = setInterval(() => {
      count --;
      if (count === 0) {
        setCountdown(null);
        clearInterval(timer);
        captureBurst(config.shots,config.delay).then((photos) => {
          setPreview([...previewRef.current,photos]);
        });
      } else {
        setCountdown(count);
      }
    },1000);
  };

  return (
    <>
      <Head>
        <title>Create Next App</title>
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
        <link href="https://fonts.googleapis.com/css2?family=Pacifico&amp;display=swap" rel="stylesheet"/>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js" />
      </Head>

      <KeyboardMonitor keydown={e => trigger(config.countdown)} />

      <Container fluid style={{position:"absolute",height:"100%", background:"url('background.webp')", backgroundSize:"cover", padding:0}}>
        <div className="d-flex align-items-stretch h-100">
          <div className="flex-grow-1 d-flex flex-column">
            <Row className="justify-content-center">
              <Card style={{width:"auto"}} className="m-3">
                <Card.Title style={{fontSize:"4em",fontFamily:"'Pacifico', cursive"}} className="m-1 text-center">Treehouse Photobooth</Card.Title>
              </Card>
            </Row>
            <div style={{position:"relative"}}>
              <Overlay>{countdown}</Overlay>
              <Webcam ref={webcamRef} style={{borderRadius:15,border:"6px solid white",width:"300px"}} videoConstraints={videoConstraints}/>
            </div>
            <PhotoCollage className="flex-grow-1" photos={_.flatten(preview)} />
          </div>
          <div className="flex-shrink-1 d-flex m-1">
            <PhotoStrip variant="lg" strips={preview.length ? [preview[0]] : null} className="d-flex" />
          </div>
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

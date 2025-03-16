# Video/Audio Record and Stream Demo Using mediasoup 3, GStreamer, FFmpeg and Serial

---

## Introduction

Video/audio application using Mediasoup that supports:
- Recording to file using GStreamer or FFmpeg
- Streaming video through serial port for RPi Zero USB Gadget mode

Recorded files are stored in the server's files directory or the directory set by the user (via process.env.RECORD_FILE_LOCATION_PATH)

File names are simply the current timestamp

This sample currently only uses VP8/opus and the output file is .webm when recording


---

## How to use

### Install GStreamer

```bash
# For Ubuntu
sudo apt-get install libgstreamer1.0-0 gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-libav gstreamer1.0-doc gstreamer1.0-tools gstreamer1.0-x gstreamer1.0-alsa gstreamer1.0-gl gstreamer1.0-gtk3 gstreamer1.0-qt5 gstreamer1.0-pulseaudio
```

### Install Server Modules

```bash
cd server && npm i
```

### Install App Modules

```bash
cd app && npm i
```

### Configure the server

Change the announced IP in src/config.js to your local ip (config -> webRtcTransport -> listenIps)

### Start the server

```bash
# The server uses FFmpeg as default for recording
cd server && node src/server

# To use GStreamer for recording
PROCESS_NAME="GStreamer" node src/server

# To use SerialStreamer for streaming to RPi Zero USB Gadget
PROCESS_NAME="SerialStreamer" node src/server

# To use a custom serial device (default is /dev/ttyACM0)
PROCESS_NAME="SerialStreamer" SERIAL_DEVICE="/dev/ttyUSB0" node src/server

# To adjust serial baud rate (default is 921600)
PROCESS_NAME="SerialStreamer" SERIAL_BAUD_RATE=1500000 node src/server
```

### Build and start the application

```bash
cd app
npm run build

# Copy the files from dist to a webserver etc.
# OR start the dev server
npm run dev
```

### Access the sample page
https://localhost:8080


By default recorded videos will be available in `server/files` directory.

---

## Server ENV Options

| Argument | Type | Explanation |
| -------- | :--: | :---------: |
| RECORD_FILE_LOCATION_PATH | string | Path to store the recorded files (user running node MUST have read/write permission) |
| GSTREAMER_DEBUG_LEVEL | number | GStreamer Debug Level (GStreamer only) |
| PROCESS_NAME | string | The processing method to use (GStreamer/FFmpeg/SerialStreamer) (case sensitive) default is FFmpeg |
| SERVER_PORT | number | Server port number (default is 3000). Note if you change this you will also need to edit the WebSocket connection url. |
| SERIAL_DEVICE | string | Serial device to use for SerialStreamer (default is /dev/ttyACM0) |
| SERIAL_BAUD_RATE | number | Baud rate for serial communication (default is 921600) |
| BUFFER_SIZE | number | Buffer size in bytes for serial communication (default is 4096) |

---

## TODO

- video/audio only recording
- Multiple formats (mp4/avi etc)
- Docker support
- Serial streaming optimizations for different resolutions
- Support for custom video encoding for serial streaming

---

Like my work? Any support is appreciated.

<a href="https://www.buymeacoffee.com/ethand9999" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: 41px !important;width: 174px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>

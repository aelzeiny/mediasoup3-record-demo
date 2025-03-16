// Class to handle streaming video through serial for RPi Zero USB Gadget

const child_process = require('child_process');
const { EventEmitter } = require('events');
const { createSdpText } = require('./sdp');
const { convertStringToStream } = require('./utils');
const { getCodecInfoFromRtpParameters } = require('./utils');
const fs = require('fs');

// Default serial device - can be overridden via environment variable
const SERIAL_DEVICE = process.env.SERIAL_DEVICE || '/dev/ttyACM0';
// Baud rate for serial communication
const SERIAL_BAUD_RATE = process.env.SERIAL_BAUD_RATE || 921600;
// Buffer size in bytes (adjust based on performance needs)
const BUFFER_SIZE = process.env.BUFFER_SIZE || 4096;

module.exports = class SerialStreamer {
  constructor(rtpParameters) {
    this._rtpParameters = rtpParameters;
    this._process = undefined;
    this._observer = new EventEmitter();
    this._serialPort = null;
    this._createProcess();
  }

  _createProcess() {
    // Create a pipeline that receives RTP packets, decodes them, and sends the raw frames to serial
    // Using ffmpeg as the processing engine
    console.log('Creating serial streaming process for USB gadget webcam');
    
    const sdpString = createSdpText(this._rtpParameters);
    const sdpStream = convertStringToStream(sdpString);
    
    console.log('createProcess() [sdpString:%s]', sdpString);
    
    // This pipeline:
    // 1. Receives RTP packets from mediasoup
    // 2. Decodes the video (and discards audio)
    // 3. Scales the video to a smaller resolution if needed
    // 4. Converts to raw format
    // 5. Pipes to a custom format that can be sent over serial
    // 6. Outputs to the serial device
    
    const args = [
      '-loglevel', 'debug',
      '-protocol_whitelist', 'pipe,udp,rtp',
      '-fflags', '+genpts',
      '-f', 'sdp',
      '-i', 'pipe:0',
      '-map', '0:v:0',         // Use only the video stream
      '-vf', 'scale=320:240',  // Scale down to a manageable size
      '-pix_fmt', 'yuv420p',   // Use a common pixel format
      '-f', 'rawvideo',        // Output as raw video
      '-'                      // Output to stdout
    ];
    
    console.log('commandArgs:', args);
    
    // Start ffmpeg process with input from SDP
    this._process = child_process.spawn('ffmpeg', args);
    
    // Start another process to handle the output from ffmpeg and send it to serial
    this._serialProcess = child_process.spawn('node', ['-e', `
      const fs = require('fs');
      const serialDevice = '${SERIAL_DEVICE}';
      const baudRate = ${SERIAL_BAUD_RATE};
      const bufferSize = ${BUFFER_SIZE};
      
      // Open the serial port
      const serialPort = fs.createWriteStream(serialDevice, { 
        flags: 'w',
        defaultEncoding: 'binary'
      });
      
      // Handle serial port errors
      serialPort.on('error', (err) => {
        console.error('Serial port error:', err.message);
        // Continue running even if there are errors
      });
      
      // Simple header format to help receiver identify frames
      const HEADER = Buffer.from([0xAA, 0xBB, 0xCC, 0xDD]);
      
      // Listen for data from ffmpeg
      process.stdin.on('data', (data) => {
        // Add a simple header to help the receiver identify frame boundaries
        const frameBuffer = Buffer.concat([
          HEADER,
          // Include frame size as 4 bytes
          Buffer.from([
            (data.length >> 24) & 0xFF,
            (data.length >> 16) & 0xFF,
            (data.length >> 8) & 0xFF,
            data.length & 0xFF
          ]),
          data
        ]);
        
        try {
          // Write the frame to the serial port
          serialPort.write(frameBuffer, (err) => {
            if (err) {
              console.error('Error writing to serial port:', err);
            }
          });
        } catch (err) {
          console.error('Exception writing to serial port:', err.message);
        }
      });
      
      // Handle errors in stdin
      process.stdin.on('error', (err) => {
        console.error('stdin error:', err.message);
        // Don't crash, just log the error
      });
      
      process.stdin.on('end', () => {
        console.log('Input stream ended');
        serialPort.end();
      });
      
      process.on('SIGINT', () => {
        console.log('Shutting down serial connection');
        serialPort.end();
        process.exit(0);
      });
    `]);
    
    // Pipe ffmpeg output to the serial handler process with error handling
    this._process.stdout.pipe(this._serialProcess.stdin).on('error', (error) => {
      console.error('Pipe error:', error.message);
      // Don't crash the process, just log the error
      if (error.code === 'EPIPE') {
        console.log('EPIPE error - receiver may have closed the connection');
      }
    });
    
    if (this._process.stderr) {
      this._process.stderr.setEncoding('utf-8');
      this._process.stderr.on('data', data =>
        console.log('serialStreamer::ffmpeg::stderr [data:%o]', data)
      );
    }
    
    if (this._serialProcess.stderr) {
      this._serialProcess.stderr.setEncoding('utf-8');
      this._serialProcess.stderr.on('data', data =>
        console.log('serialStreamer::serialHandler::stderr [data:%o]', data)
      );
    }
    
    if (this._serialProcess.stdout) {
      this._serialProcess.stdout.setEncoding('utf-8');
      this._serialProcess.stdout.on('data', data =>
        console.log('serialStreamer::serialHandler::stdout [data:%o]', data)
      );
    }
    
    this._process.on('error', error =>
      console.error('serialStreamer::ffmpeg::error [error:%o]', error)
    );
    
    this._serialProcess.on('error', error =>
      console.error('serialStreamer::serialHandler::error [error:%o]', error)
    );
    
    this._process.once('close', () => {
      console.log('serialStreamer::ffmpeg::close');
      // Kill the serial handler if ffmpeg exits
      if (this._serialProcess) {
        this._serialProcess.kill('SIGINT');
      }
      this._observer.emit('process-close');
    });
    
    this._serialProcess.once('close', () => {
      console.log('serialStreamer::serialHandler::close');
    });
    
    // Pipe SDP to ffmpeg
    sdpStream.on('error', error =>
      console.error('sdpStream::error [error:%o]', error)
    );
    
    sdpStream.resume();
    sdpStream.pipe(this._process.stdin);
  }

  kill() {
    console.log('kill() [ffmpeg pid:%d, serialHandler pid:%d]', 
      this._process ? this._process.pid : 'unknown',
      this._serialProcess ? this._serialProcess.pid : 'unknown');
    
    if (this._process) {
      this._process.kill('SIGINT');
    }
    
    if (this._serialProcess) {
      this._serialProcess.kill('SIGINT');
    }
  }
}
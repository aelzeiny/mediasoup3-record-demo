// Simple script to test the serial streamer by receiving and decoding frames

const fs = require('fs');
const path = require('path');

// Set this to match the virtual serial port created by socat
const SERIAL_DEVICE = process.env.SERIAL_DEVICE || '/tmp/vserial2';

console.log(`Opening serial device: ${SERIAL_DEVICE}`);

// Buffer to accumulate data
let buffer = Buffer.alloc(0);
const HEADER = Buffer.from([0xAA, 0xBB, 0xCC, 0xDD]);

// Create output directory for received frames
const OUTPUT_DIR = path.join(__dirname, 'received_frames');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

// Create read stream from the serial device
let serialStream;

// Try to open the serial device, retry if it's not available yet
function openSerialDevice() {
  try {
    serialStream = fs.createReadStream(SERIAL_DEVICE, {
      highWaterMark: 65536, // Large buffer for better performance
      encoding: null // Binary mode
    });
    
    console.log(`Successfully opened serial device: ${SERIAL_DEVICE}`);
    
    // Set up event handlers
    setupEventHandlers();
  } catch (err) {
    console.error(`Failed to open serial device ${SERIAL_DEVICE}: ${err.message}`);
    console.log('Retrying in 3 seconds...');
    setTimeout(openSerialDevice, 3000);
  }
}

function setupEventHandlers() {
  // Process incoming data
  serialStream.on('data', (chunk) => {
    // Append to existing buffer
    buffer = Buffer.concat([buffer, chunk]);
    
    // Process complete frames
    processFrames();
  });
  
  serialStream.on('error', (err) => {
    console.error(`Serial stream error: ${err.message}`);
    
    // If the device disconnects, try to reopen it
    if (err.code === 'ENOENT' || err.code === 'EBADF') {
      console.log('Device disconnected, attempting to reconnect...');
      setTimeout(openSerialDevice, 3000);
    }
  });
  
  serialStream.on('close', () => {
    console.log('Serial stream closed. Attempting to reopen...');
    setTimeout(openSerialDevice, 3000);
  });
}

// Frame counter for naming files
let frameCount = 0;

function processFrames() {
  // Keep processing until we don't have enough data for a complete frame
  while (buffer.length > HEADER.length + 4) {
    // Look for header
    const headerIndex = findHeader(buffer);
    
    if (headerIndex === -1) {
      // No header found, keep only the last few bytes in case header is split
      if (buffer.length > HEADER.length) {
        buffer = buffer.slice(buffer.length - HEADER.length);
      }
      return;
    }
    
    // If header is not at the beginning, discard data before header
    if (headerIndex > 0) {
      buffer = buffer.slice(headerIndex);
      continue;
    }
    
    // Check if we have enough data to read the frame size
    if (buffer.length < HEADER.length + 4) {
      return; // Not enough data yet
    }
    
    // Read frame size (4 bytes after header)
    const frameSize = buffer.readUInt32BE(HEADER.length);
    
    // Check if we have a complete frame
    if (buffer.length < HEADER.length + 4 + frameSize) {
      return; // Not enough data yet
    }
    
    // Extract frame data
    const frameData = buffer.slice(HEADER.length + 4, HEADER.length + 4 + frameSize);
    
    // Remove processed frame from buffer
    buffer = buffer.slice(HEADER.length + 4 + frameSize);
    
    // Process the frame (save to file)
    saveFrame(frameData);
  }
}

function findHeader(buf) {
  for (let i = 0; i <= buf.length - HEADER.length; i++) {
    let match = true;
    for (let j = 0; j < HEADER.length; j++) {
      if (buf[i + j] !== HEADER[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return i;
    }
  }
  return -1;
}

function saveFrame(frameData) {
  const filename = path.join(OUTPUT_DIR, `frame_${frameCount++}.yuv`);
  
  // Save the raw frame data
  fs.writeFileSync(filename, frameData);
  
  console.log(`Saved frame ${frameCount-1}, size: ${frameData.length} bytes`);
  
  // Every 30 frames, convert one to a viewable image
  if ((frameCount - 1) % 30 === 0) {
    convertFrameToImage(filename);
  }
}

function convertFrameToImage(yuvFile) {
  // This requires ffmpeg to be installed
  const outFile = yuvFile.replace('.yuv', '.jpg');
  
  const { execSync } = require('child_process');
  
  // Convert YUV420p frame to JPEG (assuming 320x240 resolution)
  try {
    execSync(`ffmpeg -y -f rawvideo -pixel_format yuv420p -video_size 320x240 -i "${yuvFile}" "${outFile}"`, 
             { stdio: 'ignore' });
    console.log(`Converted ${path.basename(yuvFile)} to JPEG`);
  } catch (err) {
    console.error(`Failed to convert frame to JPEG: ${err.message}`);
  }
}

// Start the initial connection attempt
openSerialDevice();

console.log(`Serial receiver started. Saving frames to ${OUTPUT_DIR}`);
console.log('Press Ctrl+C to stop');
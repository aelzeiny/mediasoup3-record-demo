#!/bin/bash

# Create virtual serial port pair
SERIAL1="/tmp/vserial1"
SERIAL2="/tmp/vserial2"

# Clean up old virtual ports
rm -f $SERIAL1 $SERIAL2

# Remove existing socat processes
pkill -f "socat -d -d pty,raw,echo=0,link=$SERIAL1" || true

# Create virtual serial port pair
echo "Creating virtual serial ports: $SERIAL1 and $SERIAL2"
socat -d -d pty,raw,echo=0,link=$SERIAL1 pty,raw,echo=0,link=$SERIAL2 &
SOCAT_PID=$!

# Wait for ports to be created
sleep 2

# Ensure proper permissions
if [ -e "$SERIAL1" ]; then
  chmod 666 $SERIAL1
  echo "Set permissions for $SERIAL1"
fi

if [ -e "$SERIAL2" ]; then
  chmod 666 $SERIAL2
  echo "Set permissions for $SERIAL2"
fi

echo "Starting receiver in a new terminal..."
# Open a new terminal for the receiver
osascript -e "tell application \"Terminal\" to do script \"cd $(pwd) && node test-serial-receiver.js\""

# Wait a moment for the receiver to start
sleep 2

echo "Starting server with SerialStreamer..."
# Start the server with SerialStreamer
PROCESS_NAME="SerialStreamer" SERIAL_DEVICE=$SERIAL1 node src/server.js

# Clean up on exit
function cleanup {
  echo "Cleaning up..."
  kill $SOCAT_PID
  rm -f $SERIAL1 $SERIAL2
}

trap cleanup EXIT
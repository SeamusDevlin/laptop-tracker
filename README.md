# laptop-tracker

macOS
bash# Download from nodejs.org
# Or use Homebrew
brew install node

Verify installation:
bashnode --version  # Should be v14.0.0 or higher
npm --version

Clone or Download the Project
git clone https://github.com/yourusername/laptop-tracker.git
cd laptop-tracker

Install Dependencies
npm install

Method 1: Start Proxy Server + Open HTML
bash# Start the proxy server
node proxy-server.js

# Then open index.html in your browser
# Double-click index.html
# Or serve it locally (see Method 2)
Method 2: Use Live Server (Recommended)
Option A: Using Python
bash# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Then start proxy server in another terminal
node proxy-server.js
Option B: Using Node.js http-server
bash# Install http-server globally
npm install -g http-server

# Start frontend server
http-server -p 8000

# Start proxy server in another terminal
node proxy-server.js
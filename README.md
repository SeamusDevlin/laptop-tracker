# laptop-tracker

macOS
# Download from nodejs.org
Or use Homebrew
brew install node

# Verify installation:
node --version  # Should be v14.0.0 or higher
npm --version

# Clone or Download the Project
git clone https://github.com/yourusername/laptop-tracker.git
cd laptop-tracker

# Install Dependencies
npm install

# Method 1:
Start Proxy Server + Open HTML
bash# Start the proxy server
node proxy-server.js
Then open index.html in your browser
Double-click index.html
Or serve it locally (see Method 2)
# Method 2:
Use Live Server (Recommended)
Option A: Using Python
python -m http.server 8000
python -m SimpleHTTPServer 800
node proxy-server.js
# Option B: Using Node.js http-server
Install http-server globally
npm install -g http-server

# Start frontend server
http-server -p 8000

# Start proxy server in another terminal
node proxy-server.js
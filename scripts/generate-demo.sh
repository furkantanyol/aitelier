#!/bin/bash
set -e

echo "🎬 Generating demo..."
echo ""

# Make sure we're in the right directory
cd "$(dirname "$0")/.."

# Check if vhs is installed
if ! command -v vhs &> /dev/null; then
    echo "❌ VHS not found. Install it with:"
    echo "   brew install vhs"
    exit 1
fi

# Check if aitelier is installed globally
if ! command -v ait &> /dev/null; then
    echo "❌ aitelier not found. Install it with:"
    echo "   npm install -g aitelier"
    exit 1
fi

# Make sure the example project exists and has data
if [ ! -d "examples/customer-support" ]; then
    echo "❌ Example project not found at examples/customer-support"
    exit 1
fi

# Generate the demo
echo "✅ Requirements met. Generating demo with VHS..."
vhs demo.tape

echo ""
echo "✅ Demo generated: demo.gif"
echo "📦 Size: $(du -h demo.gif | cut -f1)"
echo ""
echo "Preview with: open demo.gif"

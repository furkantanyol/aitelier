# VHS documentation: https://github.com/charmbracelet/vhs

Output demo.gif
Set FontSize 16
Set Width 1400
Set Height 900
Set Theme "Catppuccin Mocha"
Set Padding 20

# Show the intro
Type "# aitelier - Your AI atelier for fine-tuning LLMs 🎨"
Sleep 1s
Enter
Enter
Sleep 500ms

# Installation
Type "npm install -g aitelier"
Sleep 500ms
Enter
Sleep 1.5s
Type "✓ Installed!"
Sleep 500ms
Enter
Enter
Sleep 500ms

# Create project directory
Type "mkdir my-support-bot && cd my-support-bot"
Sleep 300ms
Enter
Sleep 500ms

# Initialize
Type "ait init"
Sleep 300ms
Enter
Sleep 1s
Type "customer-support-bot"
Sleep 500ms
Enter
Sleep 500ms
Down  # Select Together.ai
Sleep 300ms
Enter
Sleep 500ms
Enter  # Accept default model
Sleep 500ms
Type "You are a helpful customer support agent."
Sleep 300ms
Enter
Sleep 2s

# Show what was created
Type "ls -la"
Sleep 300ms
Enter
Sleep 1.5s

# Create example files (skip interactive mode)
Type "# Let's add training examples using file mode"
Sleep 500ms
Enter
Type "echo 'How do I reset my password?' > input.txt"
Sleep 300ms
Enter
Type "echo 'You can reset your password by visiting...' > output.txt"
Sleep 300ms
Enter
Sleep 300ms
Type "ait add --input input.txt --output output.txt"
Sleep 300ms
Enter
Sleep 1.5s

# Add a couple more quickly
Type "echo 'What is your refund policy?' > input.txt"
Sleep 200ms
Enter
Type "echo 'We offer full refunds within 30 days...' > output.txt"
Sleep 200ms
Enter
Type "ait add --input input.txt --output output.txt"
Sleep 200ms
Enter
Sleep 1s

# Show stats
Type "ait stats"
Sleep 300ms
Enter
Sleep 3s

# Show the workflow
Type "# Full workflow: init → add → rate → split → train → eval"
Sleep 1.5s
Enter
Sleep 500ms
Type "# Get started: npm install -g aitelier"
Sleep 2s

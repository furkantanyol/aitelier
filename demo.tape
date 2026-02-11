# VHS documentation: https://github.com/charmbracelet/vhs
# Clean, simple demo showing aitelier's beautiful CLI

Output demo.gif

# Settings - balanced for banner visibility
Set FontSize 18
Set Width 1400
Set Height 1000
Set Theme "Catppuccin Mocha"
Set Padding 30

# Title
Type "# aitelier 🎨"
Enter
Type "# Beautiful CLI for fine-tuning LLMs"
Enter
Sleep 2s
Enter

# Show help (actual command with real output)
Type "ait --help"
Enter
Sleep 3s
Enter

# Navigate to example
Type "cd examples/customer-support"
Enter
Sleep 500ms

# Show the beautiful stats (actual command with real colored output)
Type "ait stats"
Enter
Sleep 4s
Enter

# Show workflow (just comment, no execution)
Type "# Complete workflow:"
Enter
Type "# ait init → add → rate → stats → split → train → eval"
Sleep 2s
Enter
Enter

# Installation
Type "npm install -g aitelier"
Sleep 2s

class Aitelier < Formula
  desc "Your AI atelier - craft fine-tuned models"
  homepage "https://github.com/furkantanyol/ft-pipeline"
  url "https://registry.npmjs.org/aitelier/-/aitelier-0.1.0.tgz"
  sha256 "PLACEHOLDER_SHA256"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    system bin/"ait", "--version"
    assert_match "0.1.0", shell_output("#{bin}/ait --version")
  end
end

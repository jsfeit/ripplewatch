#!/bin/sh
# Builds the zip OpenAI's plugin dashboard expects: manifest, MCP config,
# skills and assets at the zip root. SUBMISSION.md and the build output stay
# out of it, and nothing here holds credentials.
set -e
cd "$(dirname "$0")/../chatgpt-plugin"
mkdir -p dist
rm -f dist/ripplewatch-plugin.zip
zip -rq dist/ripplewatch-plugin.zip plugin.json mcp.json skills assets -x "*.DS_Store"
unzip -l dist/ripplewatch-plugin.zip

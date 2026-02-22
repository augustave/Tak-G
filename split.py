import re

with open('src/main.js', 'r') as f:
    js = f.read()

# Extract shaders
mapVS_match = re.search(r'(const mapVS = `.*?`;)', js, re.DOTALL)
mapFS_match = re.search(r'(const mapFS = `.*?`;)', js, re.DOTALL)

with open('src/shaders.js', 'w') as f:
    f.write(f"export {mapVS_match.group(1)}\n\nexport {mapFS_match.group(1)}\n")

# Remove shaders from main.js and add import
js = js.replace(mapVS_match.group(1), "import { mapVS, mapFS } from './shaders.js';")
js = js.replace(mapFS_match.group(1), "")

with open('src/main.js', 'w') as f:
    f.write(js)


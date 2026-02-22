import re

with open('src/main.js', 'r') as f:
    js = f.read()

fallback_match = re.search(r'(const fallbackDecoyProfiles = \[.*?\];)', js, re.DOTALL)
track_match = re.search(r'(const trackData = \[.*?\];)', js, re.DOTALL)
source_match = re.search(r'(const sources = \[.*?\];)', js, re.DOTALL)
conf_match = re.search(r'(const confidences = \[.*?\];)', js, re.DOTALL)
sigint_match = re.search(r'(const sigintMessages = \[.*?\];)', js, re.DOTALL)

with open('src/data/mockData.js', 'w') as f:
    f.write(f"export {fallback_match.group(1)}\n\n")
    f.write(f"export {track_match.group(1)}\n\n")
    f.write(f"export {source_match.group(1)}\n\n")
    f.write(f"export {conf_match.group(1)}\n\n")
    f.write(f"export {sigint_match.group(1)}\n")

js = js.replace(fallback_match.group(1), "")
js = js.replace(track_match.group(1), "")
js = js.replace(source_match.group(1), "")
js = js.replace(conf_match.group(1), "")
js = js.replace(sigint_match.group(1), "")
js = "import { fallbackDecoyProfiles, trackData, sources, confidences, sigintMessages } from './data/mockData.js';\n" + js

with open('src/main.js', 'w') as f:
    f.write(js)

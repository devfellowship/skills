# Viewport × input × content matrix — a missing row is a blocker

| Band | Size | Input | Design frame, rule, or "out of scope + what the user sees" | Content stress fixture | Where it fails (test / CI / screenshot + approver) |
|---|---|---|---|---|---|
| Phone small | 360×740 | touch | | 60-char title, 0 items, 200 items | |
| Phone std | 390×844 | touch | | | |
| Phone large | 430×932 | touch | | | |
| Phone landscape | 844×390 | touch | | | |
| Tablet / narrow desktop | 768–1023 | touch **and** mouse | | | |
| Laptop | 1280×720 | mouse | | | |
| Desktop | 1440×900 | mouse | | | |
| Desktop window resized narrow | 390 wide | mouse | | | |

Mode selection: how the app decides which tree/layout to render (UA, pointer,
width, stored choice) → which band gets which tree: ________

Reviewer recipe to see each band from a laptop: ________ (e.g. `?ui=mobile` in a fresh tab)

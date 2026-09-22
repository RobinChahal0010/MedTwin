MidTwin — how to run it
=======================

Option 1 (simplest)
    Double-click index.html. Everything works offline.

Option 2 (recommended — the microphone is more reliable)
    In this folder run:   python -m http.server 5500
    Then open:            http://localhost:5500

Files
    index.html        the app shell
    css/style.css     colours, layout, light + dark theme, cursor layer
    js/app.js         accounts, numbers, trends, answer engine, plans

Pages inside
    Home · Health picture · My numbers · Trends
    Ask MidTwin · Food plan · Movement · Learn · Doctor visit · History · Profile

Where is my data?
    Accounts, photos, numbers, snapshots, questions and plans live in this
    browser's localStorage on this device only. Nothing is uploaded.

Note
    A learning demo, not a doctor. Built around adults whose Type 2 diabetes
    was found at age 30 or later. Please use sample numbers only.

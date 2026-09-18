# Current implementation contracts

See the repository README for v0.47 ownership, testing, deployment and media procedures. The accepted visual baseline is v0.46 r6, commit 94fa46401571dcb6363d153dab3b66030f91830c.

Do not remove standalone viewport handling because it listens to resize. Measurement, applying bounds and resizing the renderer have distinct responsibilities. Do not replace the approved default iOS status bar or add arbitrary whole-screen offsets.

All cards use the existing shared surface. Dialogs register with UI.bindDialog; long content scrolls inside a card while its close control stays outside that scroller. Diagnostics allow text selection. Small menus need not become modals.

Source/code deployment must not rebuild or upload media. Lost photographic masters are not recoverable merely by renaming a derived tier. Review original archives and UI approval hashes explicitly.

Offline browser tests use synthetic textures and local language data. Their success does not certify physical iPhone rendering, native GPU output, live R2 delivery or completed Cloudflare deployment.

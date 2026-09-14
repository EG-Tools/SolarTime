/* Backward-compatible entry point. Web assets are now URL manifests; the
 * standalone HTML receives its Base64 payload directly from build.cjs. */
'use strict';
require('./build-assets.cjs');

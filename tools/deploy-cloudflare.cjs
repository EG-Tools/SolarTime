/* Compatibility entry point: one reviewed deployment implementation. */
'use strict';
require('./deployment.cjs').main().catch(error=>{console.error('DEPLOYMENT NOT COMPLETE: '+error.message);process.exitCode=1;});

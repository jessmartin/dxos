//
// Copyright 2020 DXOS.org
//

const {
  FixMemdownPlugin,
  NodeGlobalsPolyfillPlugin,
  NodeModulesPlugin
} = require('@dxos/esbuild-plugins');

/** @type {import('@dxos/esbuild-server').Config} */
module.exports = {
  entryPoints: [
    'stories/main.tsx'
  ],
  outdir: 'out',
  overrides: {
    sourcemap: 'inline'
  },
  plugins: [
    NodeGlobalsPolyfillPlugin(), // TODO(burdon): Reorder.
    FixMemdownPlugin(),
    NodeModulesPlugin()
  ],
  staticDir: 'public'
};

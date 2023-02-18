//
// Copyright 2023 DXOS.org
//

import React from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

import '@dxosTheme';

import '@dxos/kai/style.css';

createRoot(document.getElementById('root')!).render(<App />);

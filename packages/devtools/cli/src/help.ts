//
// Copyright 2023 DXOS.org
//

import { Help } from '@oclif/core';

// http://patorjk.com/software/taag/#p=testall&f=Patorjk-HeX&t=DXOS
export const BANNER =
  '_/\\/\\/\\/\\/\\____/\\/\\____/\\/\\____/\\/\\/\\/\\______/\\/\\/\\/\\/\\_\n' +
  '_/\\/\\____/\\/\\____/\\/\\/\\/\\____/\\/\\____/\\/\\__/\\/\\_________\n' +
  '_/\\/\\____/\\/\\______/\\/\\______/\\/\\____/\\/\\____/\\/\\/\\/\\___\n' +
  '_/\\/\\____/\\/\\____/\\/\\/\\/\\____/\\/\\____/\\/\\__________/\\/\\_\n' +
  '_/\\/\\/\\/\\/\\____/\\/\\____/\\/\\____/\\/\\/\\/\\____/\\/\\/\\/\\/\\___\n';

export default class CustomHelp extends Help {
  override async showHelp(args: string[]) {
    if (!args.length) {
      console.log(BANNER);
    }

    await super.showHelp(args);
  }
}

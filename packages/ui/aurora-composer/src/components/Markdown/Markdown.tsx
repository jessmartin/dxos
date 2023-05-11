//
// Copyright 2023 DXOS.org
//

import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import {
  bracketMatching,
  defaultHighlightStyle,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting
} from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { lintKeymap } from '@codemirror/lint';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { EditorState } from '@codemirror/state';
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark';
import {
  keymap,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  placeholder,
  rectangularSelection,
  EditorView
} from '@codemirror/view';
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { yCollab } from 'y-codemirror.next';

import { useThemeContext } from '@dxos/aurora';
import { configPalettes } from '@dxos/aurora-theme';
import { YText } from '@dxos/text-model';
import { humanize } from '@dxos/util';

import { ComposerModel, ComposerSlots } from '../../model';
import { markdownTagsExtension } from './markdownTags';
import { markdownDarkHighlighting, markdownTheme } from './markdownTheme';

export type MarkdownComposerProps = {
  model?: ComposerModel;
  slots?: ComposerSlots;
};

export type MarkdownComposerRef = {
  editor: HTMLDivElement | null;
  state?: EditorState;
  view?: EditorView;
};

const hexadecimalPaletteSeries: (keyof typeof configPalettes)[] = [
  'red' as const,
  'orange' as const,
  'amber' as const,
  'yellow' as const,
  'lime' as const,
  'green' as const,
  'emerald' as const,
  'teal' as const,
  'cyan' as const,
  'sky' as const,
  'indigo' as const,
  'violet' as const,
  'purple' as const,
  'fuchsia' as const,
  'pink' as const,
  'rose' as const
];

const shadeKeys = {
  color: '450' as const,
  highlightDark: '800' as const,
  highlightLight: '100' as const
};

export const MarkdownComposer = forwardRef<MarkdownComposerRef, MarkdownComposerProps>(
  ({ model, slots = {} }, forwardedRef) => {
    const { id, content, provider, peer } = model ?? {};
    const { themeMode } = useThemeContext();

    const [parent, setParent] = useState<HTMLDivElement | null>(null);
    const [state, setState] = useState<EditorState>();
    const [view, setView] = useState<EditorView>();
    useImperativeHandle(forwardedRef, () => ({
      editor: parent,
      state,
      view
    }));

    useEffect(() => {
      if (provider && peer) {
        let peerColorDigit = Math.floor(16 * Math.random());
        try {
          // TODO(wittjosiah): Factor out for use w/ html-only story and RichText component.
          // `peer.id` is already a `string`, so we attempt `parseInt` within a `try` since we can’t be certain it is hexadecimal.
          peerColorDigit = parseInt(peer.id.slice(-1), 16);
        } catch (_) {}
        provider.awareness.setLocalStateField('user', {
          name: peer.name ?? humanize(peer.id),
          color: configPalettes[hexadecimalPaletteSeries[peerColorDigit]][shadeKeys.color],
          colorLight:
            configPalettes[hexadecimalPaletteSeries[peerColorDigit]][
              shadeKeys[themeMode === 'dark' ? 'highlightDark' : 'highlightLight']
            ]
        });
      }
    }, [provider, peer, themeMode]);

    useEffect(() => {
      if (!parent) {
        return;
      }

      const state = EditorState.create({
        doc: content?.toString(),
        extensions: [
          // All of https://github.com/codemirror/basic-setup minus line numbers and fold gutter.
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          bracketMatching(),
          closeBrackets(),
          autocompletion(),
          rectangularSelection(),
          crosshairCursor(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          placeholder(slots.editor?.placeholder ?? ''), // TODO(burdon): Needs consistent styling.
          keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...completionKeymap,
            ...lintKeymap
          ]),
          EditorView.lineWrapping,
          // Theme
          markdown({ base: markdownLanguage, codeLanguages: languages, extensions: [markdownTagsExtension] }),
          EditorView.theme({ ...markdownTheme, ...slots.editor?.markdownTheme }),
          ...(themeMode === 'dark'
            ? [syntaxHighlighting(oneDarkHighlightStyle)]
            : [syntaxHighlighting(defaultHighlightStyle)]),
          // TODO(thure): All but one rule here apply to both themes; rename or refactor.
          syntaxHighlighting(markdownDarkHighlighting),

          // Collaboration
          ...(content instanceof YText ? [yCollab(content, provider?.awareness)] : [])
        ]
      });

      setState(state);

      // NOTE: This repaints the editor.
      // If the new state is derived from the old state, it will likely not be visible other than the cursor resetting.
      // Ideally this should not be hit except when changing between text objects.
      setView(new EditorView({ state, parent }));

      return () => {
        if (view) {
          view.destroy();
          setView(undefined);
          setState(undefined);
        }
      };
    }, [parent, content, provider?.awareness, themeMode]);

    return <div key={id} {...slots.root} ref={setParent} />;
  }
);
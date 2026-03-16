import React, { useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

interface EditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
}

export const SpiceEditor: React.FC<EditorProps> = ({ value, onChange }) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;

    // Register completion provider for nodes inside v(...)
    monacoInstance.languages.registerCompletionItemProvider('plaintext', {
      triggerCharacters: ['(', ','],
      provideCompletionItems: (model, position) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });

        // Check if we are inside v(...)
        const match = textUntilPosition.match(/v\(([^)]*)$/i);
        if (!match) return { suggestions: [] };

        // Extract nodes from the current netlist
        const fullText = model.getValue();
        const nodes = new Set<string>();
        
        // Simple SPICE node extraction logic
        const lines = fullText.split('\n');
        lines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('*') || trimmed.startsWith('.')) return;
          
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 3) {
            const firstChar = parts[0][0].toUpperCase();
            // Most components have nodes as 2nd and 3rd tokens
            // Subcircuits (X) can have more
            if ('RCLVIDQM'.includes(firstChar)) {
              nodes.add(parts[1]);
              nodes.add(parts[2]);
            } else if (firstChar === 'X') {
              // For subcircuits, add all tokens until the subcircuit name
              for (let i = 1; i < parts.length - 1; i++) {
                nodes.add(parts[i]);
              }
            }
          }
        });

        const suggestions: monaco.languages.CompletionItem[] = Array.from(nodes)
          .filter(node => node !== '0') // 0 is ground, usually always there but maybe good to include
          .map(node => ({
            label: node,
            kind: monacoInstance.languages.CompletionItemKind.Variable,
            insertText: node,
            detail: 'Circuit Node',
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: position.column - (match[1]?.length || 0),
              endColumn: position.column
            }
          }));

        // Add '0' (ground) explicitly
        suggestions.push({
          label: '0',
          kind: monacoInstance.languages.CompletionItemKind.Constant,
          insertText: '0',
          detail: 'Ground Node',
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - (match[1]?.length || 0),
            endColumn: position.column
          }
        });

        return { suggestions };
      }
    });
  };

  return (
    <div className="h-full w-full border border-white/10 rounded-lg overflow-hidden bg-[#1e1e1e]">
      <Editor
        height="100%"
        defaultLanguage="plaintext"
        theme="vs-dark"
        value={value}
        onChange={onChange}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', monospace",
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 16, bottom: 16 },
          wordBasedSuggestions: "off", // Disable default to prioritize our nodes
          suggestOnTriggerCharacters: true
        }}
      />
    </div>
  );
};

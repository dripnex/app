/**
 * Editor Settings Section
 *
 * All editor-related settings: interface, text appearance, markdown.
 */

import { useSettingsStore, selectEditor } from '../../../stores/settings';
import { SettingGroup } from '../components/SettingGroup';
import { SettingNumber } from '../components/SettingNumber';
import { SettingSelect } from '../components/SettingSelect';
import { SettingToggle } from '../components/SettingToggle';
import { SettingsPage } from '../components/SettingsPage';

const FONT_SIZE_OPTIONS = [12, 13, 14, 15, 16, 18, 20, 22, 24].map(size => ({
  value: String(size),
  label: `${size} px`,
}));

const FONT_FAMILY_OPTIONS = [
  {
    value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    label: 'System Mono',
  },
  { value: "'SF Mono', ui-monospace, monospace", label: 'SF Mono' },
  { value: "Menlo, Monaco, 'Courier New', monospace", label: 'Menlo' },
  { value: "'JetBrains Mono', ui-monospace, monospace", label: 'JetBrains Mono' },
  { value: "'Fira Code', ui-monospace, monospace", label: 'Fira Code' },
  { value: "'IBM Plex Mono', ui-monospace, monospace", label: 'IBM Plex Mono' },
  { value: "'Source Code Pro', ui-monospace, monospace", label: 'Source Code Pro' },
  { value: "'Cascadia Code', Consolas, ui-monospace, monospace", label: 'Cascadia Code' },
  { value: 'ui-sans-serif, system-ui, -apple-system, sans-serif', label: 'System Sans' },
  { value: 'Inter, ui-sans-serif, system-ui, sans-serif', label: 'Inter' },
];

export function EditorSection() {
  const editor = useSettingsStore(selectEditor);
  const updateEditor = useSettingsStore(s => s.updateEditor);

  return (
    <SettingsPage title="Editor">
      <SettingGroup title="Interface">
        <SettingToggle
          label="Line Numbers"
          description="Show line numbers to the left of the editor"
          htmlFor="lineNumbers"
          checked={editor.lineNumbers}
          onChange={checked => updateEditor({ lineNumbers: checked })}
        />
        <SettingToggle
          label="Highlight Active Line"
          description="Highlight the current cursor line"
          htmlFor="highlightActiveLine"
          checked={editor.highlightActiveLine}
          onChange={checked => updateEditor({ highlightActiveLine: checked })}
        />
        <SettingToggle
          label="Readable Line Length"
          description="Limit the editor and preview to a comfortable column width"
          htmlFor="readableLineLength"
          checked={editor.readableLineLength}
          onChange={checked => updateEditor({ readableLineLength: checked })}
        />
        <SettingToggle
          label="Line Wrapping"
          description="Wrap long lines instead of horizontal scrolling"
          htmlFor="lineWrapping"
          checked={editor.lineWrapping}
          onChange={checked => updateEditor({ lineWrapping: checked })}
        />
        <SettingToggle
          label="Inline Image Widgets"
          description="Show image previews directly in the editor"
          htmlFor="inlineImages"
          checked={editor.inlineImages}
          onChange={checked => updateEditor({ inlineImages: checked })}
        />
        <SettingToggle
          label="Scroll Past End"
          description="Allow scrolling past the end of the document"
          htmlFor="scrollPastEnd"
          checked={editor.scrollPastEnd}
          onChange={checked => updateEditor({ scrollPastEnd: checked })}
        />
        <SettingToggle
          label="Spell Check"
          description="Check spelling while typing"
          htmlFor="spellCheck"
          checked={editor.spellCheck}
          onChange={checked => updateEditor({ spellCheck: checked })}
        />
      </SettingGroup>

      {/* Text Appearance Group */}
      <SettingGroup title="Text Appearance">
        <SettingSelect
          label="Font Size"
          description="Size of editor text"
          htmlFor="fontSize"
          value={String(editor.fontSize)}
          onChange={value => updateEditor({ fontSize: Number(value) })}
          options={
            FONT_SIZE_OPTIONS.some(option => option.value === String(editor.fontSize))
              ? FONT_SIZE_OPTIONS
              : [
                  { value: String(editor.fontSize), label: `${editor.fontSize} px` },
                  ...FONT_SIZE_OPTIONS,
                ]
          }
        />
        <SettingSelect
          label="Font Family"
          description="Typeface for the source editor"
          htmlFor="fontFamily"
          value={editor.fontFamily}
          onChange={value => updateEditor({ fontFamily: value })}
          options={
            FONT_FAMILY_OPTIONS.some(option => option.value === editor.fontFamily)
              ? FONT_FAMILY_OPTIONS
              : [{ value: editor.fontFamily, label: 'Current' }, ...FONT_FAMILY_OPTIONS]
          }
        />
        <SettingNumber
          label="Line Height"
          description="Line height multiplier"
          htmlFor="lineHeight"
          value={editor.lineHeight}
          onChange={value => updateEditor({ lineHeight: value })}
          min={1}
          max={3}
          step={0.1}
        />
      </SettingGroup>

      <SettingGroup title="Markdown">
        <SettingNumber
          label="Tab Size"
          description="Number of spaces per tab"
          htmlFor="tabSize"
          value={editor.tabSize}
          onChange={value => updateEditor({ tabSize: value })}
          min={1}
          max={8}
          step={1}
        />

        <SettingToggle
          label="Indent with Tabs"
          description="Use tabs instead of spaces for indentation"
          htmlFor="indentWithTabs"
          checked={editor.indentWithTabs}
          onChange={checked => updateEditor({ indentWithTabs: checked })}
        />
      </SettingGroup>
    </SettingsPage>
  );
}

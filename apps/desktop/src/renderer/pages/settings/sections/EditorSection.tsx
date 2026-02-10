/**
 * Editor Settings Section
 *
 * All editor-related settings: interface, text appearance, markdown.
 */

import { useSettingsStore, selectEditor } from '../../../stores/settings';
import { SettingGroup } from '../components/SettingGroup';
import { SettingRow } from '../components/SettingRow';
import { Toggle, NumberInput, TextInput } from '../components/controls';
import styles from './Section.module.css';

export function EditorSection() {
  const editor = useSettingsStore(selectEditor);
  const updateEditor = useSettingsStore(s => s.updateEditor);

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>Editor</h2>

      {/* Interface Group */}
      <SettingGroup title="Interface">
        <SettingRow
          label="Line Numbers"
          description="Show line numbers to the left of the editor"
          htmlFor="lineNumbers"
        >
          <Toggle
            id="lineNumbers"
            checked={editor.lineNumbers}
            onChange={checked => updateEditor({ lineNumbers: checked })}
          />
        </SettingRow>

        <SettingRow
          label="Highlight Active Line"
          description="Highlight the current cursor line"
          htmlFor="highlightActiveLine"
        >
          <Toggle
            id="highlightActiveLine"
            checked={editor.highlightActiveLine}
            onChange={checked => updateEditor({ highlightActiveLine: checked })}
          />
        </SettingRow>

        <SettingRow
          label="Line Wrapping"
          description="Wrap long lines instead of horizontal scrolling"
          htmlFor="lineWrapping"
        >
          <Toggle
            id="lineWrapping"
            checked={editor.lineWrapping}
            onChange={checked => updateEditor({ lineWrapping: checked })}
          />
        </SettingRow>

        <SettingRow
          label="Inline Image Widgets"
          description="Show image previews directly in the editor"
          htmlFor="inlineImages"
        >
          <Toggle
            id="inlineImages"
            checked={editor.inlineImages}
            onChange={checked => updateEditor({ inlineImages: checked })}
          />
        </SettingRow>

        <SettingRow
          label="Scroll Past End"
          description="Allow scrolling past the end of the document"
          htmlFor="scrollPastEnd"
        >
          <Toggle
            id="scrollPastEnd"
            checked={editor.scrollPastEnd}
            onChange={checked => updateEditor({ scrollPastEnd: checked })}
          />
        </SettingRow>

        <SettingRow
          label="Spell Check"
          description="Check spelling while typing"
          htmlFor="spellCheck"
        >
          <Toggle
            id="spellCheck"
            checked={editor.spellCheck}
            onChange={checked => updateEditor({ spellCheck: checked })}
          />
        </SettingRow>
      </SettingGroup>

      {/* Text Appearance Group */}
      <SettingGroup title="Text Appearance">
        <SettingRow
          label="Font Size"
          description="Size of editor text in pixels"
          htmlFor="fontSize"
        >
          <NumberInput
            id="fontSize"
            value={editor.fontSize}
            onChange={value => updateEditor({ fontSize: value })}
            min={10}
            max={32}
            step={1}
          />
        </SettingRow>

        <SettingRow
          label="Font Family"
          description="Font family for editor text"
          htmlFor="fontFamily"
        >
          <TextInput
            id="fontFamily"
            value={editor.fontFamily}
            onChange={value => updateEditor({ fontFamily: value })}
            placeholder="ui-monospace, monospace"
          />
        </SettingRow>

        <SettingRow label="Line Height" description="Line height multiplier" htmlFor="lineHeight">
          <NumberInput
            id="lineHeight"
            value={editor.lineHeight}
            onChange={value => updateEditor({ lineHeight: value })}
            min={1}
            max={3}
            step={0.1}
          />
        </SettingRow>
      </SettingGroup>

      {/* Markdown Group */}
      <SettingGroup title="Markdown">
        <SettingRow label="Tab Size" description="Number of spaces per tab" htmlFor="tabSize">
          <NumberInput
            id="tabSize"
            value={editor.tabSize}
            onChange={value => updateEditor({ tabSize: value })}
            min={1}
            max={8}
            step={1}
          />
        </SettingRow>

        <SettingRow
          label="Indent with Tabs"
          description="Use tabs instead of spaces for indentation"
          htmlFor="indentWithTabs"
        >
          <Toggle
            id="indentWithTabs"
            checked={editor.indentWithTabs}
            onChange={checked => updateEditor({ indentWithTabs: checked })}
          />
        </SettingRow>
      </SettingGroup>
    </div>
  );
}

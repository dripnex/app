/**
 * Editor Settings Section
 *
 * All editor-related settings: interface, text appearance, markdown.
 */

import { useSettingsStore, selectEditor } from '../../../stores/settings';
import { SettingGroup } from '../components/SettingGroup';
import { SettingRow } from '../components/SettingRow';
import { SettingToggle } from '../components/SettingToggle';
import { Input, NumberInput } from '../../../ui/primitives';
import styles from './Section.module.css';

export function EditorSection() {
  const editor = useSettingsStore(selectEditor);
  const updateEditor = useSettingsStore(s => s.updateEditor);

  return (
    <div className={styles.section}>
      <h2 className={styles.title}>Editor</h2>

      {/* Interface Group */}
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
          <Input
            id="fontFamily"
            value={editor.fontFamily}
            onChange={event => updateEditor({ fontFamily: event.target.value })}
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

        <SettingToggle
          label="Indent with Tabs"
          description="Use tabs instead of spaces for indentation"
          htmlFor="indentWithTabs"
          checked={editor.indentWithTabs}
          onChange={checked => updateEditor({ indentWithTabs: checked })}
        />
      </SettingGroup>
    </div>
  );
}

import { hostSetActiveTheme } from '../loader/hostBridges';
import { themeRegistryStore } from './themeRegistryStore';

export interface ThemeInfo {
  id: string;
  name: string;
  colorScheme: 'dark' | 'light';
  description?: string;
}

export interface ThemesAPI {
  list(): ThemeInfo[];
  getActive(): ThemeInfo | null;
  setActive(id: string | null): boolean;
  onDidChange(callback: (id: string | null) => void): () => void;
}

function toInfo(theme: {
  id: string;
  name: string;
  colorScheme: 'dark' | 'light';
  description?: string;
}): ThemeInfo {
  return {
    id: theme.id,
    name: theme.name,
    colorScheme: theme.colorScheme,
    description: theme.description,
  };
}

export function createThemesApi(): ThemesAPI {
  return {
    list() {
      return themeRegistryStore.getState().themes.map(toInfo);
    },
    getActive() {
      const theme = themeRegistryStore.getState().getActiveTheme();
      return theme ? toInfo(theme) : null;
    },
    setActive(id) {
      return hostSetActiveTheme(id);
    },
    onDidChange(callback) {
      let last = themeRegistryStore.getState().activeThemeId;
      return themeRegistryStore.subscribe(state => {
        if (state.activeThemeId === last) return;
        last = state.activeThemeId;
        callback(state.activeThemeId);
      });
    },
  };
}

import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import './custom.css';
import ProjectBoard from './components/ProjectBoard.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ProjectBoard', ProjectBoard);
  },
} satisfies Theme;

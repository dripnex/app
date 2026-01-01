<script setup lang="ts">
interface ProjectItem {
  id: string;
  title: string;
  status: 'Todo' | 'In Progress' | 'Done';
  url?: string;
  type: 'Issue' | 'DraftIssue' | 'PullRequest';
}

interface ProjectData {
  items: ProjectItem[];
  projectUrl: string;
  lastUpdated: string;
  error?: string;
}

const props = defineProps<{
  data: ProjectData;
}>();

const todoItems = props.data.items.filter((item) => item.status === 'Todo');
const inProgressItems = props.data.items.filter((item) => item.status === 'In Progress');
const doneItems = props.data.items.filter((item) => item.status === 'Done');

const totalItems = props.data.items.length;
const completedItems = doneItems.length;
const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
</script>

<template>
  <div class="project-board">
    <!-- Error State -->
    <div v-if="data.error" class="error-state">
      <p>{{ data.error }}</p>
      <a :href="data.projectUrl" target="_blank" rel="noopener" class="view-button">
        View Project on GitHub →
      </a>
    </div>

    <!-- Loaded State -->
    <template v-else>
      <!-- Progress Bar -->
      <div class="progress-section">
        <div class="progress-header">
          <span class="progress-label">Progress</span>
          <span class="progress-stats">{{ completedItems }} / {{ totalItems }} completed</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
        </div>
        <div class="progress-percent">{{ progressPercent }}%</div>
      </div>

      <!-- Columns -->
      <div class="board-columns">
        <!-- Todo Column -->
        <div class="column">
          <div class="column-header">
            <span class="column-title">Todo</span>
            <span class="column-count">{{ todoItems.length }}</span>
          </div>
          <div class="column-items">
            <div v-for="item in todoItems" :key="item.id" class="item">
              <span class="item-icon">{{ item.type === 'Issue' ? '🔵' : '📝' }}</span>
              <a v-if="item.url" :href="item.url" target="_blank" rel="noopener" class="item-title">
                {{ item.title }}
              </a>
              <span v-else class="item-title">{{ item.title }}</span>
            </div>
            <div v-if="todoItems.length === 0" class="empty-column">No items</div>
          </div>
        </div>

        <!-- In Progress Column -->
        <div class="column">
          <div class="column-header in-progress">
            <span class="column-title">In Progress</span>
            <span class="column-count">{{ inProgressItems.length }}</span>
          </div>
          <div class="column-items">
            <div v-for="item in inProgressItems" :key="item.id" class="item">
              <span class="item-icon">{{ item.type === 'Issue' ? '🟡' : '📝' }}</span>
              <a v-if="item.url" :href="item.url" target="_blank" rel="noopener" class="item-title">
                {{ item.title }}
              </a>
              <span v-else class="item-title">{{ item.title }}</span>
            </div>
            <div v-if="inProgressItems.length === 0" class="empty-column">No items</div>
          </div>
        </div>

        <!-- Done Column -->
        <div class="column">
          <div class="column-header done">
            <span class="column-title">Done</span>
            <span class="column-count">{{ doneItems.length }}</span>
          </div>
          <div class="column-items">
            <div v-for="item in doneItems" :key="item.id" class="item done-item">
              <span class="item-icon">✅</span>
              <a v-if="item.url" :href="item.url" target="_blank" rel="noopener" class="item-title">
                {{ item.title }}
              </a>
              <span v-else class="item-title">{{ item.title }}</span>
            </div>
            <div v-if="doneItems.length === 0" class="empty-column">No items</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="board-footer">
        <span class="last-updated">Updated: {{ formatDate(data.lastUpdated) }}</span>
        <a :href="data.projectUrl" target="_blank" rel="noopener" class="github-link">
          View on GitHub →
        </a>
      </div>
    </template>
  </div>
</template>

<style scoped>
.project-board {
  margin: 24px 0;
}

.error-state {
  text-align: center;
  padding: 48px 24px;
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  border: 1px solid var(--vp-c-border);
}

.error-state p {
  color: var(--vp-c-text-2);
  margin-bottom: 16px;
}

.view-button {
  display: inline-block;
  padding: 10px 20px;
  background: var(--vp-c-brand-1);
  color: white;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 500;
}

.view-button:hover {
  background: var(--vp-c-brand-2);
}

.progress-section {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.progress-label {
  font-weight: 600;
}

.progress-stats {
  color: var(--vp-c-text-2);
  font-size: 0.9em;
}

.progress-bar {
  height: 8px;
  background: var(--vp-c-bg-mute);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--vp-c-brand-1), var(--vp-c-brand-2));
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-percent {
  text-align: right;
  margin-top: 4px;
  font-size: 0.85em;
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.board-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

@media (max-width: 768px) {
  .board-columns {
    grid-template-columns: 1fr;
  }
}

.column {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  overflow: hidden;
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--vp-c-bg-mute);
  border-bottom: 2px solid var(--vp-c-border);
}

.column-header.in-progress {
  border-bottom-color: #eab308;
}

.column-header.done {
  border-bottom-color: #22c55e;
}

.column-title {
  font-weight: 600;
}

.column-count {
  background: var(--vp-c-bg-soft);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.85em;
}

.column-items {
  padding: 12px;
  min-height: 100px;
  max-height: 400px;
  overflow-y: auto;
}

.item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: var(--vp-c-bg);
  border-radius: 8px;
  border: 1px solid var(--vp-c-border);
}

.item:last-child {
  margin-bottom: 0;
}

.item-icon {
  flex-shrink: 0;
}

.item-title {
  color: var(--vp-c-text-1);
  text-decoration: none;
  font-size: 0.9em;
  line-height: 1.4;
}

a.item-title:hover {
  color: var(--vp-c-brand-1);
}

.done-item .item-title {
  color: var(--vp-c-text-2);
}

.empty-column {
  text-align: center;
  color: var(--vp-c-text-3);
  padding: 24px;
  font-size: 0.9em;
}

.board-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-top: 1px solid var(--vp-c-border);
}

.last-updated {
  color: var(--vp-c-text-3);
  font-size: 0.85em;
}

.github-link {
  color: var(--vp-c-brand-1);
  text-decoration: none;
  font-size: 0.9em;
}

.github-link:hover {
  text-decoration: underline;
}
</style>

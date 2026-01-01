/**
 * GitHub Projects Data Loader
 * Fetches project items at build time for the roadmap page
 */

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

const PROJECT_URL = 'https://github.com/users/tomymaritano/projects/8';
const PROJECT_NUMBER = 8;
const USERNAME = 'tomymaritano';

async function fetchProjectItems(): Promise<ProjectData> {
  const token = process.env.VITE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;

  if (!token) {
    return {
      items: [],
      projectUrl: PROJECT_URL,
      lastUpdated: new Date().toISOString(),
      error: 'No GitHub token available. View the project directly on GitHub.',
    };
  }

  const query = `
    query($username: String!, $number: Int!) {
      user(login: $username) {
        projectV2(number: $number) {
          title
          url
          items(first: 100) {
            nodes {
              id
              fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                }
              }
              content {
                ... on Issue {
                  title
                  url
                }
                ... on PullRequest {
                  title
                  url
                }
                ... on DraftIssue {
                  title
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { username: USERNAME, number: PROJECT_NUMBER },
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(data.errors[0]?.message || 'GraphQL error');
    }

    const project = data.data?.user?.projectV2;
    if (!project) {
      throw new Error('Project not found');
    }

    const items: ProjectItem[] = project.items.nodes
      .filter((node: any) => node.content)
      .map((node: any) => {
        const statusField = node.fieldValueByName;
        const status = statusField?.name || 'Todo';

        return {
          id: node.id,
          title: node.content.title,
          status: normalizeStatus(status),
          url: node.content.url,
          type: node.content.url
            ? node.content.url.includes('/pull/')
              ? 'PullRequest'
              : 'Issue'
            : 'DraftIssue',
        };
      });

    return {
      items,
      projectUrl: project.url,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to fetch GitHub Project:', message);

    return {
      items: [],
      projectUrl: PROJECT_URL,
      lastUpdated: new Date().toISOString(),
      error: `Failed to load: ${message}`,
    };
  }
}

function normalizeStatus(status: string): 'Todo' | 'In Progress' | 'Done' {
  const lower = status.toLowerCase();
  if (lower.includes('done') || lower.includes('complete')) return 'Done';
  if (lower.includes('progress') || lower.includes('doing')) return 'In Progress';
  return 'Todo';
}

export default {
  async load(): Promise<ProjectData> {
    return await fetchProjectItems();
  },
};

export declare const data: ProjectData;

const REPO = 'ludanBig/goldview';
const WORKFLOW = 'refresh-data.yml';

export async function dispatchGoldSync(env, request = fetch) {
  const token = env?.GITHUB_DISPATCH_TOKEN;
  if (!token) throw new Error('GITHUB_DISPATCH_TOKEN is not configured');
  const response = await request(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'goldview-cron-scheduler'
      },
      body: JSON.stringify({ ref: 'main' })
    }
  );
  if (response.status !== 204) throw new Error(`GitHub dispatch failed (HTTP ${response.status})`);
  console.log('Goldview data refresh accepted by GitHub');
}

export default {
  async scheduled(_controller, env) {
    await dispatchGoldSync(env);
  }
};

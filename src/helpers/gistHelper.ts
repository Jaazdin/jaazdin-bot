const GITHUB_API_URL = 'https://api.github.com/gists';

type GistOptions = {
  description?: string;
  filename?: string;
};

/**
 * Posts text to GitHub Gist as a secret (unlisted) gist.
 * Returns the gist HTML URL on success, or null if the token is missing / the request fails.
 */
export async function postToGist(content: string, options: GistOptions = {}): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;

  const filename = options.filename ?? 'output.txt';
  const body = JSON.stringify({
    description: options.description ?? '',
    public: false,
    files: { [filename]: { content } },
  });

  try {
    const response = await fetch(GITHUB_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body,
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { html_url?: string };
    return json.html_url ?? null;
  } catch {
    return null;
  }
}

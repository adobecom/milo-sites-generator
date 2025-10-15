import { crawl } from 'https://da.live/nx/public/utils/tree.js';
import DA_SDK from 'https://da.live/nx/utils/sdk.js';

const DA_ORIGIN = 'https://admin.da.live';
const AEM_ORIGIN = 'https://admin.hlx.page';
export const ORG = 'adobecom';
async function getAccessToken() {
  let token;
  try {
    // get token for local development export const tokenStr = "..."
    const {tokenStr} = await import('./local-token.js');
    token = tokenStr;
  } catch (error) {

  }
  if (!token) {
    const sdk = await DA_SDK
    token = sdk.token;
  }

  return token;
}

function getConfig(siteName, githubSettings = {}) {
  const { githubOwner = 'adobecom', githubRepo = 'milo-starter', githubUrl = 'https://github.com/adobecom/milo-starter' } = githubSettings;
  
  return {
    "version": 1,
    "content": {
      "source": {
        "url": `https://content.da.live/${ORG}/${siteName}/`,
        "type": 'markup',
      }
    },
    "code": {
      "owner": githubOwner,
      "repo": githubRepo,
      "source": {
        "type": "github",
        "url": githubUrl
      }
    },
  }
}

async function createConfig(data) {
  const { siteName, githubOwner, githubRepo, githubUrl } = data;
  const githubSettings = { githubOwner, githubRepo, githubUrl };
  const config = getConfig(siteName, githubSettings);
  const token = await getAccessToken();
  const opts = {
    method: 'POST',
    body: JSON.stringify(config),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };
  // TODO Caveat: Might need sign into sidekick first
  const res = await fetch(`${AEM_ORIGIN}/config/${ORG}/sites/${siteName}.json`, opts);
  if (!res.ok) throw new Error(`Failed to create config: ${res.statusText}`);
}

async function replaceTemplate(data) {
  const { siteName } = data;
  const templatePaths = ['/index.html', '/gnav.html', '/footer.html'];

  await Promise.all(templatePaths.map(async (path) => {
    const daPath = `https://admin.da.live/source/${ORG}/${siteName}${path}`;
    const token = await getAccessToken();

    // get index
    const indexRes = await fetch(daPath, { headers: {
      'Authorization': `Bearer ${token}`,
    } });
    if (!indexRes.ok) throw new Error(`Failed to fetch index.html: ${indexRes.statusText}`);

    // replace template values
    const indexText = await indexRes.text();
    const templatedText = indexText
      .replaceAll('{{name-site}}', data.siteName.replaceAll('-', ' '))
      .replaceAll('{{description-site}}', data.siteDescription)
      // .replaceAll('{{principal-name}}', data.principalName)
      // .replaceAll('{{principal-message}}', data.principalMessage);

    const formData = new FormData();
    const blob = new Blob([templatedText], { type: 'text/html' });
    formData.set('data', blob);
    const updateRes = await fetch(daPath, { method: 'POST', body: formData, headers: {
      'Authorization': `Bearer ${token}`,
    } });
    if (!updateRes.ok) {
      throw new Error(`Failed to update index.html: ${updateRes.statusText}`);
    }
  }));
}

async function getPageList(data) {
  const { siteName } = data;
  const parent = `/${ORG}/${siteName}`;
  const pages = [];
  
  const callback = (item) => {
    if (item.path.endsWith('.svg') || item.path.endsWith('.png') || item.path.endsWith('.jpg')) return;
    const pageName = item.path.replace(parent, '').replace('.html', '') || '/';
    pages.push({
      name: pageName,
      path: item.path,
      status: 'pending'
    });
  };

  // Get the library
  crawl({ path: `${parent}/.da`, callback, concurrent: 5, throttle: 250 });
  const { results } = crawl({ path: parent, callback, concurrent: 5, throttle: 250 });
  
  await results;
  return pages;
}

async function previewOrPublishPages(data, action, setStatus, updatePageStatus) {
  const { siteName } = data;
  const parent = `/${ORG}/${siteName}`;
  const pages = await getPageList(data);
  
  const label = action === 'preview' ? 'Previewing' : 'Publishing';
  const token = await getAccessToken();
  const opts = { method: 'POST', headers: {
    'Authorization': `Bearer ${token}`,
  } };

  // Update status to show we're starting
  setStatus({ 
    message: `${label} ${pages.length} pages...`, 
    pages: pages,
    action: action 
  });

  // Process all pages concurrently
  const promises = pages.map(async (page) => {
    try {
      updatePageStatus(page.name, 'processing');
      const aemPath = page.path.replace(parent, `${parent}/main`).replace('.html', '');
      const resp = await fetch(`${AEM_ORIGIN}/${action}${aemPath}`, opts);
      if (!resp.ok) throw new Error(`Could not ${action} ${aemPath}`);
      updatePageStatus(page.name, 'completed');
    } catch (error) {
      updatePageStatus(page.name, 'error');
      throw error;
    }
  });

  await Promise.all(promises);
}

async function copyContent(data) {
  const { siteName } = data;
  const formData = new FormData();
  const destination = `/${ORG}/${siteName}`;
  const token = await getAccessToken();
  formData.set('destination', destination);
  const opts = {  method: 'POST', body: formData, headers: {
    'Authorization': `Bearer ${token}`,
  } };

  // FYI you can't re-clone a site, you have to delete it first.
  // Or create a new site with a different name.
  // if(!sites.includes(destination)) { 
  //  const del = await fetch(`${DA_ORIGIN}/source${destination}`, { method: 'DELETE',
  //    headers: {
  //      'Authorization': `Bearer ${token}`,
  //    }
  //  });
  //}

  const res = await fetch(`${DA_ORIGIN}/copy/${ORG}/milo-starter/`, opts);

  if (!res.ok) throw new Error(`Failed to copy content: ${res.statusText}`);
}

export async function createSite(data, setStatus, updatePageStatus) {
  setStatus({ message: 'Copying content.' });
  await copyContent(data);
  setStatus({ message: 'Templating content.' });
  await replaceTemplate(data);
  setStatus({ message: 'Creating new site.' });
  await createConfig(data);
  setStatus({ message: 'Previewing pages.' });
  await previewOrPublishPages(data, 'preview', setStatus, updatePageStatus);
  setStatus({ message: 'Publishing pages.' });
  await previewOrPublishPages(data, 'live', setStatus, updatePageStatus);
  setStatus({ message: 'Done!' });
}

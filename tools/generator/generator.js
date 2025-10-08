import 'https://da.live/nx/public/sl/components.js';
import getStyle from 'https://da.live/nx/utils/styles.js';
import { LitElement, html, nothing } from 'da-lit';
import { ORG, createSite } from './create-site.js';

console.log('Generator module imports loaded');
const style = await getStyle(import.meta.url);
class Generator extends LitElement {
  static properties = {
    _data: { state: true },
    _loading: { state: true },
    _status: { state: true },
    _time: { state: true },
    _progress: { state: true },
    _currentStep: { state: true },
    _pages: { state: true },
    _showAdvanced: { state: true },
  };

  constructor() {
    super();
    this._time = '~1min for site creation';
    this._pages = [];
    this._showAdvanced = false;
  }

  async connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.adoptedStyleSheets = [style];
  }

  calculateCrawlTime(startTime) {
    const crawlTime = Date.now() - startTime;
    return `${String(crawlTime / 1000).substring(0, 4)}s`;
  }

  toggleAdvanced() {
    this._showAdvanced = !this._showAdvanced;
  }

  async handleSubmit(e) {
    e.preventDefault();
    this._time = null;
    this._loading = true;
    this._progress = 0;
    this._currentStep = 0;
    this._pages = [];
    
    const formData = new FormData(e.target.closest('form'));
    const entries = Object.fromEntries(formData.entries());


    const startTime = Date.now();
    const getTime = setInterval(() => {
      this._time = this.calculateCrawlTime(startTime);
    }, 100);
    
    this._data = {
      ...entries,
      siteName: entries.siteName.replaceAll(/[^a-zA-Z0-9]/g, '-').toLowerCase(),
      githubOwner: entries.githubOwner || 'adobecom',
      githubRepo: entries.githubRepo || 'milo-starter',
      githubUrl: entries.githubUrl || 'https://github.com/adobecom/milo-starter',
    };

    const steps = [
      'Copying content...',
      'Templating content...',
      'Creating new site...',
      'Previewing pages...',
      'Publishing pages...',
      'Finalizing...'
    ];

    const setStatus = (status) => { 
      this._status = status; 
      // Update pages list if provided
      if (status.pages) {
        this._pages = status.pages;
      }
      // Update progress based on status message
      const stepIndex = steps.findIndex(step => status.message.includes(step.split('...')[0]));
      if (stepIndex !== -1) {
        this._currentStep = stepIndex;
        this._progress = ((stepIndex + 1) / steps.length) * 100;
      }
    };

    const updatePageStatus = (pageName, status) => {
      const pageIndex = this._pages.findIndex(page => page.name === pageName);
      if (pageIndex !== -1) {
        this._pages[pageIndex].status = status;
        this._pages = [...this._pages]; // Trigger reactivity
      }
    };

    try {
      await createSite(this._data, setStatus, updatePageStatus);
      this._progress = 100;
      this._currentStep = steps.length - 1;
    } catch (e) {
      this._status = e;
      this._loading = false;
    }

    clearInterval(getTime);
    this._loading = false;
    this._status = { type: 'success', message: `Site created in ${this.calculateCrawlTime(startTime)}.` };
  }

  get _heading() {
    return this._status?.type === 'success' ? 'Next steps' : 'Create your site';
  }

  renderSuccess() {
    return html`
      <div class="success-panel">
        <h2>Edit content</h2>
        <p><a href="https://da.live/edit#/${ORG}/${this._data.siteName}/gnav" target="_blank">Edit main navigation</a></p>
        <p><a href="https://da.live/edit#/${ORG}/${this._data.siteName}/footer" target="_blank">Edit footer</a></p>
        <p><a href="https://da.live/#/${ORG}/${this._data.siteName}" target="_blank">View all content</a></p>
      </div>
      <div class="success-panel">
        <h2>View site</h2>
        <p><a href="https://main--${this._data.siteName}--${ORG}.aem.page" target="_blank">Visit site</a></p>
      </div>
      <p class="status ${this._status.type || 'note'}">${this._status.message}</p>
    `;
  }

  renderProgressBar() {
    if (!this._loading) return nothing;
    
    return html`
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${this._progress}%"></div>
      </div>
    `;
  }

  renderPageList() {
    if (!this._pages.length || !this._loading) return nothing;
    
    const action = this._status?.action || 'processing';
    const completedPages = this._pages.filter(page => page.status === 'completed').length;
    const totalPages = this._pages.length;
    
    return html`
      <div class="page-list-container">
        <div class="page-list-header">
          <h3>${action === 'preview' ? 'Previewing' : 'Publishing'} Pages (${completedPages}/${totalPages})</h3>
        </div>
        <div class="page-list">
          ${this._pages.map(page => html`
            <div class="page-item ${page.status}">
              <div class="page-status-icon">
                ${page.status === 'pending' ? '⏳' : 
                  page.status === 'processing' ? '🔄' : 
                  page.status === 'completed' ? '✅' : 
                  page.status === 'error' ? '❌' : '⏳'}
              </div>
              <div class="page-name">${page.name}</div>
              <div class="page-status">${page.status}</div>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  renderForm() {
    return html`
      <form>
        <h3>Create your website</h3>
        <div class="form-container">
          <div class="fieldgroup">
            <label>
              <div class="field-icon">🌐</div>
              Website name
            </label>
            <sl-input type="text" name="siteName" placeholder="Enter your website name" value=""></sl-input>
          </div>
          <div class="fieldgroup">
            <label>
              <div class="field-icon">📝</div>
              Website description
            </label>
            <sl-textarea name="siteDescription" resize="vertical" placeholder="Describe your website in detail..." value="" rows="4">description</sl-textarea>
          </div>
        </div>
        
        <div class="advanced-settings">
          <button type="button" class="advanced-toggle" @click=${this.toggleAdvanced}>
            <span class="advanced-icon">${this._showAdvanced ? '▼' : '▶'}</span>
            Advanced Settings
          </button>
          
          ${this._showAdvanced ? html`
            <div class="advanced-content">
              <div class="fieldgroup">
                <label>
                  <div class="field-icon">👤</div>
                  GitHub Repository Owner
                </label>
                <sl-input type="text" name="githubOwner" placeholder="adobecom" value="adobecom" help-text="GitHub username or organization"></sl-input>
              </div>
              <div class="fieldgroup">
                <label>
                  <div class="field-icon">📦</div>
                  GitHub Repository Name
                </label>
                <sl-input type="text" name="githubRepo" placeholder="milo-starter" value="milo-starter" help-text="Repository name (e.g., 'milo-starter')"></sl-input>
              </div>
              <div class="fieldgroup">
                <label>
                  <div class="field-icon">🔗</div>
                  GitHub Repository URL. Don't forget to add the <a href="https://github.com/apps/aem-code-sync" target="_blank">AEM Code Sync</a>
                </label>
                <sl-input type="text" name="githubUrl" placeholder="https://github.com/adobecom/milo-starter" value="https://github.com/adobecom/milo-starter" help-text="Full GitHub repository URL"></sl-input>
              </div>
            </div>
          ` : nothing}
        </div>
        <div class="form-footer">
          <div class="time-actions">
            <p>${this._time}</p>
            <sl-button ?disabled=${this._loading} @click=${this.handleSubmit}>
              ${this._loading ? html`<span class="loading-spinner"></span> Creating...` : 'Create site'}
            </sl-button>
          </div>
        </div>
        ${this.renderProgressBar()}
        ${this.renderPageList()}
        ${this._status ? html`<p class="status ${this._status?.type || 'note'}">${this._status?.message}</p>` : nothing}
      </form>
    `
  }

  render() {
    return html`
      ${this._status?.type === 'success' ? this.renderSuccess() : this.renderForm()}
    `;
  }
}

customElements.define('da-generator', Generator);

// config.js
const Config = {
  // GAS Web App URL
  // TODO: Setup手順で取得したURLをここに貼る
  GAS_WEB_APP_URL: localStorage.getItem('config_url') || '',
  API_TOKEN: localStorage.getItem('config_token') || 'fackin_inventory_secret_token',
  USER_NAME: localStorage.getItem('config_user') || '管理者',
  
  save: function(url, token, user) {
    this.GAS_WEB_APP_URL = url;
    this.API_TOKEN = token;
    this.USER_NAME = user;
    localStorage.setItem('config_url', url);
    localStorage.setItem('config_token', token);
    localStorage.setItem('config_user', user);
  }
};

const State = {
  items: [],
  categories: [],
  locations: [],
  filters: {
    search: '',
    category: '',
    location: '',
    thresholdOnly: false
  },
  
  setItems: function(data) {
    this.items = data || [];
  },
  setMaster: function(data) {
    this.categories = data?.categories || [];
    this.locations = data?.locations || [];
  },
  
  getFilteredItems: function() {
    return this.items.filter(item => {
      // Status Check
      if (item.status === 'archived') return false;
      
      // Threshold Check
      if (this.filters.thresholdOnly) {
        if (!item.threshold || Number(item.qty) > Number(item.threshold)) {
          return false;
        }
      }
      
      // Category & Location Check
      if (this.filters.category && item.category !== this.filters.category) return false;
      if (this.filters.location && item.location !== this.filters.location) return false;
      
      // Search Check (Name, Notes etc)
      if (this.filters.search) {
        const q = this.filters.search.toLowerCase();
        const n = (item.name || '').toLowerCase();
        const c = (item.category || '').toLowerCase();
        const l = (item.location || '').toLowerCase();
        if (!n.includes(q) && !c.includes(q) && !l.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }
};

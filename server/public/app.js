// Plant Editor App - v3 with Retries & Custom Prompt
class PlantEditor {
  constructor() {
    this.uploadedFile = null;
    this.uploadedPath = null;
    this.marks = [];
    this.plants = [];
    this.currentMarkIndex = null;
    this.selectedPlant = null;
    this.imageSize = { width: 0, height: 0 };
    this.originalImageUrl = null;
    this.defaultPrompt = '';
    
    this.init();
  }

  async init() {
    this.bindElements();
    this.bindEvents();
    await this.loadPlants();
    await this.loadDefaultPrompt();
  }

  bindElements() {
    // Mode selection
    this.stepChoose = document.getElementById('step-choose');
    this.stepCollections = document.getElementById('step-collections');
    this.modeCollections = document.getElementById('mode-collections');
    this.modeUpload = document.getElementById('mode-upload');
    this.collectionsGrid = document.getElementById('collections-grid');
    this.backToChoose = document.getElementById('back-to-choose');
    this.backToChooseUpload = document.getElementById('back-to-choose-upload');

    // Upload
    this.uploadZone = document.getElementById('upload-zone');
    this.fileInput = document.getElementById('file-input');
    this.uploadedPreview = document.getElementById('uploaded-preview');
    this.previewImage = document.getElementById('preview-image');
    this.changeImageBtn = document.getElementById('change-image');

    // Steps
    this.stepUpload = document.getElementById('step-upload');
    this.stepMark = document.getElementById('step-mark');
    this.stepSettings = document.getElementById('step-settings');
    this.stepRun = document.getElementById('step-run');
    this.stepResults = document.getElementById('step-results');

    // Mark canvas
    this.canvas = document.getElementById('mark-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.marksContainer = document.getElementById('marks-container');
    this.clearMarksBtn = document.getElementById('clear-marks');

    // Modal
    this.markModal = document.getElementById('mark-modal');
    this.markOriginal = document.getElementById('mark-original');
    this.markPotColor = document.getElementById('mark-pot-color');
    this.markSize = document.getElementById('mark-size');
    this.markSizeValue = document.getElementById('mark-size-value');
    this.selectReplacementBtn = document.getElementById('select-replacement');
    this.selectedReplacementSpan = document.getElementById('selected-replacement');
    this.cancelMarkBtn = document.getElementById('cancel-mark');
    this.saveMarkBtn = document.getElementById('save-mark');

    // Prompt editor
    this.customPrompt = document.getElementById('custom-prompt');
    this.resetPromptBtn = document.getElementById('reset-prompt');

    // Run
    this.runBtn = document.getElementById('run-btn');
    this.stopBtn = document.getElementById('stop-btn');
    this.progressContainer = document.getElementById('progress-container');
    this.currentJobId = null;
    this.progressFill = document.getElementById('progress-fill');
    this.progressText = document.getElementById('progress-text');
    this.logs = document.getElementById('logs');

    // Results
    this.resultsGrid = document.getElementById('results-grid');
    this.comparisonGrid = document.getElementById('comparison-grid');
    this.downloadAllBtn = document.getElementById('download-all');
    this.startOverBtn = document.getElementById('start-over');

    // Plant library
    this.plantLibrary = document.getElementById('plant-library');
    this.plantsGrid = document.getElementById('plants-grid');
    this.plantSearch = document.getElementById('plant-search');
    this.closeLibraryBtn = document.getElementById('close-library');
  }

  bindEvents() {
    // Mode selection events
    this.modeCollections.addEventListener('click', () => this.showCollections());
    this.modeUpload.addEventListener('click', () => this.showUpload());
    this.backToChoose.addEventListener('click', () => this.showChoose());
    this.backToChooseUpload.addEventListener('click', () => this.showChoose());

    // Collection editor events
    this.editCollectionsBtn = document.getElementById('edit-collections-btn');
    this.collectionEditorModal = document.getElementById('collection-editor-modal');
    this.closeCollectionEditor = document.getElementById('close-collection-editor');
    this.editorCollectionList = document.getElementById('editor-collection-list');
    this.editorImagesPanel = document.getElementById('editor-images-panel');
    this.saveCollectionOrder = document.getElementById('save-collection-order');
    
    this.editCollectionsBtn.addEventListener('click', () => this.openCollectionEditor());
    this.closeCollectionEditor.addEventListener('click', () => this.closeCollectionEditorModal());
    this.saveCollectionOrder.addEventListener('click', () => this.saveCollectionChanges());
    
    this.currentEditingCollection = null;
    this.collectionsConfig = {};

    // Upload events
    this.uploadZone.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    this.uploadZone.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.uploadZone.addEventListener('dragleave', () => this.uploadZone.classList.remove('dragover'));
    this.uploadZone.addEventListener('drop', (e) => this.handleDrop(e));
    this.changeImageBtn.addEventListener('click', () => this.resetUpload());

    // Canvas events
    this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

    // Modal events
    this.markSize.addEventListener('input', (e) => {
      this.markSizeValue.textContent = e.target.value + 'px';
      if (this.currentMarkIndex !== null) {
        this.marks[this.currentMarkIndex].rx = parseInt(e.target.value);
        this.marks[this.currentMarkIndex].ry = parseInt(e.target.value) * 1.25;
        this.redrawCanvas();
      }
    });
    this.selectReplacementBtn.addEventListener('click', () => this.openPlantLibrary());
    this.cancelMarkBtn.addEventListener('click', () => this.closeMarkModal(true));
    this.saveMarkBtn.addEventListener('click', () => this.saveMark());

    // Plant library events
    this.closeLibraryBtn.addEventListener('click', () => this.closePlantLibrary());
    this.plantSearch.addEventListener('input', (e) => this.filterPlants(e.target.value));

    // Prompt
    this.resetPromptBtn.addEventListener('click', () => this.resetPrompt());

    // Marks
    this.clearMarksBtn.addEventListener('click', () => this.clearMarks());

    // Run
    this.runBtn.addEventListener('click', () => this.startReplacement());
    this.stopBtn.addEventListener('click', () => this.stopJob());

    // Results
    this.startOverBtn.addEventListener('click', () => this.resetAll());
    this.downloadAllBtn.addEventListener('click', () => this.downloadAll());
  }

  // Mode selection methods
  showChoose() {
    this.stepChoose.hidden = false;
    this.stepCollections.hidden = true;
    this.stepUpload.hidden = true;
    this.stepMark.hidden = true;
    this.stepSettings.hidden = true;
    this.stepRun.hidden = true;
    this.stepResults.hidden = true;
  }

  async showCollections() {
    this.stepChoose.hidden = true;
    this.stepCollections.hidden = false;
    await this.loadCollections();
  }

  showUpload() {
    this.stepChoose.hidden = true;
    this.stepUpload.hidden = false;
  }

  async loadCollections() {
    try {
      const response = await fetch('/api/collections');
      const collections = await response.json();
      this.renderCollections(collections);
    } catch (error) {
      console.error('Failed to load collections:', error);
      this.collectionsGrid.innerHTML = '<p style="color: var(--text-secondary);">No collections found</p>';
    }
  }

  renderCollections(collections) {
    if (!collections || collections.length === 0) {
      this.collectionsGrid.innerHTML = '<p style="color: var(--text-secondary);">No collections available</p>';
      return;
    }

    this.collectionsGrid.innerHTML = collections.map(col => `
      <div class="collection-card" data-id="${col.id}">
        <img src="${col.thumbnail || col.images?.[0]?.url || '/uploads/collections/placeholder.jpg'}" alt="${col.name}" loading="lazy">
        <div class="collection-name">${col.name}</div>
        <div class="collection-count">${col.images?.length || 0} images</div>
      </div>
    `).join('');

    // Bind click events
    this.collectionsGrid.querySelectorAll('.collection-card').forEach(card => {
      card.addEventListener('click', () => this.selectCollection(card.dataset.id));
    });
  }

  async selectCollection(collectionId) {
    try {
      const response = await fetch(`/api/collections/${collectionId}`);
      const collection = await response.json();
      
      if (collection.images && collection.images.length > 0) {
        // Use the main image or the first image
        const mainImage = collection.images.find(img => img.is_main) || collection.images[0];
        const imageUrl = mainImage.url || mainImage.image_url;
        
        // Load this image into the editor
        this.loadCollectionImage(imageUrl, collection.name);
      }
    } catch (error) {
      console.error('Failed to load collection:', error);
      alert('Failed to load collection');
    }
  }

  async loadCollectionImage(imageUrl, collectionName) {
    try {
      // Extract filename from URL - no need to re-upload, image already exists!
      const filename = imageUrl.split('/').pop() || 'collection-image.jpg';
      
      this.uploadedPath = filename;
      this.originalImageUrl = imageUrl;
      
      // Show preview
      this.previewImage.src = imageUrl;
      this.uploadedPreview.hidden = false;
      this.uploadZone.hidden = true;
      
      // Move to step upload (which shows the preview), then to marking
      this.stepCollections.hidden = true;
      this.stepUpload.hidden = false;
      
      // Wait for image to load then proceed
      this.previewImage.onload = () => {
        this.initCanvas();
        this.stepMark.hidden = false;
        this.stepSettings.hidden = false;
        this.stepRun.hidden = false;
      };
    } catch (error) {
      console.error('Failed to load collection image:', error);
      alert('Failed to load image from collection');
    }
  }

  // Collection Editor Methods
  async openCollectionEditor() {
    this.collectionEditorModal.hidden = false;
    
    // Load config
    try {
      const response = await fetch('/api/collections/config');
      this.collectionsConfig = await response.json();
    } catch (e) {
      this.collectionsConfig = {};
    }
    
    // Load collections list
    const response = await fetch('/api/collections');
    const collections = await response.json();
    
    this.editorCollectionList.innerHTML = collections.map(col => `
      <div class="collection-list-item" data-id="${col.id}">${col.name}</div>
    `).join('');
    
    this.editorCollectionList.querySelectorAll('.collection-list-item').forEach(item => {
      item.addEventListener('click', () => this.selectCollectionForEdit(item.dataset.id, collections));
    });
    
    this.allCollections = collections;
    this.editorImagesPanel.innerHTML = '<p class="editor-hint">← Select a collection to edit</p>';
  }

  closeCollectionEditorModal() {
    this.collectionEditorModal.hidden = true;
    this.currentEditingCollection = null;
  }

  selectCollectionForEdit(collectionId, collections) {
    // Update active state
    this.editorCollectionList.querySelectorAll('.collection-list-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === collectionId);
    });
    
    this.currentEditingCollection = collectionId;
    const collection = collections.find(c => c.id === collectionId);
    
    if (!collection) return;
    
    // Get saved config or use default
    const config = this.collectionsConfig[collectionId] || {
      order: collection.images.map(img => img.filename),
      main: collection.images[0]?.filename
    };
    
    // Sort images by saved order
    const orderedImages = [...collection.images].sort((a, b) => {
      const aIdx = config.order.indexOf(a.filename);
      const bIdx = config.order.indexOf(b.filename);
      return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });
    
    this.renderEditorImages(orderedImages, config.main);
  }

  renderEditorImages(images, mainFilename) {
    this.editorImagesPanel.innerHTML = `
      <div class="editor-image-list" id="editor-image-list">
        ${images.map((img, idx) => `
          <div class="editor-image-item ${img.filename === mainFilename ? 'is-main' : ''}" data-filename="${img.filename}">
            <img src="${img.url}" alt="">
            <div class="editor-image-info">
              <div class="editor-image-name">${img.filename}</div>
              ${img.filename === mainFilename ? '<span class="editor-image-badge">MAIN</span>' : ''}
            </div>
            <div class="editor-image-actions">
              <button onclick="app.moveImage('${img.filename}', -1)" ${idx === 0 ? 'disabled' : ''}>↑</button>
              <button onclick="app.moveImage('${img.filename}', 1)" ${idx === images.length - 1 ? 'disabled' : ''}>↓</button>
              <button onclick="app.setMainImage('${img.filename}')" class="${img.filename === mainFilename ? 'btn-main' : ''}">★</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  moveImage(filename, direction) {
    const list = this.editorImagesPanel.querySelector('.editor-image-list');
    const items = Array.from(list.querySelectorAll('.editor-image-item'));
    const idx = items.findIndex(item => item.dataset.filename === filename);
    
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= items.length) return;
    
    // Swap in DOM
    const item = items[idx];
    const sibling = items[newIdx];
    
    if (direction === -1) {
      list.insertBefore(item, sibling);
    } else {
      list.insertBefore(sibling, item);
    }
    
    // Update config
    this.updateCurrentConfig();
  }

  setMainImage(filename) {
    if (!this.currentEditingCollection) return;
    
    // Update config
    if (!this.collectionsConfig[this.currentEditingCollection]) {
      this.collectionsConfig[this.currentEditingCollection] = { order: [], main: null };
    }
    this.collectionsConfig[this.currentEditingCollection].main = filename;
    
    // Update UI
    this.editorImagesPanel.querySelectorAll('.editor-image-item').forEach(item => {
      const isMain = item.dataset.filename === filename;
      item.classList.toggle('is-main', isMain);
      
      const badge = item.querySelector('.editor-image-badge');
      const starBtn = item.querySelector('.editor-image-actions button:last-child');
      
      if (isMain && !badge) {
        item.querySelector('.editor-image-info').insertAdjacentHTML('beforeend', '<span class="editor-image-badge">MAIN</span>');
      } else if (!isMain && badge) {
        badge.remove();
      }
      
      starBtn.classList.toggle('btn-main', isMain);
    });
  }

  updateCurrentConfig() {
    if (!this.currentEditingCollection) return;
    
    const items = this.editorImagesPanel.querySelectorAll('.editor-image-item');
    const order = Array.from(items).map(item => item.dataset.filename);
    
    if (!this.collectionsConfig[this.currentEditingCollection]) {
      this.collectionsConfig[this.currentEditingCollection] = { order: [], main: null };
    }
    this.collectionsConfig[this.currentEditingCollection].order = order;
  }

  async saveCollectionChanges() {
    // Update order for current collection
    this.updateCurrentConfig();
    
    try {
      const response = await fetch('/api/collections/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.collectionsConfig)
      });
      
      if (response.ok) {
        alert('✅ Changes saved!');
        this.closeCollectionEditorModal();
        // Refresh collections view
        await this.loadCollections();
      } else {
        alert('❌ Failed to save');
      }
    } catch (error) {
      console.error('Failed to save:', error);
      alert('❌ Failed to save: ' + error.message);
    }
  }

  async loadDefaultPrompt() {
    try {
      const response = await fetch('/api/prompt');
      const data = await response.json();
      this.defaultPrompt = data.prompt;
      this.customPrompt.value = data.prompt;
    } catch (error) {
      console.error('Failed to load default prompt:', error);
      this.defaultPrompt = 'Replace the plant in the red area with {{PLANT_NAME}}. Keep the {{POT_COLOR}} pot unchanged.';
      this.customPrompt.value = this.defaultPrompt;
    }
  }

  resetPrompt() {
    this.customPrompt.value = this.defaultPrompt;
  }

  async loadPlants() {
    try {
      const response = await fetch('/api/plants');
      this.plants = await response.json();
      this.renderPlants();
      console.log('Loaded', this.plants.length, 'plants');
    } catch (error) {
      console.error('Failed to load plants:', error);
    }
  }

  renderPlants(filter = '') {
    const filtered = this.plants.filter(p => 
      p.name.toLowerCase().includes(filter.toLowerCase())
    );
    
    this.plantsGrid.innerHTML = filtered.map(plant => `
      <div class="plant-card" data-id="${plant.id}" data-name="${plant.name}" data-file="${plant.id}.jpg">
        <img src="${plant.image}" alt="${plant.name}" loading="lazy">
        <div class="plant-card-name">${plant.name}</div>
      </div>
    `).join('');

    // Bind click events
    this.plantsGrid.querySelectorAll('.plant-card').forEach(card => {
      card.addEventListener('click', () => this.selectPlant(card));
    });
  }

  filterPlants(query) {
    this.renderPlants(query);
  }

  selectPlant(card) {
    this.plantsGrid.querySelectorAll('.plant-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    this.selectedPlant = {
      id: card.dataset.id,
      name: card.dataset.name,
      file: card.dataset.file
    };
    this.selectedReplacementSpan.textContent = '✅ ' + this.selectedPlant.name;
    this.closePlantLibrary();
  }

  // File handling
  handleDragOver(e) {
    e.preventDefault();
    this.uploadZone.classList.add('dragover');
  }

  handleDrop(e) {
    e.preventDefault();
    this.uploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      this.uploadFile(file);
    }
  }

  handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      this.uploadFile(file);
    }
  }

  async uploadFile(file) {
    const formData = new FormData();
    formData.append('image', file);

    try {
      this.uploadZone.innerHTML = '<div class="upload-icon">⏳</div><p>Uploading...</p>';
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      
      if (data.success) {
        this.uploadedFile = data.filename;
        this.uploadedPath = data.path;
        this.originalImageUrl = data.path;
        this.showPreview(data.path);
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
        this.resetUploadZone();
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
      this.resetUploadZone();
    }
  }

  resetUploadZone() {
    this.uploadZone.innerHTML = `
      <div class="upload-icon">📁</div>
      <p>Drag image here or <span class="upload-link">click to browse</span></p>
    `;
  }

  showPreview(imagePath) {
    this.previewImage.src = imagePath;
    this.uploadZone.hidden = true;
    this.uploadedPreview.hidden = false;

    // Wait for image to load, then show canvas
    this.previewImage.onload = () => {
      this.imageSize = {
        width: this.previewImage.naturalWidth,
        height: this.previewImage.naturalHeight
      };
      this.stepMark.hidden = false;
      this.stepSettings.hidden = false;
      this.stepRun.hidden = false;
      this.setupCanvas(imagePath);
    };
  }

  setupCanvas(imagePath) {
    const img = new Image();
    img.onload = () => {
      const maxWidth = 900;
      const scale = Math.min(1, maxWidth / img.width);
      this.canvas.width = img.width * scale;
      this.canvas.height = img.height * scale;
      this.canvasScale = scale;
      this.canvasImage = img;
      this.redrawCanvas();
    };
    img.src = imagePath;
  }

  redrawCanvas() {
    this.ctx.drawImage(this.canvasImage, 0, 0, this.canvas.width, this.canvas.height);
    
    // Draw marks
    this.marks.forEach((mark, index) => {
      const x = mark.x * this.canvasScale;
      const y = mark.y * this.canvasScale;
      const rx = mark.rx * this.canvasScale;
      const ry = mark.ry * this.canvasScale;

      // Outer glow
      this.ctx.beginPath();
      this.ctx.ellipse(x, y, rx + 4, ry + 4, 0, 0, 2 * Math.PI);
      this.ctx.fillStyle = 'rgba(74, 222, 128, 0.2)';
      this.ctx.fill();

      // Main ellipse
      this.ctx.beginPath();
      this.ctx.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
      this.ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();

      // Number badge
      this.ctx.beginPath();
      this.ctx.arc(x, y, 16, 0, 2 * Math.PI);
      this.ctx.fillStyle = '#4ade80';
      this.ctx.fill();
      
      this.ctx.fillStyle = '#0f172a';
      this.ctx.font = 'bold 14px Inter';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(index + 1, x, y);
    });
  }

  handleCanvasClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.canvasScale;
    const y = (e.clientY - rect.top) / this.canvasScale;

    this.currentMarkIndex = this.marks.length;
    this.marks.push({
      x, y,
      rx: 80,
      ry: 100,
      original: '',
      replacement: null,
      potColor: ''
    });

    // Reset modal
    this.selectedPlant = null;
    this.selectedReplacementSpan.textContent = 'Not selected';
    this.markOriginal.value = '';
    this.markPotColor.value = '';
    this.markSize.value = 80;
    this.markSizeValue.textContent = '80px';

    this.redrawCanvas();
    this.openMarkModal();
  }

  openMarkModal() {
    this.markModal.hidden = false;
  }

  closeMarkModal(cancelled = false) {
    this.markModal.hidden = true;
    
    // If cancelled and no plant selected, remove the mark
    if (cancelled && this.currentMarkIndex !== null) {
      if (!this.marks[this.currentMarkIndex].replacement) {
        this.marks.pop();
      }
    }
    
    this.currentMarkIndex = null;
    this.redrawCanvas();
    this.renderMarksList();
  }

  saveMark() {
    if (this.currentMarkIndex === null) return;

    if (!this.selectedPlant) {
      alert('Please select a replacement plant from the library');
      return;
    }

    const mark = this.marks[this.currentMarkIndex];
    mark.original = this.markOriginal.value || `Plant ${this.currentMarkIndex + 1}`;
    mark.replacement = this.selectedPlant;
    mark.potColor = this.markPotColor.value || 'ceramic';
    mark.rx = parseInt(this.markSize.value);
    mark.ry = parseInt(this.markSize.value) * 1.25;

    this.closeMarkModal();
  }

  openPlantLibrary() {
    this.plantLibrary.classList.add('open');
  }

  closePlantLibrary() {
    this.plantLibrary.classList.remove('open');
  }

  renderMarksList() {
    if (this.marks.length === 0) {
      this.marksContainer.innerHTML = `
        <div class="empty-state">
          <div class="icon">👆</div>
          <p>Click on plants in the image to add them</p>
        </div>
      `;
      return;
    }

    this.marksContainer.innerHTML = this.marks.map((mark, index) => `
      <div class="mark-item">
        <div class="mark-info">
          <div class="mark-name">${index + 1}. ${mark.original || 'Plant ' + (index + 1)}</div>
          <div class="mark-replacement">→ ${mark.replacement ? mark.replacement.name : '⚠️ Not selected'}</div>
        </div>
        <div class="mark-actions">
          <button onclick="app.editMark(${index})" title="Edit">✏️</button>
          <button onclick="app.deleteMark(${index})" title="Delete">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  editMark(index) {
    this.currentMarkIndex = index;
    const mark = this.marks[index];
    this.markOriginal.value = mark.original;
    this.markPotColor.value = mark.potColor;
    this.markSize.value = mark.rx;
    this.markSizeValue.textContent = mark.rx + 'px';
    this.selectedPlant = mark.replacement;
    this.selectedReplacementSpan.textContent = mark.replacement ? '✅ ' + mark.replacement.name : 'Not selected';
    this.openMarkModal();
  }

  deleteMark(index) {
    this.marks.splice(index, 1);
    this.redrawCanvas();
    this.renderMarksList();
  }

  clearMarks() {
    if (this.marks.length > 0 && !confirm('Clear all marked plants?')) return;
    this.marks = [];
    this.redrawCanvas();
    this.renderMarksList();
  }

  resetUpload() {
    this.uploadedFile = null;
    this.uploadedPath = null;
    this.uploadZone.hidden = false;
    this.uploadedPreview.hidden = true;
    this.stepMark.hidden = true;
    this.stepSettings.hidden = true;
    this.stepRun.hidden = true;
    this.stepResults.hidden = true;
    this.marks = [];
    this.resetUploadZone();
    this.renderMarksList();
  }

  // Run replacement
  async startReplacement() {
    if (!this.uploadedFile) {
      alert('Please upload an image first');
      return;
    }
    
    if (this.marks.length === 0) {
      alert('Please mark at least one plant to replace');
      return;
    }

    // Check all marks have replacements
    const incomplete = this.marks.find(m => !m.replacement);
    if (incomplete) {
      alert('Please select a replacement plant for all marked plants');
      return;
    }

    const edits = this.marks.map(mark => ({
      original: mark.original,
      replacement: mark.replacement.name,
      plantFile: mark.replacement.file,
      foliageMask: {
        cx: mark.x / this.imageSize.width,
        cy: mark.y / this.imageSize.height,
        rx: mark.rx / this.imageSize.width,
        ry: mark.ry / this.imageSize.height
      },
      potRegion: {
        x: (mark.x - mark.rx) / this.imageSize.width,
        y: (mark.y + mark.ry * 0.3) / this.imageSize.height,
        w: (mark.rx * 2) / this.imageSize.width,
        h: (mark.ry * 0.6) / this.imageSize.height
      },
      potColor: mark.potColor
    }));

    this.runBtn.disabled = true;
    this.runBtn.hidden = true;
    this.stopBtn.hidden = false;
    this.progressContainer.hidden = false;
    this.logs.innerHTML = '';

    try {
      const response = await fetch('/api/replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageFile: this.uploadedFile,
          edits,
          customPrompt: this.customPrompt.value
        })
      });
      const data = await response.json();
      
      if (data.jobId) {
        this.currentJobId = data.jobId;
        this.pollJobStatus(data.jobId);
      } else {
        throw new Error(data.error || 'Failed to start job');
      }
    } catch (error) {
      console.error('Failed to start job:', error);
      alert('Failed to start: ' + error.message);
      this.resetRunButtons();
    }
  }

  async pollJobStatus(jobId) {
    const poll = async () => {
      try {
        const response = await fetch(`/api/job/${jobId}`);
        const job = await response.json();

        this.progressFill.style.width = job.progress + '%';
        const attemptInfo = job.currentAttempt ? ` (attempt ${job.currentAttempt})` : '';
        this.progressText.textContent = `Step ${job.currentStep}/${job.totalSteps}${attemptInfo} - ${job.progress}%`;

        // Update logs
        if (job.logs && job.logs.length > 0) {
          this.logs.innerHTML = job.logs.map(log => 
            `<div class="log-entry"><span class="log-time">${new Date(log.time).toLocaleTimeString()}</span> ${log.msg}</div>`
          ).join('');
          this.logs.scrollTop = this.logs.scrollHeight;
        }

        // Show live versions in real-time
        if (job.liveVersions && job.liveVersions.length > 0) {
          this.showLiveVersions(job.liveVersions, job.pendingSelection);
        }

        if (job.status === 'completed') {
          this.showResults(job);
          this.resetRunButtons();
        } else if (job.status === 'cancelled') {
          this.logs.innerHTML += '<div class="log-entry"><span class="log-time">' + new Date().toLocaleTimeString() + '</span> 🛑 Job stopped by user</div>';
          this.resetRunButtons();
        } else if (job.status === 'error') {
          alert('Error: ' + job.error);
          this.resetRunButtons();
        } else {
          setTimeout(poll, 1000);
        }
      } catch (error) {
        console.error('Poll error:', error);
        setTimeout(poll, 2000);
      }
    };
    poll();
  }

  showLiveVersions(versions, pendingSelection) {
    // Show results section if hidden
    this.stepResults.hidden = false;
    
    let html = `<div class="live-versions-header">
      <h4>🔄 Live Results - Step ${versions[0]?.step || '?'}: ${versions[0]?.edit?.original || ''} → ${versions[0]?.edit?.replacement || ''}</h4>
      ${pendingSelection ? '<p class="pending-msg">⏸️ No version passed verification. Select one to use or wait to skip.</p>' : ''}
    </div>`;
    
    html += '<div class="live-versions-grid">';
    versions.forEach(v => {
      const statusClass = v.passed ? 'passed' : 'failed';
      const statusIcon = v.passed ? '✅' : '❌';
      html += `
        <div class="live-version-card ${statusClass}" data-version="${v.version}">
          <div class="card-wiper" data-before="${this.originalImageUrl}" data-after="${v.path}">
            <img src="${v.path}" alt="After" class="wiper-after-img">
            <div class="wiper-before-wrap">
              <img src="${this.originalImageUrl}" alt="Before">
            </div>
            <div class="card-wiper-handle"></div>
            <div class="wiper-labels-small">
              <span>◀ Original</span>
              <span>Result ▶</span>
            </div>
          </div>
          <div class="version-info">
            <span class="version-label">v${v.version} ${statusIcon}</span>
            <span class="version-score">${(v.similarity * 100).toFixed(1)}%</span>
          </div>
          <button class="btn btn-small btn-select" onclick="app.selectVersion('${v.version}')">
            👆 Use This
          </button>
        </div>
      `;
    });
    html += '</div>';
    
    this.resultsGrid.innerHTML = html;
    
    // Initialize wipers for each card
    this.initCardWipers();
  }

  initCardWipers() {
    document.querySelectorAll('.card-wiper').forEach(container => {
      const handle = container.querySelector('.card-wiper-handle');
      const beforeWrap = container.querySelector('.wiper-before-wrap');
      
      let currentPos = 0.5;
      let targetPos = 0.5;
      let animationId = null;
      let isHovering = false;

      // Smooth animation loop
      const animate = () => {
        const diff = targetPos - currentPos;
        if (Math.abs(diff) > 0.001) {
          currentPos += diff * 0.2; // Smooth easing
          beforeWrap.style.width = (currentPos * 100) + '%';
          handle.style.left = (currentPos * 100) + '%';
          animationId = requestAnimationFrame(animate);
        } else {
          currentPos = targetPos;
          beforeWrap.style.width = (currentPos * 100) + '%';
          handle.style.left = (currentPos * 100) + '%';
          animationId = null;
        }
      };

      const updatePosition = (x) => {
        const rect = container.getBoundingClientRect();
        targetPos = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
        if (!animationId) {
          animationId = requestAnimationFrame(animate);
        }
      };

      // Just hover - no click needed!
      container.addEventListener('mouseenter', () => {
        isHovering = true;
      });

      container.addEventListener('mousemove', (e) => {
        if (isHovering) {
          updatePosition(e.clientX);
        }
      });

      container.addEventListener('mouseleave', () => {
        isHovering = false;
        // Smoothly return to center
        targetPos = 0.5;
        if (!animationId) {
          animationId = requestAnimationFrame(animate);
        }
      });

      // Touch support
      container.addEventListener('touchmove', (e) => {
        if (e.touches[0]) {
          updatePosition(e.touches[0].clientX);
          e.preventDefault();
        }
      }, { passive: false });
    });
  }

  async selectVersion(versionId) {
    if (!this.currentJobId) return;
    
    try {
      const response = await fetch(`/api/job/${this.currentJobId}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId })
      });
      const data = await response.json();
      if (data.success) {
        // Highlight selected
        document.querySelectorAll('.live-version-card').forEach(c => c.classList.remove('selected'));
        document.querySelector(`.live-version-card[data-version="${versionId}"]`)?.classList.add('selected');
      }
    } catch (error) {
      console.error('Failed to select version:', error);
    }
  }

  showResults(job) {
    this.stepResults.hidden = false;
    
    // Build version cards
    let cardsHtml = '';
    
    if (job.results) {
      job.results.forEach((result, editIndex) => {
        if (result.versions) {
          // Show all versions (including failed attempts)
          result.versions.forEach((version, vIndex) => {
            cardsHtml += `
              <div class="result-card ${result.failed ? 'failed' : ''}" data-version-path="${version.path}">
                <img src="${version.path}" alt="Version ${version.version}">
                <div class="result-info">
                  <div class="result-title">${result.edit.original} → ${result.edit.replacement}</div>
                  <div class="result-meta">
                    <span>v${version.version} ${result.finalVersion?.version === version.version ? '⭐' : ''}</span>
                    <span class="result-score ${version.passed ? 'passed' : 'failed'}">
                      ${version.similarity ? (version.similarity * 100).toFixed(1) + '%' : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            `;
          });
        }
      });
    }

    this.resultsGrid.innerHTML = cardsHtml || '<p>No results generated</p>';

    // Build comparison wipers
    this.buildComparisonWipers(job);
    
    this.runBtn.disabled = false;
    
    // Scroll to results
    this.stepResults.scrollIntoView({ behavior: 'smooth' });
  }

  buildComparisonWipers(job) {
    if (!job.results || job.results.length === 0 || !job.finalImage) {
      this.comparisonGrid.innerHTML = '<p>No comparisons available</p>';
      return;
    }

    // Main comparison: Original vs Final
    let wipersHtml = `
      <div class="comparison-item">
        <h4>Original → Final Result</h4>
        <div class="wiper-container" id="wiper-main" 
             data-before="${job.originalImage}" 
             data-after="${job.finalImage}">
          <img src="${job.finalImage}" alt="After" class="wiper-after">
          <div class="wiper-before">
            <img src="${job.originalImage}" alt="Before">
          </div>
          <div class="wiper-handle"></div>
        </div>
        <div class="wiper-labels">
          <span>◀ Original</span>
          <span>Final ▶</span>
        </div>
      </div>
    `;

    this.comparisonGrid.innerHTML = wipersHtml;
    
    // Initialize wiper interactions
    this.initWipers();
  }

  initWipers() {
    document.querySelectorAll('.wiper-container').forEach(container => {
      const handle = container.querySelector('.wiper-handle');
      const before = container.querySelector('.wiper-before');
      
      let isDragging = false;

      const updatePosition = (x) => {
        const rect = container.getBoundingClientRect();
        let pos = (x - rect.left) / rect.width;
        pos = Math.max(0, Math.min(1, pos));
        
        before.style.width = (pos * 100) + '%';
        handle.style.left = (pos * 100) + '%';
      };

      container.addEventListener('mousedown', (e) => {
        isDragging = true;
        updatePosition(e.clientX);
      });

      document.addEventListener('mousemove', (e) => {
        if (isDragging) {
          updatePosition(e.clientX);
        }
      });

      document.addEventListener('mouseup', () => {
        isDragging = false;
      });

      // Touch support
      container.addEventListener('touchstart', (e) => {
        isDragging = true;
        updatePosition(e.touches[0].clientX);
      });

      container.addEventListener('touchmove', (e) => {
        if (isDragging) {
          updatePosition(e.touches[0].clientX);
          e.preventDefault();
        }
      });

      container.addEventListener('touchend', () => {
        isDragging = false;
      });
    });
  }

  async stopJob() {
    if (!this.currentJobId) return;
    
    try {
      const response = await fetch(`/api/job/${this.currentJobId}/cancel`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        console.log('Job cancelled');
      }
    } catch (error) {
      console.error('Failed to stop job:', error);
    }
  }

  resetRunButtons() {
    this.runBtn.disabled = false;
    this.runBtn.hidden = false;
    this.stopBtn.hidden = true;
    this.currentJobId = null;
  }

  async downloadAll() {
    alert('Download feature coming soon! For now, right-click images to save.');
  }

  resetAll() {
    if (!confirm('Start over with a new image?')) return;
    location.reload();
  }
}

// Initialize app
const app = new PlantEditor();

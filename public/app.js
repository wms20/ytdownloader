document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('download-form');
  const urlInput = document.getElementById('url-input');
  const clearBtn = document.getElementById('clear-btn');
  const pasteBtn = document.getElementById('paste-btn');
  const submitBtn = document.getElementById('submit-btn');

  const loadingBox = document.getElementById('loading-box');
  const errorBox = document.getElementById('error-box');
  const errorMessage = document.getElementById('error-message');
  const errorCloseBtn = document.getElementById('error-close-btn');

  const resultBox = document.getElementById('result-box');
  const resThumbnail = document.getElementById('res-thumbnail');
  const resTypeBadge = document.getElementById('res-type-badge');
  const resDuration = document.getElementById('res-duration');
  const resTitle = document.getElementById('res-title');
  const resAuthor = document.getElementById('res-author');

  const videoFormatList = document.getElementById('video-format-list');
  const audioFormatList = document.getElementById('audio-format-list');

  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const faqQuestions = document.querySelectorAll('.faq-question');
  const demoChips = document.querySelectorAll('.demo-chip');

  let currentVideoData = null;

  // Toggle Input Clear Button
  urlInput.addEventListener('input', () => {
    if (urlInput.value.trim().length > 0) {
      clearBtn.style.display = 'block';
    } else {
      clearBtn.style.display = 'none';
    }
  });

  clearBtn.addEventListener('click', () => {
    urlInput.value = '';
    clearBtn.style.display = 'none';
    urlInput.focus();
  });

  // Paste from Clipboard
  pasteBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          urlInput.value = text.trim();
          clearBtn.style.display = 'block';
          urlInput.focus();
        }
      } else {
        showError('Clipboard paste not supported by browser. Please paste manually.');
      }
    } catch (err) {
      console.warn('Clipboard permission error:', err);
      urlInput.focus();
    }
  });

  // Demo Chips
  demoChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const demoUrl = chip.getAttribute('data-url');
      urlInput.value = demoUrl;
      clearBtn.style.display = 'block';
      fetchVideoInfo(demoUrl);
    });
  });

  // Close Error Box
  errorCloseBtn.addEventListener('click', () => {
    errorBox.style.display = 'none';
  });

  // Form Submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) {
      showError('Please enter a YouTube video or Short URL.');
      return;
    }
    fetchVideoInfo(url);
  });

  // Tab Switcher
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const activeContent = document.getElementById(`tab-content-${targetTab}`);
      if (activeContent) {
        activeContent.classList.add('active');
      }
    });
  });

  // FAQ Accordion
  faqQuestions.forEach(q => {
    q.addEventListener('click', () => {
      const faqItem = q.parentElement;
      const isActive = faqItem.classList.contains('active');

      document.querySelectorAll('.faq-item').forEach(item => {
        item.classList.remove('active');
      });

      if (!isActive) {
        faqItem.classList.add('active');
      }
    });
  });

  // Fetch Video Info Function
  async function fetchVideoInfo(url) {
    hideError();
    hideResult();
    showLoading();

    submitBtn.disabled = true;

    try {
      const response = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to fetch video information.');
      }

      currentVideoData = data;
      renderResult(data, url);
    } catch (err) {
      showError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      hideLoading();
      submitBtn.disabled = false;
    }
  }

  // Render Result Box
  function renderResult(data, originalUrl) {
    resTitle.textContent = data.title;
    resAuthor.textContent = data.author;
    resDuration.textContent = data.duration;
    resThumbnail.src = data.thumbnail;

    if (data.isShort) {
      resTypeBadge.innerHTML = '<i class="fa-solid fa-bolt"></i> Short';
      resTypeBadge.className = 'badge short-badge';
    } else {
      resTypeBadge.innerHTML = '<i class="fa-solid fa-video"></i> Video';
      resTypeBadge.className = 'badge short-badge';
    }

    // Render Video Formats
    videoFormatList.innerHTML = '';
    if (data.videoFormats && data.videoFormats.length > 0) {
      data.videoFormats.forEach(fmt => {
        const item = document.createElement('div');
        item.className = 'format-item';
        item.innerHTML = `
          <div class="format-label-group">
            <span class="quality-badge">${fmt.quality}</span>
            <span class="format-name">${fmt.label}</span>
          </div>
          <button class="btn btn-primary download-link-btn" data-type="video" data-quality="${fmt.quality}">
            <i class="fa-solid fa-download"></i> Download
          </button>
        `;
        videoFormatList.appendChild(item);
      });
    }

    // Render Audio Formats
    audioFormatList.innerHTML = '';
    if (data.audioFormats && data.audioFormats.length > 0) {
      data.audioFormats.forEach(fmt => {
        const item = document.createElement('div');
        item.className = 'format-item';
        item.innerHTML = `
          <div class="format-label-group">
            <span class="quality-badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">MP3</span>
            <span class="format-name">${fmt.label}</span>
          </div>
          <button class="btn btn-primary download-link-btn" data-type="audio" data-quality="${fmt.quality}">
            <i class="fa-solid fa-download"></i> Download
          </button>
        `;
        audioFormatList.appendChild(item);
      });
    }

    // Attach Download Event Listeners
    document.querySelectorAll('.download-link-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        const quality = btn.getAttribute('data-quality');
        triggerDownload(originalUrl, type, quality, data.title);
      });
    });

    resultBox.style.display = 'block';
    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Trigger File Download
  function triggerDownload(url, type, quality, title) {
    const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&type=${type}&quality=${quality}&title=${encodeURIComponent(title)}`;
    
    // Create temporary link element to trigger browser download window
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // UI Helpers
  function showLoading() {
    loadingBox.style.display = 'block';
  }

  function hideLoading() {
    loadingBox.style.display = 'none';
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorBox.style.display = 'flex';
  }

  function hideError() {
    errorBox.style.display = 'none';
  }

  function hideResult() {
    resultBox.style.display = 'none';
  }
});

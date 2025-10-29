import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

/**
 * Simple API client pointing to FastAPI backend.
 */
const API_BASE = 'http://localhost:3001';

// PUBLIC_INTERFACE
export function buildImageUrl(imageId) {
  /** Returns URL to fetch original image bytes. */
  return `${API_BASE}/images/${imageId}`;
}

// PUBLIC_INTERFACE
export function buildVariantUrl(variantId) {
  /** Returns URL to fetch processed variant image bytes. */
  return `${API_BASE}/images/processed/${variantId}`;
}

/**
 * Retro style helper colors from style guide
 */
const colors = {
  primary: '#3b82f6',
  success: '#06b6d4',
  error: '#EF4444',
  surface: '#ffffff',
  background: '#f9fafb',
  text: '#111827',
  secondary: '#64748b'
};

const initialOps = {
  resize: { width: '', height: '' },
  crop: { x: '', y: '', width: '', height: '' },
  grayscale: false,
  sepia: false, // UI only hint - backend supports grayscale/blur/brightness/contrast; sepia simulated via CSS preview
  blur: { radius: '' }
};

// PUBLIC_INTERFACE
function App() {
  /** Main application that renders sidebar controls and the image gallery. */
  const [theme] = useState('light'); // fixed to light per style guide
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [file, setFile] = useState(null);
  const [images, setImages] = useState([]);
  const [selectedImageId, setSelectedImageId] = useState('');
  const [ops, setOps] = useState(initialOps);
  const [brightness, setBrightness] = useState('1');
  const [contrast, setContrast] = useState('1');

  // Apply theme attribute on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const fetchImages = async () => {
    try {
      const res = await fetch(`${API_BASE}/images?limit=100`);
      if (!res.ok) throw new Error(`Failed to list images (${res.status})`);
      const data = await res.json();
      setImages(data);
      if (!selectedImageId && data.length) {
        setSelectedImageId(data[0].image_id);
      }
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  useEffect(() => {
    fetchImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
    setError('');
    setNotice('');
  };

  const doUpload = async () => {
    if (!file) {
      setError('Please choose an image to upload.');
      return;
    }
    setUploading(true);
    setError('');
    setNotice('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE}/images/upload`, {
        method: 'POST',
        body: form
      });
      if (!res.ok) {
        const msg = await safeReadJson(res);
        throw new Error(msg?.detail || `Upload failed (${res.status})`);
      }
      const data = await res.json();
      setNotice('Upload successful.');
      setFile(null);
      await fetchImages();
      setSelectedImageId(data.image_id);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setUploading(false);
    }
  };

  const parsedOps = useMemo(() => {
    const toInt = (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
    };
    const toNonNegInt = (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
    };

    const o = { grayscale: !!ops.grayscale };

    // Blur
    const r = Number(ops.blur.radius);
    if (!Number.isNaN(r) && r > 0) o.blur = { radius: r };

    // Resize
    const rw = toInt(ops.resize.width);
    const rh = toInt(ops.resize.height);
    if (rw && rh) o.resize = { width: rw, height: rh };

    // Crop
    const cx = toNonNegInt(ops.crop.x);
    const cy = toNonNegInt(ops.crop.y);
    const cw = toInt(ops.crop.width);
    const ch = toInt(ops.crop.height);
    if (cx !== null && cy !== null && cw && ch) {
      o.crop = { x: cx, y: cy, width: cw, height: ch };
    }

    // Brightness/Contrast
    const bf = Number(brightness);
    if (!Number.isNaN(bf) && bf > 0 && bf !== 1) {
      o.brightness = { factor: bf };
    }
    const cf = Number(contrast);
    if (!Number.isNaN(cf) && cf > 0 && cf !== 1) {
      o.contrast = { factor: cf };
    }

    return o;
  }, [ops, brightness, contrast]);

  const doProcess = async () => {
    if (!selectedImageId) {
      setError('Please select an image to process.');
      return;
    }
    if (Object.keys(parsedOps).length === 0) {
      setError('Choose at least one operation.');
      return;
    }
    setProcessing(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`${API_BASE}/images/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_id: selectedImageId, operations: parsedOps })
      });
      if (!res.ok) {
        const msg = await safeReadJson(res);
        throw new Error(msg?.detail || `Process failed (${res.status})`);
      }
      await res.json();
      setNotice('Processing complete.');
      await fetchImages();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setProcessing(false);
    }
  };

  const resetOps = () => {
    setOps(initialOps);
    setBrightness('1');
    setContrast('1');
  };

  const selectedImage = images.find(i => i.image_id === selectedImageId);

  return (
    <div className="retro-app">
      <Navbar />
      <div className="layout">
        <Sidebar
          file={file}
          onFileChange={onFileChange}
          onUpload={doUpload}
          uploading={uploading}
          ops={ops}
          setOps={setOps}
          brightness={brightness}
          setBrightness={setBrightness}
          contrast={contrast}
          setContrast={setContrast}
          onProcess={doProcess}
          processing={processing}
          onReset={resetOps}
          hasImage={!!selectedImageId}
        />
        <main className="gallery-area">
          <StatusBar error={error} notice={notice} onClear={() => { setError(''); setNotice(''); }} />
          <Gallery
            images={images}
            selectedImageId={selectedImageId}
            onSelect={setSelectedImageId}
          />
        </main>
      </div>
      <Footer />
    </div>
  );
}

async function safeReadJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function Navbar() {
  return (
    <header className="nav">
      <div className="nav-title">
        <span className="logo">▣</span>
        <div className="nav-text">
          <div className="title">Retro Image Lab</div>
          <div className="subtitle">Resize • Crop • Filters</div>
        </div>
      </div>
      <div className="nav-actions">
        <a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer" className="btn btn-link">API Docs</a>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <span>Made with ♡ • Accents: {colors.primary} & {colors.success}</span>
    </footer>
  );
}

function StatusBar({ error, notice, onClear }) {
  if (!error && !notice) return null;
  return (
    <div className="status-wrapper">
      {notice ? <div className="status notice">{notice}</div> : null}
      {error ? <div className="status error">{error} <button className="btn small" onClick={onClear}>Dismiss</button></div> : null}
    </div>
  );
}

function Sidebar({
  file, onFileChange, onUpload, uploading,
  ops, setOps,
  brightness, setBrightness, contrast, setContrast,
  onProcess, processing, onReset, hasImage
}) {
  const updateOps = (path, value) => {
    setOps(prev => {
      const next = { ...prev };
      const [root, key] = path.split('.');
      if (key) {
        next[root] = { ...next[root], [key]: value };
      } else {
        next[root] = value;
      }
      return next;
    });
  };

  return (
    <aside className="sidebar">
      <section className="panel">
        <h3 className="panel-title">Upload</h3>
        <div className="field">
          <input type="file" accept="image/*" onChange={onFileChange} />
        </div>
        <button className="btn primary w-full" onClick={onUpload} disabled={uploading || !file}>
          {uploading ? 'Uploading…' : 'Upload Image'}
        </button>
      </section>

      <section className="panel">
        <h3 className="panel-title">Resize</h3>
        <div className="grid-2">
          <div className="field">
            <label>Width</label>
            <input type="number" min="1" placeholder="e.g., 800"
                   value={ops.resize.width}
                   onChange={(e) => updateOps('resize.width', e.target.value)} />
          </div>
          <div className="field">
            <label>Height</label>
            <input type="number" min="1" placeholder="e.g., 600"
                   value={ops.resize.height}
                   onChange={(e) => updateOps('resize.height', e.target.value)} />
          </div>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title">Crop</h3>
        <div className="grid-2">
          <div className="field">
            <label>X</label>
            <input type="number" min="0" value={ops.crop.x}
                   onChange={(e) => updateOps('crop.x', e.target.value)} />
          </div>
          <div className="field">
            <label>Y</label>
            <input type="number" min="0" value={ops.crop.y}
                   onChange={(e) => updateOps('crop.y', e.target.value)} />
          </div>
          <div className="field">
            <label>W</label>
            <input type="number" min="1" value={ops.crop.width}
                   onChange={(e) => updateOps('crop.width', e.target.value)} />
          </div>
          <div className="field">
            <label>H</label>
            <input type="number" min="1" value={ops.crop.height}
                   onChange={(e) => updateOps('crop.height', e.target.value)} />
          </div>
        </div>
      </section>

      <section className="panel">
        <h3 className="panel-title">Filters</h3>
        <div className="field checkbox">
          <label>
            <input type="checkbox" checked={ops.grayscale}
                   onChange={(e) => updateOps('grayscale', e.target.checked)} />
            Grayscale
          </label>
        </div>
        <div className="field">
          <label>Blur radius</label>
          <input type="number" min="0" step="0.1" placeholder="e.g., 1.5"
                 value={ops.blur.radius}
                 onChange={(e) => updateOps('blur.radius', e.target.value)} />
        </div>
        <div className="field">
          <label>Brightness</label>
          <input type="number" min="0.1" step="0.1" value={brightness}
                 onChange={(e) => setBrightness(e.target.value)} />
        </div>
        <div className="field">
          <label>Contrast</label>
          <input type="number" min="0.1" step="0.1" value={contrast}
                 onChange={(e) => setContrast(e.target.value)} />
        </div>
      </section>

      <div className="actions">
        <button className="btn" onClick={onReset}>Reset</button>
        <button className="btn success" onClick={onProcess} disabled={processing || !hasImage}>
          {processing ? 'Processing…' : 'Apply'}
        </button>
      </div>
    </aside>
  );
}

function Gallery({ images, selectedImageId, onSelect }) {
  return (
    <div className="gallery">
      {!images.length && (
        <div className="empty">Upload an image to get started.</div>
      )}
      {images.map((img) => (
        <ImageCard
          key={img.image_id}
          image={img}
          selected={img.image_id === selectedImageId}
          onSelect={() => onSelect(img.image_id)}
        />
      ))}
    </div>
  );
}

function ImageCard({ image, selected, onSelect }) {
  return (
    <div className={`card ${selected ? 'selected' : ''}`} onClick={onSelect} role="button" tabIndex={0}>
      <div className="card-header">
        <div className="filename">{image.filename}</div>
        <div className="meta">
          <span>{Math.round((image.size_bytes || 0) / 1024)} KB</span>
        </div>
      </div>
      <div className="card-body">
        <div className="preview-row">
          <figure className="preview">
            <img src={buildImageUrl(image.image_id)} alt={image.filename} />
            <figcaption>Original</figcaption>
          </figure>
          {image.variants?.slice(0, 3).map(v => (
            <figure className="preview" key={v.variant_id}>
              <img src={buildVariantUrl(v.variant_id)} alt={v.filename} />
              <figcaption>Processed</figcaption>
            </figure>
          ))}
        </div>
      </div>
      {!!(image.variants?.length > 3) && (
        <div className="card-footer">{image.variants.length - 3} more variant(s)…</div>
      )}
    </div>
  );
}

export default App;

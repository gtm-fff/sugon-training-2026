'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';

const COMPANIES = [
  '一连', '二连', '三连', '四连', '五连', '六连', '七连', '八连',
  '九连', '十连', '十一连', '十二连', '十三连', '十四连', '十五连', '十六连',
];
const ALBUM_COPY = [
  ['一往无前，共启新程', '晨光集结'], ['同心协作，双向成长', '协作挑战'],
  ['聚智共创，步履不停', '创新研讨'], ['四海同心，勇往直前', '青春接力'],
  ['敢想敢为，自信表达', '成果汇报'], ['并肩远行，韧性生长', '户外拓展'],
  ['智创未来，工程同行', '技术共创'], ['八方英才，共筑曙光', '团队庆祝'],
  ['责任在肩，守护同行', '应急训练'], ['十全协作，迎难而上', '障碍协作'],
  ['初心如炬，向新而行', '启航时刻'], ['全员同框，定格青春', '团队合影'],
  ['拾光同行，温暖相聚', '夜间共创'], ['实干担当，合力成事', '会场协作'],
  ['活力全开，默契制胜', '团队运动'], ['荣聚曙光，梦想起航', '结营庆祝'],
];
const COMPANY_ALBUMS = COMPANIES.map((name, index) => ({
  name,
  number: String(index + 1).padStart(2, '0'),
  slogan: ALBUM_COPY[index][0],
  scene: ALBUM_COPY[index][1],
  demoUrl: `/company-demo/${String(index + 1).padStart(2, '0')}.jpg`,
}));
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type Submission = {
  id: string;
  company: string;
  title: string;
  description: string;
  imageName: string;
  mediaType: string;
  imageSize: number;
  createdAt: string;
  updatedAt: string;
};

type GalleryItem = {
  id: string;
  company: string;
  title: string;
  description: string;
  mediaType: string;
  createdAt: string;
  updatedAt: string;
};

function formatBytes(bytes: number) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function MediaPicker({ file, onChange, currentImage, currentType }: {
  file: File | null;
  onChange: (file: File | null) => void;
  currentImage?: string;
  currentType?: string;
}) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : currentImage), [file, currentImage]);
  const isVideo = (file?.type || currentType || '').startsWith('video/');

  useEffect(() => () => {
    if (file && preview) URL.revokeObjectURL(preview);
  }, [file, preview]);

  function pick(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.files?.[0] ?? null);
  }

  return (
    <label className={`dropzone ${preview ? 'has-preview' : ''}`}>
      {preview ? (
        isVideo
          ? <video src={preview} aria-label="待上传视频预览" controls muted playsInline />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={preview} alt="待上传照片预览" />
      ) : <span className="dropzone-mark">＋</span>}
      <span className="dropzone-copy">
        <strong>{file ? file.name : currentImage ? '点击替换素材' : '选择照片或视频'}</strong>
        <small>{file ? `${formatBytes(file.size)} · 点击重新选择` : 'JPEG / PNG / WebP / MP4 / MOV / WebM，最大 10MB'}</small>
      </span>
      <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" onChange={pick} />
    </label>
  );
}

export default function Home() {
  const [mode, setMode] = useState<'upload' | 'manage'>('upload');
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [company, setCompany] = useState('一连');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [credential, setCredential] = useState('');
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [createdCredential, setCreatedCredential] = useState('');
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [albumIndex, setAlbumIndex] = useState(0);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [galleryPaused, setGalleryPaused] = useState(false);

  useEffect(() => {
    fetch('/api/gallery')
      .then((response) => response.json())
      .then((data: { items?: GalleryItem[] }) => setGalleryItems(data.items || []))
      .catch(() => setGalleryItems([]));
  }, []);

  useEffect(() => {
    if (galleryPaused) return;
    const timer = window.setInterval(() => {
      setAlbumIndex((current) => (current + 1) % COMPANY_ALBUMS.length);
      setMediaIndex(0);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [galleryPaused]);

  function resetFeedback() {
    setMessage('');
    setCreatedCredential('');
  }

  function validateMedia(file: File | null, required = true) {
    if (!file && required) return '请选择照片或视频';
    if (file && file.size > MAX_FILE_SIZE) return '文件超过 10MB，请压缩后再试';
    if (file && !['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'].includes(file.type)) return '只支持 JPEG、PNG、WebP、MP4、MOV 或 WebM';
    return '';
  }

  async function upload(event: FormEvent) {
    event.preventDefault();
    resetFeedback();
    const imageError = validateMedia(image);
    if (imageError) return setMessage(imageError);
    const data = new FormData();
    data.set('company', company);
    data.set('title', title);
    data.set('description', description);
    data.set('image', image!);
    setBusy(true);
    try {
      const response = await fetch('/api/submissions', { method: 'POST', body: data });
      const result = (await response.json()) as { credential?: string; submission?: GalleryItem; error?: string };
      if (!response.ok) throw new Error(result.error || '上传失败');
      setCreatedCredential(result.credential!);
      if (result.submission) setGalleryItems((current) => [result.submission!, ...current]);
      setImage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '上传失败');
    } finally {
      setBusy(false);
    }
  }

  async function lookup(event?: FormEvent) {
    event?.preventDefault();
    resetFeedback();
    const normalized = credential.trim().toUpperCase();
    if (!normalized) return setMessage('请输入上传码');
    setBusy(true);
    try {
      const response = await fetch(`/api/submissions/${encodeURIComponent(normalized)}`);
      const result = (await response.json()) as Submission & { error?: string };
      if (!response.ok) throw new Error(result.error || '没有找到投稿');
      setCredential(normalized);
      setSubmission(result);
      setCompany(result.company);
      setTitle(result.title);
      setDescription(result.description);
      setImage(null);
    } catch (error) {
      setSubmission(null);
      setMessage(error instanceof Error ? error.message : '查询失败');
    } finally {
      setBusy(false);
    }
  }

  async function update(event: FormEvent) {
    event.preventDefault();
    resetFeedback();
    const imageError = validateMedia(image, false);
    if (imageError) return setMessage(imageError);
    const data = new FormData();
    data.set('company', company);
    data.set('title', title);
    data.set('description', description);
    if (image) data.set('image', image);
    setBusy(true);
    try {
      const response = await fetch(`/api/submissions/${encodeURIComponent(credential)}`, { method: 'PUT', body: data });
      const result = (await response.json()) as Submission & { error?: string };
      if (!response.ok) throw new Error(result.error || '保存失败');
      setSubmission(result);
      setImage(null);
      setMessage('修改已保存');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: 'upload' | 'manage') {
    setMode(next);
    setMessage('');
    setCreatedCredential('');
  }

  function openWorkspace(next: 'upload' | 'manage') {
    switchMode(next);
    setWorkspaceOpen(true);
    window.setTimeout(() => document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  const activeAlbum = COMPANY_ALBUMS[albumIndex];
  const liveMedia = galleryItems.filter((item) => item.company === activeAlbum.name);
  const albumMedia = [
    { id: `demo-${activeAlbum.number}`, title: activeAlbum.scene, description: activeAlbum.slogan, mediaType: 'image/jpeg', url: activeAlbum.demoUrl },
    ...liveMedia.map((item) => ({ ...item, url: `/api/gallery/${item.id}/media?v=${item.updatedAt}` })),
  ];
  const activeMedia = albumMedia[mediaIndex % albumMedia.length];

  function showAlbum(index: number) {
    setAlbumIndex((index + COMPANY_ALBUMS.length) % COMPANY_ALBUMS.length);
    setMediaIndex(0);
  }

  return (
    <main className="site-shell">
      <nav className="topbar">
        <a className="brand" href="#top" aria-label="青春阵列首页">
          <span className="brand-number">26</span>
          <span><strong>应届生集训宣传平台</strong><small>SUGON GRADUATE TRAINING</small></span>
        </a>
        <span className="sugon-brand" aria-label="Sugon 中科曙光"><i className="sugon-mark" /><span><b>Sugon</b><small>中科曙光</small></span></span>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> SUGON GRADUATE TRAINING 2026</p>
          <h1>荣聚曙光，<br /><span>梦想起航</span>。</h1>
          <p className="hero-intro">记录新曙光人的成长时刻。无需注册，选择连队即可上传；完成后自动生成上传码，之后随时回来修改。</p>
          <div className="hero-facts">
            <span><strong>16</strong> 青春连队</span>
            <span><strong>10MB</strong> 单份限额</span>
            <span><strong>∞</strong> 凭码可改</span>
          </div>
        </div>
        <div className="pass-card" aria-hidden="true">
          <span className="pass-kicker">SUGON / NEW TALENT</span>
          <span className="pass-year">2026</span>
          <div className="pass-line"><span>荣聚曙光</span><span>梦想起航</span></div>
          <div className="pass-code">NEW SUGON · NEW LIGHT</div>
          <div className="pass-grid"><i /><i /><i /><i /><i /><i /><i /><i /></div>
        </div>
      </section>

      {!workspaceOpen ? (
        <section className="upload-launch" id="upload">
          <div className="upload-launch-copy">
            <p>UPLOAD & MANAGE</p>
            <h2>留下你的集训瞬间</h2>
            <span>上传照片或视频，完成后自动获得专属上传码。</span>
          </div>
          <div className="upload-launch-actions">
            <button className="launch-primary" onClick={() => openWorkspace('upload')}>上传素材 <span>→</span></button>
            <button className="launch-secondary" onClick={() => openWorkspace('manage')}>凭码查询</button>
          </div>
        </section>
      ) : (
      <section className="workspace" id="upload">
        <button className="workspace-close" onClick={() => setWorkspaceOpen(false)} aria-label="收起上传界面">收起 ×</button>
        <div className="steps-rail">
          <p>HOW IT WORKS</p>
          <ol>
            <li className={mode === 'upload' ? 'active' : ''}><b>01</b><span>选择连队<br /><small>无需注册登录</small></span></li>
            <li><b>02</b><span>上传素材<br /><small>照片或视频</small></span></li>
            <li className={mode === 'manage' ? 'active' : ''}><b>03</b><span>获得上传码<br /><small>随时查询修改</small></span></li>
          </ol>
          <div className="demo-note"><strong>上传完成后自动生成</strong><code>XXXX-XXXX-XXXX</code><small>请截图或复制保存</small></div>
        </div>

        <div className="form-panel">
          <div className="mode-tabs" role="tablist" aria-label="投稿功能">
            <button className={mode === 'upload' ? 'active' : ''} onClick={() => switchMode('upload')}>上传新内容</button>
            <button className={mode === 'manage' ? 'active' : ''} onClick={() => switchMode('manage')}>查询 / 修改</button>
          </div>

          {mode === 'upload' ? (
            <form onSubmit={upload} className="content-form">
              <div className="panel-heading"><span>01</span><div><h2>提交你的集训瞬间</h2><p>无需预先领取代码，上传成功后系统会自动生成专属上传码。</p></div></div>
              <label><span>所属连队 *</span><select value={company} onChange={(e) => setCompany(e.target.value)}>{COMPANIES.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>素材标题</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="给这个瞬间起个名字（选填）" /></label>
              <label><span>故事说明</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="写下当时发生了什么（选填）" /></label>
              <MediaPicker file={image} onChange={setImage} />
              {message && <p className="form-message error" role="alert">{message}</p>}
              <button className="primary-button" disabled={busy}>{busy ? '正在上传…' : '上传素材并生成代码'}<span>→</span></button>
            </form>
          ) : submission ? (
            <form onSubmit={update} className="content-form">
              <div className="panel-heading"><span>03</span><div><h2>已找到你的投稿</h2><p>使用上传后自动生成的代码修改文字或替换素材。</p></div></div>
              <div className="field-grid">
                <label><span>所属连队</span><select value={company} onChange={(e) => setCompany(e.target.value)}>{COMPANIES.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>上传时间</span><input value={new Date(submission.createdAt).toLocaleString('zh-CN')} disabled /></label>
              </div>
              <label><span>素材标题</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} /></label>
              <label><span>故事说明</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} /></label>
              <MediaPicker file={image} onChange={setImage} currentImage={`/api/submissions/${encodeURIComponent(credential)}/image?v=${submission.updatedAt}`} currentType={submission.mediaType} />
              {message && <p className={`form-message ${message.includes('保存') ? 'success' : 'error'}`}>{message}</p>}
              <div className="button-row"><button type="button" className="text-button" onClick={() => setSubmission(null)}>换一个凭据</button><button className="primary-button" disabled={busy}>{busy ? '正在保存…' : '保存修改'}<span>→</span></button></div>
            </form>
          ) : (
            <form onSubmit={lookup} className="content-form lookup-form">
              <div className="panel-heading"><span>03</span><div><h2>找回并修改投稿</h2><p>输入上传成功后自动生成的上传码，无需登录账号。</p></div></div>
              <label><span>上传码 *</span><input className="credential-input" value={credential} onChange={(e) => setCredential(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX" autoComplete="off" /></label>
              {message && <p className="form-message error" role="alert">{message}</p>}
              <button className="primary-button" disabled={busy}>{busy ? '正在查询…' : '查询我的投稿'}<span>→</span></button>
              <p className="privacy-note">上传码相当于你的私钥。平台不收集姓名、手机号，也无法帮你找回丢失的代码。</p>
            </form>
          )}
        </div>
      </section>
      )}

      <section className="gallery-section" id="gallery" aria-labelledby="gallery-title">
        <div className="gallery-heading">
          <div>
            <p className="eyebrow"><span /> COMPANY ALBUMS</p>
            <h2 id="gallery-title">一连一册，轮播每一份青春。</h2>
          </div>
          <p>每个连队拥有独立相册。上传的照片和视频会自动进入所属连队，与演示封面一起展示。</p>
        </div>

        <div
          className={`album-carousel ${galleryPaused ? 'paused' : ''}`}
          onMouseEnter={() => setGalleryPaused(true)}
          onMouseLeave={() => setGalleryPaused(false)}
          onFocus={() => setGalleryPaused(true)}
          onBlur={() => setGalleryPaused(false)}
        >
          <div className="album-media" aria-live="polite">
            {activeMedia.mediaType.startsWith('video/') ? (
              <video src={activeMedia.url} controls muted playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeMedia.url} alt={`${activeAlbum.name}相册：${activeMedia.title}`} />
            )}
            <span className="album-watermark">{activeAlbum.number}</span>
            <span className="album-scene">{activeMedia.title}</span>
          </div>
          <div className="album-copy">
            <p>COMPANY {activeAlbum.number} / 16</p>
            <h3>{activeAlbum.name}</h3>
            <strong>{activeAlbum.slogan}</strong>
            <p className="album-description">{activeMedia.description || '记录每一次并肩协作与共同成长。'}</p>
            <div className="album-count"><span>{albumMedia.length}</span><small>份相册素材<br />含 1 张演示封面</small></div>
            <div className="album-controls">
              <button onClick={() => showAlbum(albumIndex - 1)} aria-label="上一个连队">←</button>
              <span>{String(mediaIndex + 1).padStart(2, '0')} / {String(albumMedia.length).padStart(2, '0')}</span>
              <button onClick={() => showAlbum(albumIndex + 1)} aria-label="下一个连队">→</button>
            </div>
            {albumMedia.length > 1 && (
              <div className="media-dots" aria-label="相册内容">
                {albumMedia.map((item, index) => <button key={item.id} className={index === mediaIndex ? 'active' : ''} onClick={() => setMediaIndex(index)} aria-label={`查看第 ${index + 1} 份素材`} />)}
              </div>
            )}
            <div className="album-progress" key={albumIndex}><i /></div>
          </div>
        </div>

        <div className="company-album-tabs" aria-label="选择连队相册">
          {COMPANY_ALBUMS.map((album, index) => (
            <button key={album.name} className={index === albumIndex ? 'active' : ''} onClick={() => showAlbum(index)}>
              <span>{album.number}</span>{album.name}
            </button>
          ))}
        </div>
      </section>

      <footer><span>© 2026 中科曙光应届生集训项目 · 荣聚曙光，梦想起航</span><a href="/admin">管理员入口</a></footer>

      {createdCredential && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="success-title">
          <div className="success-card">
            <span className="success-mark">✓</span>
            <p className="eyebrow">UPLOAD COMPLETE</p>
            <h2 id="success-title">这一刻，已经收好。</h2>
            <p>系统已自动生成专属上传码。请立即截图或复制保存，丢失后将无法找回或修改投稿。</p>
            <button className="credential-card" onClick={() => navigator.clipboard.writeText(createdCredential)}><code>{createdCredential}</code><small>点击复制上传码</small></button>
            <button className="primary-button" onClick={() => { setCreatedCredential(''); setMode('manage'); setCredential(createdCredential); }}>现在查看投稿 <span>→</span></button>
          </div>
        </div>
      )}
    </main>
  );
}

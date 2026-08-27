'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

const COMPANIES = [
  '一连', '二连', '三连', '四连', '五连', '六连', '七连', '八连',
  '九连', '十连', '十一连', '十二连', '十三连', '十四连', '十五连', '十六连',
];
const COMPANY_ALBUMS = COMPANIES.map((name, index) => ({
  name,
  number: String(index + 1).padStart(2, '0'),
  demoUrl: `/company-demo/${String(index + 1).padStart(2, '0')}.webp`,
}));
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_DISPLAY_IMAGE_SIZE = 2 * 1024 * 1024;
const MAX_THUMBNAIL_SIZE = 1024 * 1024;
const SHARE_URL = 'https://sugon-training-2026.pages.dev';

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

type CompanyAlbum = (typeof COMPANY_ALBUMS)[number];

function CompanyAlbumCard({ album, items, likes, liked, liking, onLike }: {
  album: CompanyAlbum;
  items: GalleryItem[];
  likes: number;
  liked: boolean;
  liking: boolean;
  onLike: () => void;
}) {
  const media = items.length ? items.map((item) => ({
    ...item,
    thumbnailUrl: item.mediaType.startsWith('video/') ? '' : `/api/gallery/${item.id}/thumbnail?v=${item.updatedAt}`,
    url: `/api/gallery/${item.id}/media?v=${item.updatedAt}`,
    isDemo: false,
  })) : [{
    id: `demo-${album.number}`,
    title: '示例封面',
    description: '暂无用户投稿，上传后将优先展示最新素材。',
    mediaType: 'image/webp',
    thumbnailUrl: album.demoUrl,
    url: album.demoUrl,
    isDemo: true,
  }];
  const [index, setIndex] = useState(0);
  const previewRef = useRef<HTMLDialogElement>(null);
  const cover = media[0];
  const active = media[index];
  const imageAlt = `${album.name}${active.isDemo ? '演示封面' : active.title || '投稿素材'}`;

  function move(delta: number) {
    setIndex((current) => (current + delta + media.length) % media.length);
  }

  function openPreview() {
    setIndex(0);
    previewRef.current?.showModal();
  }

  return (
    <article className="company-album-card">
      <div className="company-album-media">
        <button type="button" className="company-album-image-button" onClick={openPreview} aria-label={`浏览${album.name}相册`}>
          {cover.mediaType.startsWith('video/')
            ? <span className="video-cover"><b>▶</b><small>视频素材</small></span>
            : <img src={cover.thumbnailUrl} alt={`${album.name}${cover.isDemo ? '示例封面' : cover.title || '最新投稿'}`} loading="lazy" decoding="async" width="720" height="480" />}
        </button>
        <span className="company-album-badge"><b>{album.number}</b>{album.name}</span>
        <span className="company-album-position">{items.length} 份投稿&nbsp; →</span>
      </div>
      <dialog ref={previewRef} className="image-lightbox" onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
        <button type="button" className="image-lightbox-close" onClick={() => previewRef.current?.close()} aria-label="关闭相册">×</button>
        <div className="image-lightbox-media">
          {active.mediaType.startsWith('video/')
            ? <video src={active.url} aria-label={imageAlt} controls playsInline preload="metadata" />
            : <img src={active.url} alt={imageAlt} />}
          {media.length > 1 && <>
            <button type="button" className="image-lightbox-prev" onClick={() => move(-1)} aria-label={`${album.name}上一份素材`}>←</button>
            <button type="button" className="image-lightbox-next" onClick={() => move(1)} aria-label={`${album.name}下一份素材`}>→</button>
          </>}
        </div>
        <div className="image-lightbox-caption">
          <span>{album.number} / {album.name} · {String(index + 1).padStart(2, '0')} / {String(media.length).padStart(2, '0')}</span>
          <h3>{active.title || '未填写素材标题'}</h3>
          <p>{active.description || '未填写故事说明'}</p>
        </div>
      </dialog>
      <div className="company-album-copy">
        <div><span>COMPANY {album.number}</span><small>{items.length} 份用户投稿</small></div>
        <div className="company-album-title-row">
          <h3>{cover.title || '未填写素材标题'}</h3>
          <button type="button" className={liked ? 'liked' : ''} disabled={liked || liking} onClick={onLike} aria-pressed={liked} aria-label={`${liked ? '已为' : '给'}${album.name}点赞`}>
            {liked ? '♥' : '♡'} {likes}
          </button>
        </div>
      </div>
    </article>
  );
}

function formatBytes(bytes: number) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (result) => result ? resolve(result) : reject(new Error('图片压缩失败')),
    'image/webp',
    quality,
  ));
}

async function encodeImageVariant(bitmap: ImageBitmap, maxDimension: number, maxBytes: number, name: string) {
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  let blob = await canvasToWebp(canvas, 0.86);
  for (const quality of [0.76, 0.66, 0.56]) {
    if (blob.size <= maxBytes) break;
    blob = await canvasToWebp(canvas, quality);
  }
  // ponytail: bounded main-thread compression; move to a Web Worker if mobile latency becomes measurable.
  for (let attempt = 0; blob.size > maxBytes && attempt < 5; attempt += 1) {
    const resize = Math.max(0.6, Math.min(0.9, Math.sqrt(maxBytes / blob.size) * 0.92));
    canvas.width = Math.max(1, Math.round(canvas.width * resize));
    canvas.height = Math.max(1, Math.round(canvas.height * resize));
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    blob = await canvasToWebp(canvas, 0.72);
  }
  if (blob.size > maxBytes) throw new Error('图片无法压缩到 2MB 内，请换一张图片');
  return new File([blob], name, { type: 'image/webp' });
}

async function createImageVariants(file: File) {
  if (!file.type.startsWith('image/')) return null;
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    return {
      display: await encodeImageVariant(bitmap, 2560, MAX_DISPLAY_IMAGE_SIZE, 'display.webp'),
      thumbnail: await encodeImageVariant(bitmap, 720, MAX_THUMBNAIL_SIZE, 'thumbnail.webp'),
    };
  } finally {
    bitmap.close();
  }
}

function MediaPicker({ file, onChange, currentImage, currentType }: {
  file: File | null;
  onChange: (file: File | null) => void;
  currentImage?: string;
  currentType?: string;
}) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : currentImage), [file, currentImage]);
  const isVideo = (file?.type || currentType || '').startsWith('video/');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (file && preview) URL.revokeObjectURL(preview);
  }, [file, preview]);

  function pick(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.files?.[0] ?? null);
  }

  return (
    <div className="media-picker">
      <label className={`dropzone ${preview ? 'has-preview' : ''}`}>
        {preview ? (
          isVideo
            ? <video src={preview} aria-label="待上传视频预览" controls muted playsInline />
            : <img src={preview} alt="待上传照片预览" />
        ) : <span className="dropzone-mark">＋</span>}
        <span className="dropzone-copy">
          <strong>{file ? file.name : currentImage ? '点击替换素材' : '选择照片或视频'}</strong>
          <small>{file ? `${formatBytes(file.size)} · 点击重新选择` : '图片自动生成 ≤2MB 展示图；视频最大 25MB'}</small>
        </span>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" onChange={pick} />
      </label>
      {file && <button type="button" className="remove-media" onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = ''; }}>移除已选素材</button>}
    </div>
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
  const [copyMessage, setCopyMessage] = useState('点击复制上传码');
  const [shareMessage, setShareMessage] = useState('');
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [galleryLoaded, setGalleryLoaded] = useState(false);
  const [companyLikes, setCompanyLikes] = useState<Record<string, number>>({});
  const [likedCompanies, setLikedCompanies] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<'default' | 'popular'>('default');
  const [likingCompany, setLikingCompany] = useState('');
  const [galleryMessage, setGalleryMessage] = useState('');
  const successRef = useRef<HTMLDialogElement>(null);
  const shareRef = useRef<HTMLDialogElement>(null);
  const displayedAlbums = useMemo(() => sortMode === 'default' ? COMPANY_ALBUMS : [...COMPANY_ALBUMS].sort(
    (left, right) => (companyLikes[right.name] || 0) - (companyLikes[left.name] || 0) || Number(left.number) - Number(right.number),
  ), [sortMode, companyLikes]);

  useEffect(() => {
    fetch('/api/gallery')
      .then(async (response) => (await response.json()) as { items?: GalleryItem[]; likes?: Record<string, number>; likedCompanies?: string[] })
      .then((data) => {
        setGalleryItems(data.items || []);
        setCompanyLikes(data.likes || {});
        setLikedCompanies(data.likedCompanies || []);
      })
      .catch(() => setGalleryItems([]))
      .finally(() => setGalleryLoaded(true));
  }, []);

  useEffect(() => {
    if (createdCredential && !successRef.current?.open) successRef.current?.showModal();
  }, [createdCredential]);

  function resetFeedback() {
    setMessage('');
    setCreatedCredential('');
  }

  function validateMedia(file: File | null, required = true) {
    if (!file && required) return '请选择照片或视频';
    if (file && file.size > MAX_FILE_SIZE) return '文件超过 25MB，请压缩后再试';
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
      const variants = await createImageVariants(image!);
      if (variants) {
        data.set('display', variants.display);
        data.set('thumbnail', variants.thumbnail);
      }
      const response = await fetch('/api/submissions', { method: 'POST', body: data });
      const result = (await response.json()) as { credential?: string; submission?: GalleryItem; error?: string };
      if (!response.ok) throw new Error(result.error || '上传失败');
      setCopyMessage('点击复制上传码');
      setCreatedCredential(result.credential!);
      if (result.submission) setGalleryItems((current) => [result.submission!, ...current]);
      setImage(null);
      setTitle('');
      setDescription('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '上传失败');
    } finally {
      setBusy(false);
    }
  }

  async function lookup(event?: FormEvent, code = credential) {
    event?.preventDefault();
    resetFeedback();
    const normalized = code.trim().toUpperCase();
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
      if (image) {
        const variants = await createImageVariants(image);
        if (variants) {
          data.set('display', variants.display);
          data.set('thumbnail', variants.thumbnail);
        }
      }
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
    window.setTimeout(() => document.getElementById('upload')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    }), 0);
  }

  async function copyCredential() {
    try {
      await navigator.clipboard.writeText(createdCredential);
      setCopyMessage('已复制，请妥善保存');
    } catch {
      setCopyMessage('复制失败，请手动选择上传码');
    }
  }

  function closeSuccess() {
    successRef.current?.close();
    setCreatedCredential('');
  }

  async function viewCreatedSubmission() {
    const code = createdCredential;
    closeSuccess();
    setMode('manage');
    setWorkspaceOpen(true);
    setCredential(code);
    await lookup(undefined, code);
    document.getElementById('upload')?.scrollIntoView({ block: 'start' });
  }

  function openShare() {
    setShareMessage('');
    shareRef.current?.showModal();
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setShareMessage('链接已复制');
    } catch {
      setShareMessage('复制失败，请手动选择链接');
    }
  }

  async function sharePage() {
    if (!navigator.share) return setShareMessage('当前浏览器不支持系统分享，请复制链接');
    try {
      await navigator.share({
        title: '中科曙光｜2026 届应届生集训宣传平台',
        text: '记录 2026 届新曙光人的成长、协作与青春时刻。',
        url: SHARE_URL,
      });
      setShareMessage('分享完成');
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setShareMessage('分享未完成，请复制链接');
    }
  }

  async function likeCompany(company: string) {
    setLikingCompany(company);
    setGalleryMessage('');
    try {
      const response = await fetch('/api/gallery/like', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ company }),
      });
      const result = await response.json() as { likes?: number; added?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || '点赞失败');
      setCompanyLikes((current) => ({ ...current, [company]: result.likes || 0 }));
      setLikedCompanies((current) => current.includes(company) ? current : [...current, company]);
      setGalleryMessage(result.added ? `已为${company}点赞` : `你已经赞过${company}`);
    } catch (error) {
      setGalleryMessage(error instanceof Error ? error.message : '点赞失败');
    } finally {
      setLikingCompany('');
    }
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
          <h1>荣聚曙光<br /><span>梦想起航</span></h1>
          <p className="hero-intro">记录新曙光人的成长时刻。无需注册，选择连队即可上传；完成后自动生成上传码，之后随时回来修改。</p>
          <div className="hero-actions">
            <a href="#gallery">浏览连队风采</a>
            <button type="button" onClick={() => openWorkspace('upload')}>上传我的瞬间&nbsp; →</button>
            <button type="button" onClick={openShare}>分享页面</button>
          </div>
          <div className="hero-facts">
            <span><strong>16</strong> 青春连队</span>
            <span><strong>{galleryLoaded ? galleryItems.length : '—'}</strong> 总投稿数</span>
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

      <section className="gallery-section" id="gallery" aria-labelledby="gallery-title">
        <div className="gallery-heading">
          <div>
            <p className="eyebrow"><span /> COMPANY ALBUMS</p>
            <h2 id="gallery-title">十六个连队，十六本相册。</h2>
          </div>
          <div className="gallery-tools">
            <p>真实投稿优先成为相册封面。点击任意连队，即可浏览其中的照片、视频和故事。</p>
            <div className="gallery-sort" role="group" aria-label="连队相册排序">
              <button type="button" className={sortMode === 'default' ? 'active' : ''} onClick={() => setSortMode('default')}>默认排序</button>
              <button type="button" className={sortMode === 'popular' ? 'active' : ''} onClick={() => setSortMode('popular')}>按人气排序</button>
            </div>
            {galleryMessage && <p className="gallery-message" role="status">{galleryMessage}</p>}
          </div>
        </div>

        <div className="company-album-grid">
          {displayedAlbums.map((album) => <CompanyAlbumCard
            key={album.name}
            album={album}
            items={galleryItems.filter((item) => item.company === album.name)}
            likes={companyLikes[album.name] || 0}
            liked={likedCompanies.includes(album.name)}
            liking={likingCompany === album.name}
            onLike={() => likeCompany(album.name)}
          />)}
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
              <button className="primary-button" disabled={busy}>{busy ? '正在优化并上传…' : '上传素材并生成代码'}<span>→</span></button>
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

      <footer><span>© 2026 中科曙光应届生集训项目 · 荣聚曙光，梦想起航</span><a href="/admin">管理员入口</a></footer>

      <dialog ref={successRef} className="success-dialog" aria-labelledby="success-title" onClose={() => setCreatedCredential('')}>
          <div className="success-card">
            <button type="button" className="success-close" onClick={closeSuccess} aria-label="关闭上传成功提示">×</button>
            <span className="success-mark">✓</span>
            <p className="eyebrow">UPLOAD COMPLETE</p>
            <h2 id="success-title">这一刻，已经收好。</h2>
            <p>系统已自动生成专属上传码。请立即截图或复制保存，丢失后将无法找回或修改投稿。</p>
            <button className="credential-card" onClick={copyCredential}><code>{createdCredential}</code><small>{copyMessage}</small></button>
            <button className="primary-button" onClick={viewCreatedSubmission}>现在查看投稿 <span>→</span></button>
          </div>
      </dialog>

      <dialog ref={shareRef} className="success-dialog share-dialog" aria-labelledby="share-title" onClose={() => setShareMessage('')}>
        <div className="success-card share-card">
          <button type="button" className="success-close" onClick={() => shareRef.current?.close()} aria-label="关闭分享窗口">×</button>
          <p className="eyebrow">SHARE THIS PAGE</p>
          <h2 id="share-title">扫码查看集训风采</h2>
          <img src="/share-qr.png" alt="中科曙光 2026 届应届生集训宣传平台二维码" width="512" height="512" />
          <code>{SHARE_URL}</code>
          <div className="share-actions">
            <button type="button" onClick={copyShareLink}>复制链接</button>
            <button type="button" onClick={sharePage}>系统分享 / 微信</button>
          </div>
          <p className="share-note" role="status">{shareMessage || '若系统分享面板中有微信，可直接选择；也可长按识别二维码。'}</p>
        </div>
      </dialog>
    </main>
  );
}

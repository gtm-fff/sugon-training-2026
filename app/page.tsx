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
const BROWSER_CREDENTIAL_KEY = 'sugon-training-upload-code';
const AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/wave'];
const VISUAL_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp', 'video/mp4', 'video/quicktime', 'video/webm'];
const MEMORY_EFFECTS = ['memory-fade', 'memory-zoom-in', 'memory-zoom-out', 'memory-pan-left', 'memory-pan-right'];

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
  media: SubmissionMedia[];
  song: CompanySong | null;
};

type SubmissionMedia = {
  id: string;
  imageName: string;
  mediaType: string;
  imageSize: number;
  position: number;
};

type GalleryItem = {
  id: string;
  submissionId: string;
  company: string;
  title: string;
  description: string;
  mediaType: string;
  createdAt: string;
  updatedAt: string;
};

type CompanySong = {
  company: string;
  name: string;
  mediaType: string;
  size: number;
  updatedAt: string;
};

type CompanyAlbum = (typeof COMPANY_ALBUMS)[number];

function CompanyAlbumCard({ album, items, song, likes, liked, liking, onLike }: {
  album: CompanyAlbum;
  items: GalleryItem[];
  song?: CompanySong;
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
  const [effectIndex, setEffectIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const previewRef = useRef<HTMLDialogElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const cover = media[0];
  const active = media[index];
  const imageAlt = `${album.name}${active.isDemo ? '演示封面' : active.title || '投稿素材'}`;

  function move(delta: number) {
    setEffectIndex((current) => (current + 1 + Math.floor(Math.random() * (MEMORY_EFFECTS.length - 1))) % MEMORY_EFFECTS.length);
    setIndex((current) => (current + delta + media.length) % media.length);
  }

  useEffect(() => {
    if (!playing || media.length < 2) return;
    const timer = window.setInterval(() => move(1), 4500);
    return () => window.clearInterval(timer);
  }, [playing, media.length]);

  function openPreview() {
    setIndex(0);
    setEffectIndex(Math.floor(Math.random() * MEMORY_EFFECTS.length));
    previewRef.current?.showModal();
    setPlaying(true);
    setAudioBlocked(false);
    if (song) void audioRef.current?.play().catch(() => setAudioBlocked(true));
  }

  function stopPreview() {
    setPlaying(false);
    audioRef.current?.pause();
  }

  function togglePlaying() {
    if (playing) {
      stopPreview();
      return;
    }
    setPlaying(true);
    setAudioBlocked(false);
    if (song) void audioRef.current?.play().catch(() => setAudioBlocked(true));
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
        <span className="company-album-position">{items.length} 份素材&nbsp; →</span>
      </div>
      <dialog ref={previewRef} className="image-lightbox" onClose={stopPreview} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
        <button type="button" className="image-lightbox-close" onClick={() => previewRef.current?.close()} aria-label="关闭相册">×</button>
        <div className="image-lightbox-media">
          {active.mediaType.startsWith('video/')
            ? <video key={active.id} className={playing ? MEMORY_EFFECTS[effectIndex] : ''} src={active.url} aria-label={imageAlt} controls muted autoPlay={playing} playsInline preload="metadata" />
            : <img key={active.id} className={playing ? MEMORY_EFFECTS[effectIndex] : ''} src={active.url} alt={imageAlt} />}
          {media.length > 1 && <>
            <button type="button" className="image-lightbox-prev" onClick={() => move(-1)} aria-label={`${album.name}上一份素材`}>←</button>
            <button type="button" className="image-lightbox-next" onClick={() => move(1)} aria-label={`${album.name}下一份素材`}>→</button>
          </>}
        </div>
        <div className="image-lightbox-caption">
          <span>{album.number} / {album.name} · {String(index + 1).padStart(2, '0')} / {String(media.length).padStart(2, '0')}</span>
          <h3>{active.title || '未填写素材标题'}</h3>
          <p>{active.description || '未填写故事说明'}</p>
          <div className="memory-controls">
            <button type="button" onClick={togglePlaying}>{playing ? '❚❚ 暂停回忆' : '▶ 继续播放'}</button>
            <small>{song ? `♫ ${song.name}${audioBlocked ? ' · 点击播放以开启声音' : ''}` : '暂无队歌 · 正在无声播放'}</small>
          </div>
        </div>
        {song && <audio ref={audioRef} src={`/api/gallery/${encodeURIComponent(album.name)}/song?v=${song.updatedAt}`} loop preload="metadata" />}
      </dialog>
      <div className="company-album-copy">
        <div><span>COMPANY {album.number}</span><small>{song ? '♫ 已设置队歌' : `${items.length} 份素材`}</small></div>
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
      display: file.type === 'image/gif' ? null : await encodeImageVariant(bitmap, 2560, MAX_DISPLAY_IMAGE_SIZE, 'display.webp'),
      thumbnail: await encodeImageVariant(bitmap, 720, MAX_THUMBNAIL_SIZE, 'thumbnail.webp'),
    };
  } finally {
    bitmap.close();
  }
}

async function appendMedia(data: FormData, files: File[]) {
  const visualFiles = files.filter((file) => !file.type.startsWith('audio/'));
  const song = files.find((file) => file.type.startsWith('audio/'));
  if (visualFiles.length) data.set('media_count', String(visualFiles.length));
  if (song) data.set('song', song);
  for (let index = 0; index < visualFiles.length; index += 1) {
    const file = visualFiles[index];
    data.set(`image_${index}`, file);
    const variants = await createImageVariants(file);
    if (variants?.display) data.set(`display_${index}`, variants.display);
    if (variants?.thumbnail) data.set(`thumbnail_${index}`, variants.thumbnail);
  }
}

function MediaPicker({ files, onChange, currentMedia = [] }: {
  files: File[];
  onChange: (files: File[]) => void;
  currentMedia?: Array<{ id: string; url: string; mediaType: string; imageName: string }>;
}) {
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => previews.forEach((item) => URL.revokeObjectURL(item.url)), [previews]);
  useEffect(() => {
    if (!files.length && inputRef.current) inputRef.current.value = '';
  }, [files.length]);

  function pick(event: ChangeEvent<HTMLInputElement>) {
    onChange(Array.from(event.target.files || []));
  }

  const visibleMedia = files.length
    ? previews.map((item, index) => ({ id: String(index), url: item.url, mediaType: item.file.type, imageName: item.file.name }))
    : currentMedia;

  return (
    <div className="media-picker">
      <label className={`dropzone ${visibleMedia.length ? 'has-preview' : ''}`}>
        {visibleMedia.length ? <span className="media-preview-grid">{visibleMedia.map((item) => item.mediaType.startsWith('audio/')
          ? <span className="audio-preview" key={item.id}>♫<small>{item.imageName}</small></span>
          : item.mediaType.startsWith('video/')
            ? <video key={item.id} src={item.url} aria-label={item.imageName} muted playsInline preload="metadata" />
            : <img key={item.id} src={item.url} alt={item.imageName} />)}</span> : <span className="dropzone-mark">＋</span>}
        <span className="dropzone-copy">
          <strong>{files.length ? `已选择 ${files.length} 份素材` : currentMedia.length ? '点击替换素材或队歌' : '选择图片、视频或一首队歌'}</strong>
          <small>{files.length ? `${formatBytes(files.reduce((sum, file) => sum + file.size, 0))} · 合计` : '最多 9 张图片 / 1 个视频 / 1 首音频；合计不超过 25MB'}</small>
        </span>
        <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/bmp,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/wave,.mp3,.m4a,.aac,.wav" onChange={pick} />
      </label>
      {files.length > 0 && <div className="selected-media-list">{files.map((file, index) => <button type="button" key={`${file.name}-${file.lastModified}`} onClick={() => onChange(files.filter((_, itemIndex) => itemIndex !== index))}>移除 {file.name}</button>)}</div>}
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState<'upload' | 'manage'>('upload');
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [company, setCompany] = useState('一连');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [credential, setCredential] = useState('');
  const [browserCredential, setBrowserCredential] = useState('');
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [createdCredential, setCreatedCredential] = useState('');
  const [copyMessage, setCopyMessage] = useState('点击复制上传码');
  const [shareMessage, setShareMessage] = useState('');
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [galleryLoaded, setGalleryLoaded] = useState(false);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [companyLikes, setCompanyLikes] = useState<Record<string, number>>({});
  const [companySongs, setCompanySongs] = useState<Record<string, CompanySong>>({});
  const [likedCompanies, setLikedCompanies] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<'default' | 'popular'>('default');
  const [likingCompany, setLikingCompany] = useState('');
  const [galleryMessage, setGalleryMessage] = useState('');
  const successRef = useRef<HTMLDialogElement>(null);
  const shareRef = useRef<HTMLDialogElement>(null);
  const displayedAlbums = useMemo(() => sortMode === 'default' ? COMPANY_ALBUMS : [...COMPANY_ALBUMS].sort(
    (left, right) => (companyLikes[right.name] || 0) - (companyLikes[left.name] || 0) || Number(left.number) - Number(right.number),
  ), [sortMode, companyLikes]);

  async function loadGallery() {
    try {
      const response = await fetch('/api/gallery');
      const data = (await response.json()) as { items?: GalleryItem[]; submissionCount?: number; songs?: Record<string, CompanySong>; likes?: Record<string, number>; likedCompanies?: string[] };
      setGalleryItems(data.items || []);
      setSubmissionCount(data.submissionCount ?? data.items?.length ?? 0);
      setCompanySongs(data.songs || {});
      setCompanyLikes(data.likes || {});
      setLikedCompanies(data.likedCompanies || []);
    } catch {
      setGalleryItems([]);
    } finally {
      setGalleryLoaded(true);
    }
  }

  useEffect(() => { void loadGallery(); }, []);

  useEffect(() => {
    const code = window.localStorage.getItem(BROWSER_CREDENTIAL_KEY) || '';
    if (!code) return;
    fetch(`/api/submissions/${encodeURIComponent(code)}`)
      .then(async (response) => ({ ok: response.ok, data: await response.json() as Submission }))
      .then(({ ok, data }) => {
        if (!ok) {
          window.localStorage.removeItem(BROWSER_CREDENTIAL_KEY);
          return;
        }
        setBrowserCredential(code);
        setCredential(code);
        setSubmission(data);
        setCompany(data.company);
        setTitle(data.title);
        setDescription(data.description);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (createdCredential && !successRef.current?.open) successRef.current?.showModal();
  }, [createdCredential]);

  function resetFeedback() {
    setMessage('');
    setCreatedCredential('');
  }

  function bindCredential(code: string) {
    window.localStorage.setItem(BROWSER_CREDENTIAL_KEY, code);
    setBrowserCredential(code);
    setCredential(code);
  }

  function clearBrowserBinding() {
    window.localStorage.removeItem(BROWSER_CREDENTIAL_KEY);
    setBrowserCredential('');
    setCredential('');
    setSubmission(null);
    setFiles([]);
    setMessage('已解除本浏览器的上传码绑定');
  }

  function validateMedia(selectedFiles: File[], required = true) {
    const visualFiles = selectedFiles.filter((file) => !file.type.startsWith('audio/'));
    const audioFiles = selectedFiles.filter((file) => file.type.startsWith('audio/'));
    if (!selectedFiles.length && required) return '请选择照片、视频或音频';
    if (visualFiles.length > 9) return '一次最多上传 9 张图片';
    if (audioFiles.length > 1) return '每次只能上传一首队歌';
    if (selectedFiles.reduce((sum, file) => sum + file.size, 0) > MAX_FILE_SIZE) return '本次上传文件总大小超过 25MB';
    if (visualFiles.some((file) => !VISUAL_TYPES.includes(file.type)) || audioFiles.some((file) => !AUDIO_TYPES.includes(file.type))) return '只支持常见图片、MP4/MOV/WebM、MP3/M4A/AAC/WAV';
    if (visualFiles.some((file) => file.type.startsWith('video/')) && visualFiles.length > 1) return '视频不能与图片混传，但可以同时设置一首队歌';
    return '';
  }

  async function upload(event: FormEvent) {
    event.preventDefault();
    resetFeedback();
    const imageError = validateMedia(files);
    if (imageError) return setMessage(imageError);
    const data = new FormData();
    data.set('company', company);
    data.set('title', title);
    data.set('description', description);
    if (browserCredential) data.set('append', '1');
    setBusy(true);
    try {
      await appendMedia(data, files);
      const response = await fetch(browserCredential ? `/api/submissions/${encodeURIComponent(browserCredential)}` : '/api/submissions', {
        method: browserCredential ? 'PUT' : 'POST',
        body: data,
      });
      const result = (await response.json()) as Submission & { credential?: string; submission?: Submission; error?: string };
      if (!response.ok) throw new Error(result.error || '上传失败');
      const code = result.credential || browserCredential;
      const savedSubmission = result.submission || result;
      bindCredential(code);
      setCopyMessage('点击复制上传码');
      setCreatedCredential(code);
      setSubmission(savedSubmission);
      await loadGallery();
      setFiles([]);
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
      bindCredential(normalized);
      setSubmission(result);
      setCompany(result.company);
      setTitle(result.title);
      setDescription(result.description);
      setFiles([]);
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
    const imageError = validateMedia(files, false);
    if (imageError) return setMessage(imageError);
    const data = new FormData();
    data.set('company', company);
    data.set('title', title);
    data.set('description', description);
    setBusy(true);
    try {
      if (files.length) await appendMedia(data, files);
      const response = await fetch(`/api/submissions/${encodeURIComponent(credential)}`, { method: 'PUT', body: data });
      const result = (await response.json()) as Submission & { error?: string };
      if (!response.ok) throw new Error(result.error || '保存失败');
      setSubmission(result);
      setFiles([]);
      setMessage('修改已保存');
      await loadGallery();
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
    setCompanyLikes((current) => ({ ...current, [company]: (current[company] || 0) + 1 }));
    setLikedCompanies((current) => current.includes(company) ? current : [...current, company]);
    setGalleryMessage(`已为${company}点赞`);
    try {
      const response = await fetch('/api/gallery/like', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ company }),
      });
      const result = await response.json() as { likes?: number; added?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || '点赞失败');
      setCompanyLikes((current) => ({ ...current, [company]: result.likes ?? current[company] ?? 0 }));
      setGalleryMessage(result.added ? `已为${company}点赞` : `你已经赞过${company}`);
    } catch (error) {
      setCompanyLikes((current) => ({ ...current, [company]: Math.max(0, (current[company] || 1) - 1) }));
      setLikedCompanies((current) => current.filter((item) => item !== company));
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
          <p className="hero-intro">记录新曙光人的成长时刻。无需注册，上传码会固定在当前浏览器；照片、视频和队歌都能持续追加。</p>
          <div className="hero-actions">
            <a href="#gallery">浏览连队风采</a>
            <button type="button" onClick={() => openWorkspace('upload')}>上传我的瞬间&nbsp; →</button>
            <button type="button" onClick={openShare}>分享页面</button>
          </div>
          <div className="hero-facts">
            <span><strong>16</strong> 青春连队</span>
            <span><strong>{galleryLoaded ? submissionCount : '—'}</strong> 总投稿数</span>
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
            <p>点击任意连队，即可伴随队歌自动播放照片、视频和故事。</p>
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
            song={companySongs[album.name]}
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
            <span>上传照片、视频或队歌；同一浏览器会持续追加到同一投稿。</span>
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
            <li className={mode === 'manage' ? 'active' : ''}><b>02</b><span>获得上传码<br /><small>随时查询修改</small></span></li>
          </ol>
          <div className="demo-note"><strong>上传完成后自动生成</strong><code>XXXX-XXXX-XXXX</code><small>请截图或复制保存</small></div>
        </div>

        <div className="form-panel">
          <div className="mode-tabs" role="tablist" aria-label="投稿功能">
            <button className={mode === 'upload' ? 'active' : ''} onClick={() => switchMode('upload')}>{browserCredential ? '继续投稿' : '上传新内容'}</button>
            <button className={mode === 'manage' ? 'active' : ''} onClick={() => switchMode('manage')}>查询 / 修改</button>
          </div>

          {mode === 'upload' ? (
            <form onSubmit={upload} className="content-form">
              <div className="panel-heading"><span>01</span><div><h2>{browserCredential ? '继续添加集训素材' : '提交你的集训瞬间'}</h2><p>{browserCredential ? '新素材会追加到本浏览器已经绑定的投稿中。' : '首次完成后，上传码会自动固定在当前浏览器。'}</p></div></div>
              {browserCredential && <div className="browser-binding"><span>本浏览器上传码</span><code>{browserCredential}</code><button type="button" onClick={clearBrowserBinding}>解除绑定</button></div>}
              <label><span>所属连队 *</span><select value={company} onChange={(e) => setCompany(e.target.value)}>{COMPANIES.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>素材标题</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="给这个瞬间起个名字（选填）" /></label>
              <label><span>故事说明</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="写下当时发生了什么（选填）" /></label>
              <MediaPicker files={files} onChange={setFiles} />
              {message && <p className="form-message error" role="alert">{message}</p>}
              <button className="primary-button" disabled={busy}>{busy ? '正在优化并上传…' : browserCredential ? '继续添加到此投稿' : '上传素材并固定代码'}<span>→</span></button>
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
              <MediaPicker files={files} onChange={setFiles} currentMedia={[
                ...submission.media.map((item) => ({
                  id: item.id,
                  url: `/api/submissions/${encodeURIComponent(credential)}/image?media=${encodeURIComponent(item.id)}&v=${submission.updatedAt}`,
                  mediaType: item.mediaType,
                  imageName: item.imageName,
                })),
                ...(submission.song ? [{
                  id: 'song',
                  url: `/api/submissions/${encodeURIComponent(credential)}/image?song=1&v=${submission.song.updatedAt}`,
                  mediaType: submission.song.mediaType,
                  imageName: `队歌：${submission.song.name}`,
                }] : []),
              ]} />
              {message && <p className={`form-message ${message.includes('保存') ? 'success' : 'error'}`}>{message}</p>}
              <div className="button-row"><button type="button" className="text-button" onClick={clearBrowserBinding}>解除并换码</button><button className="primary-button" disabled={busy}>{busy ? '正在保存…' : '保存修改'}<span>→</span></button></div>
            </form>
          ) : (
            <form onSubmit={lookup} className="content-form lookup-form">
              <div className="panel-heading"><span>03</span><div><h2>找回并修改投稿</h2><p>输入上传成功后自动生成的上传码，无需登录账号。</p></div></div>
              <label><span>上传码 *</span><input className="credential-input" value={credential} onChange={(e) => setCredential(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX" autoComplete="off" /></label>
              {message && <p className="form-message error" role="alert">{message}</p>}
              <button className="primary-button" disabled={busy}>{busy ? '正在查询…' : '查询我的投稿'}<span>→</span></button>
              <p className="privacy-note">查询成功后会把该上传码固定在当前浏览器；清理浏览器数据后仍可手动输入找回。</p>
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
            <p>上传码已固定在当前浏览器，之后上传会继续追加到同一投稿。仍建议复制保存，便于换设备找回。</p>
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

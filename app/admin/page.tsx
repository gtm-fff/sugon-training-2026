'use client';

import { FormEvent, useEffect, useState } from 'react';

const COMPANIES = [
  '一连', '二连', '三连', '四连', '五连', '六连', '七连', '八连',
  '九连', '十连', '十一连', '十二连', '十三连', '十四连', '十五连', '十六连',
];
const requestedRole = window.location.pathname.startsWith('/company-admin') ? 'company' : 'system';

type Identity = { role: 'system' | 'company'; company: string };
type Submission = {
  id: string; company: string; title: string; description: string; imageName: string;
  mediaType: string; imageSize: number; mediaCount?: number; createdAt: string; updatedAt: string;
};
type CompanyAdmin = { company: string; username: string; updatedAt: string };
type Song = { company: string; name: string; mediaType: string; size: number; updatedAt: string };

function size(bytes: number) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [companyFilter, setCompanyFilter] = useState('');
  const [editing, setEditing] = useState<Submission | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, usedSpace: 0, companyCount: 0 });
  const [songCompany, setSongCompany] = useState('一连');
  const [song, setSong] = useState<Song | null>(null);
  const [songFile, setSongFile] = useState<File | null>(null);
  const [companyAdmins, setCompanyAdmins] = useState<CompanyAdmin[]>([]);
  const [revealedPassword, setRevealedPassword] = useState('');
  const managedCompany = identity?.role === 'company' ? identity.company : songCompany;

  async function loadData(reset = true) {
    setLoading(true);
    try {
      const search = new URLSearchParams({ limit: '48', offset: String(reset ? 0 : submissions.length) });
      if (identity?.role === 'system' && companyFilter) search.set('company', companyFilter);
      const response = await fetch(`/api/admin/submissions?${search}`);
      if (response.status === 401 || response.status === 403) return setAuthenticated(false);
      const data = await response.json() as {
        submissions: Submission[]; hasMore: boolean; filteredTotal: number;
        stats: { total: number; usedSpace: number; companyCount: number };
      };
      setSubmissions((current) => reset ? data.submissions : [...current, ...data.submissions]);
      setHasMore(data.hasMore);
      setFilteredTotal(data.filteredTotal);
      setStats(data.stats);
      if (reset) setSelected([]);
    } catch {
      setMessage('投稿列表加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  async function loadSong(company = managedCompany) {
    if (!company) return;
    const response = await fetch(`/api/admin/song?company=${encodeURIComponent(company)}`);
    const data = await response.json() as { song?: Song | null };
    if (response.ok) setSong(data.song || null);
  }

  async function loadCompanyAdmins() {
    const response = await fetch('/api/admin/company-admins');
    if (!response.ok) return;
    const data = await response.json() as { admins: CompanyAdmin[] };
    setCompanyAdmins(data.admins);
  }

  useEffect(() => {
    fetch('/api/admin/session').then(async (response) => {
      if (!response.ok) return setAuthenticated(false);
      const data = await response.json() as Identity;
      if (data.role !== requestedRole) return setAuthenticated(false);
      setIdentity(data);
      setSongCompany(data.company || '一连');
      setAuthenticated(true);
    });
  }, []);

  useEffect(() => {
    if (!authenticated || !identity) return;
    void loadData(true);
    void loadSong(identity.role === 'company' ? identity.company : songCompany);
    if (identity.role === 'system') void loadCompanyAdmins();
  }, [authenticated, identity, companyFilter, songCompany]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const response = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password, mode: requestedRole }),
    });
    const data = await response.json() as Identity & { error?: string };
    if (!response.ok) setMessage(data.error || '登录失败');
    else {
      setIdentity(data);
      setSongCompany(data.company || '一连');
      setAuthenticated(true);
      setPassword('');
    }
    setBusy(false);
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    setIdentity(null);
    setAuthenticated(false);
  }

  async function deleteItems(ids: string[]) {
    if (!ids.length || !window.confirm(`确定删除选中的 ${ids.length} 份投稿吗？此操作无法撤销。`)) return;
    setBusy(true);
    const response = await fetch('/api/admin/submissions', {
      method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids }),
    });
    const data = await response.json() as { error?: string; deleted?: number };
    setMessage(response.ok ? `已删除 ${data.deleted} 份投稿` : data.error || '删除失败');
    setSelected([]);
    await loadData(true);
    setBusy(false);
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    const response = await fetch(`/api/admin/submissions/${editing.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ company: editing.company, title: editing.title, description: editing.description }),
    });
    const data = await response.json() as { error?: string };
    setMessage(response.ok ? '投稿信息已保存' : data.error || '保存失败');
    if (response.ok) setEditing(null);
    await loadData(true);
    setBusy(false);
  }

  async function uploadSong(event: FormEvent) {
    event.preventDefault();
    if (!songFile) return setMessage('请选择队歌文件');
    setBusy(true);
    const form = new FormData();
    form.set('company', managedCompany);
    form.set('song', songFile);
    const response = await fetch('/api/admin/song', { method: 'POST', body: form });
    const data = await response.json() as { song?: Song; error?: string };
    setMessage(response.ok ? `${managedCompany}队歌已保存` : data.error || '队歌上传失败');
    if (response.ok) { setSong(data.song || null); setSongFile(null); }
    setBusy(false);
  }

  async function deleteSong() {
    if (!song || !window.confirm(`确定删除${managedCompany}队歌吗？`)) return;
    setBusy(true);
    const response = await fetch(`/api/admin/song?company=${encodeURIComponent(managedCompany)}`, { method: 'DELETE' });
    const data = await response.json() as { error?: string };
    setMessage(response.ok ? `${managedCompany}队歌已删除` : data.error || '删除失败');
    if (response.ok) setSong(null);
    setBusy(false);
  }

  async function resetCompanyPassword(company: string) {
    setBusy(true);
    const response = await fetch(`/api/admin/company-admins/${encodeURIComponent(company)}/reset`, { method: 'POST' });
    const data = await response.json() as { username?: string; defaultPassword?: string; error?: string };
    setRevealedPassword(response.ok ? `${company}：${data.username} / ${data.defaultPassword}` : data.error || '重置失败');
    setBusy(false);
  }

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  if (authenticated === null) return <main className="admin-loading">正在进入管理后台…</main>;

  if (!authenticated) {
    const companyMode = requestedRole === 'company';
    return <main className="admin-login-shell"><a className="admin-back" href="/">← 返回匿名投稿</a><section className="admin-login-card">
      <div className="admin-login-brand"><span>26</span><p><b>Sugon 中科曙光</b><small>TRAINING ADMIN CONSOLE</small></p></div>
      <p className="eyebrow"><span /> {companyMode ? '连队管理员' : '系统管理员'}</p><h1>{companyMode ? '管理本连队素材' : '管理全部集训素材'}</h1>
      <p>{companyMode ? '仅可查看、修改和删除所属连队投稿，并维护本连队队歌。' : '管理全站投稿、队歌和十六个连队管理员账号。'}</p>
      <form onSubmit={login}><label><span>管理员账号</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label>
        <label><span>管理员密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
        {message && <p className="admin-message error">{message}</p>}<button className="admin-primary" disabled={busy}>{busy ? '正在登录…' : '进入管理后台'} <span>→</span></button></form>
      <a className="admin-mode-switch" href={companyMode ? '/admin' : '/company-admin'}>切换到{companyMode ? '系统管理员' : '连队管理员'}登录</a>
    </section></main>;
  }

  const companyMode = identity?.role === 'company';
  const exportUrl = `/api/admin/export${!companyMode && companyFilter ? `?company=${encodeURIComponent(companyFilter)}` : ''}`;
  return <main className="admin-shell"><aside className="admin-sidebar">
    <a href="/" className="admin-logo"><span>26</span><p><b>Sugon 中科曙光</b><small>{companyMode ? `${identity.company} ADMIN` : 'SYSTEM ADMIN'}</small></p></a>
    <nav><a className="active" href="#submissions">投稿管理</a><a href="#song">队歌管理</a>{!companyMode && <a href="#company-admins">连队管理员</a>}<a href={exportUrl}>导出素材</a></nav><button onClick={logout}>退出登录</button>
  </aside><div className="admin-main">
    <header className="admin-header"><div><p>SUGON GRADUATE TRAINING / 2026</p><h1>{companyMode ? `${identity.company}素材管理` : '系统管理后台'}</h1></div><a href="/" target="_blank">打开展示页 ↗</a></header>
    <section className="stat-grid"><article><span>总投稿</span><strong>{stats.total}</strong><small>份投稿</small></article><article><span>已用空间</span><strong>{(stats.usedSpace / 1024 / 1024).toFixed(2)}</strong><small>MB</small></article><article><span>连队覆盖</span><strong>{stats.companyCount}<i>/{companyMode ? 1 : 16}</i></strong><small>已有投稿</small></article></section>
    {message && <p className="admin-message">{message}<button onClick={() => setMessage('')}>×</button></p>}

    <section className="admin-section" id="submissions"><div className="section-title"><div><span>01</span><h2>投稿管理</h2></div><p>{filteredTotal} 份投稿</p></div>
      <div className="admin-toolbar">{!companyMode ? <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)}><option value="">全部连队</option>{COMPANIES.map((item) => <option key={item}>{item}</option>)}</select> : <span className="company-chip">{identity.company}</span>}
        <div className="toolbar-actions">{selected.length > 0 && <button className="danger-button" disabled={busy} onClick={() => deleteItems(selected)}>删除所选 ({selected.length})</button>}<a className="export-button" href={exportUrl}>导出 ZIP ↓</a></div></div>
      {submissions.length ? <div className="submission-grid">{submissions.map((item) => <article className={`submission-card ${selected.includes(item.id) ? 'selected' : ''}`} key={item.id}>
        <label className="select-box"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} /><span /></label>
        {item.mediaType.startsWith('audio/') ? <div className="admin-audio-cover"><b>♫</b><span>历史队歌投稿</span></div> : item.mediaType.startsWith('video/') ? <video src={`/api/admin/submissions/${item.id}/image?v=${item.updatedAt}`} controls muted playsInline preload="none" /> : <img src={`/api/gallery/${item.id}/thumbnail?v=${item.updatedAt}`} alt={item.title || '集训投稿'} loading="lazy" decoding="async" width="720" height="480" />}
        <div className="submission-copy"><span className="company-chip">{item.company}</span><h3>{item.title || '未填写标题'}</h3><p>{item.description || '没有文字说明'}</p><small>{item.mediaCount || 1} 份素材 · {size(item.imageSize)} · {new Date(item.createdAt).toLocaleDateString('zh-CN')}</small><div><button onClick={() => setEditing({ ...item })}>编辑</button><button className="danger-text" onClick={() => deleteItems([item.id])}>删除</button></div></div>
      </article>)}</div> : <div className="empty-state"><strong>还没有投稿</strong><p>匿名投稿成功后会自动出现在这里。</p></div>}
      {hasMore && <button className="load-more" disabled={loading} onClick={() => loadData(false)}>{loading ? '正在加载…' : `加载更多（已显示 ${submissions.length} / ${filteredTotal}）`}</button>}
    </section>

    <section className="admin-section" id="song"><div className="section-title"><div><span>02</span><h2>队歌管理</h2></div><p>仅管理员可修改</p></div><div className="song-manager">
      {!companyMode && <select value={songCompany} onChange={(event) => setSongCompany(event.target.value)}>{COMPANIES.map((item) => <option key={item}>{item}</option>)}</select>}
      <div className="song-current"><b>{song ? `♫ ${song.name}` : `${managedCompany}暂未设置队歌`}</b>{song && <small>{size(song.size)}</small>}</div>
      <form onSubmit={uploadSong}><input type="file" accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/x-wav,audio/wave,.mp3,.m4a,.aac,.wav" onChange={(event) => setSongFile(event.target.files?.[0] || null)} /><button className="admin-primary" disabled={busy}>{song ? '替换队歌' : '上传队歌'} <span>→</span></button></form>
      {song && <button className="danger-button" disabled={busy} onClick={deleteSong}>删除当前队歌</button>}
    </div></section>

    {!companyMode && <section className="admin-section" id="company-admins"><div className="section-title"><div><span>03</span><h2>连队管理员</h2></div><p>默认账号 company01～company16</p></div>
      {revealedPassword && <p className="admin-credential"><b>默认登录信息</b><code>{revealedPassword}</code><small>请复制后单独发给对应连队管理员</small></p>}
      <div className="company-admin-grid">{companyAdmins.map((admin) => <article key={admin.company}><span>{admin.company}</span><code>{admin.username}</code><button disabled={busy} onClick={() => resetCompanyPassword(admin.company)}>查看 / 重置默认密码</button></article>)}</div>
    </section>}
  </div>

  {editing && <div className="modal-backdrop" role="dialog" aria-modal="true"><form className="admin-edit-card" onSubmit={saveEdit}><button type="button" className="modal-close" onClick={() => setEditing(null)}>×</button><p className="eyebrow"><span /> EDIT SUBMISSION</p><h2>编辑投稿信息</h2>
    <label><span>所属连队</span>{companyMode ? <input value={identity.company} disabled /> : <select value={editing.company} onChange={(event) => setEditing({ ...editing, company: event.target.value })}>{COMPANIES.map((item) => <option key={item}>{item}</option>)}</select>}</label>
    <label><span>标题</span><input value={editing.title} maxLength={60} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label><label><span>说明</span><textarea value={editing.description} maxLength={300} onChange={(event) => setEditing({ ...editing, description: event.target.value })} /></label><button className="admin-primary" disabled={busy}>{busy ? '正在保存…' : '保存修改'} <span>→</span></button>
  </form></div>}
  </main>;
}

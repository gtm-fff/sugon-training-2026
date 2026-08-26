'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

const COMPANIES = [
  '一连', '二连', '三连', '四连', '五连', '六连', '七连', '八连',
  '九连', '十连', '十一连', '十二连', '十三连', '十四连', '十五连', '十六连',
];

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

function size(bytes: number) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [companyFilter, setCompanyFilter] = useState('');
  const [editing, setEditing] = useState<Submission | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const visible = useMemo(
    () => companyFilter ? submissions.filter((item) => item.company === companyFilter) : submissions,
    [submissions, companyFilter],
  );
  const usedSpace = submissions.reduce((sum, item) => sum + item.imageSize, 0);
  const companyCount = new Set(submissions.map((item) => item.company)).size;

  async function loadData() {
    const submissionResponse = await fetch('/api/admin/submissions');
    if (submissionResponse.status === 401) {
      setAuthenticated(false);
      return;
    }
    const submissionData = await submissionResponse.json() as { submissions: Submission[] };
    setSubmissions(submissionData.submissions);
  }

  useEffect(() => {
    fetch('/api/admin/session').then(async (response) => {
      setAuthenticated(response.ok);
      if (response.ok) await loadData();
    });
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) {
      setMessage(data.error || '登录失败');
      setBusy(false);
      return;
    }
    setAuthenticated(true);
    setPassword('');
    await loadData();
    setBusy(false);
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthenticated(false);
  }

  async function deleteItems(ids: string[]) {
    if (!ids.length || !window.confirm(`确定删除选中的 ${ids.length} 份投稿吗？此操作无法撤销。`)) return;
    setBusy(true);
    const response = await fetch('/api/admin/submissions', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    const data = await response.json() as { error?: string; deleted?: number };
    setMessage(response.ok ? `已删除 ${data.deleted} 份投稿` : data.error || '删除失败');
    setSelected([]);
    await loadData();
    setBusy(false);
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    const response = await fetch(`/api/admin/submissions/${editing.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ company: editing.company, title: editing.title, description: editing.description }),
    });
    const data = await response.json() as { error?: string };
    setMessage(response.ok ? '投稿信息已保存' : data.error || '保存失败');
    if (response.ok) setEditing(null);
    await loadData();
    setBusy(false);
  }

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  if (authenticated === null) return <main className="admin-loading">正在进入管理后台…</main>;

  if (!authenticated) {
    return (
      <main className="admin-login-shell">
        <a className="admin-back" href="/">← 返回上传页面</a>
        <section className="admin-login-card">
          <div className="admin-login-brand"><span>26</span><p><b>Sugon 中科曙光</b><small>TRAINING ADMIN CONSOLE</small></p></div>
          <p className="eyebrow"><span /> 管理员专用</p>
          <h1>管理全部集训素材</h1>
          <p>查看、修改、删除投稿，并按连队批量导出全部素材。</p>
          <form onSubmit={login}>
            <label><span>管理员账号</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label>
            <label><span>管理员密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
            {message && <p className="admin-message error">{message}</p>}
            <button className="admin-primary" disabled={busy}>{busy ? '正在登录…' : '进入管理后台'} <span>→</span></button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <a href="/" className="admin-logo"><span>26</span><p><b>Sugon 中科曙光</b><small>TRAINING ADMIN</small></p></a>
        <nav><a className="active" href="#submissions">投稿管理</a><a href={`/api/admin/export${companyFilter ? `?company=${encodeURIComponent(companyFilter)}` : ''}`}>导出素材</a></nav>
        <button onClick={logout}>退出登录</button>
      </aside>

      <div className="admin-main">
        <header className="admin-header"><div><p>SUGON GRADUATE TRAINING / 2026</p><h1>集训素材管理</h1></div><a href="/" target="_blank">打开上传页 ↗</a></header>

        <section className="stat-grid">
          <article><span>总投稿</span><strong>{submissions.length}</strong><small>份素材</small></article>
          <article><span>已用空间</span><strong>{(usedSpace / 1024 / 1024).toFixed(2)}</strong><small>MB</small></article>
          <article><span>连队覆盖</span><strong>{companyCount}<i>/16</i></strong><small>已有投稿</small></article>
        </section>

        {message && <p className="admin-message">{message}<button onClick={() => setMessage('')}>×</button></p>}

        <section className="admin-section" id="submissions">
          <div className="section-title"><div><span>01</span><h2>投稿管理</h2></div><p>{visible.length} 份素材</p></div>
          <div className="admin-toolbar">
            <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)}><option value="">全部连队</option>{COMPANIES.map((item) => <option key={item}>{item}</option>)}</select>
            <div className="toolbar-actions">
              {selected.length > 0 && <button className="danger-button" disabled={busy} onClick={() => deleteItems(selected)}>删除所选 ({selected.length})</button>}
              <a className="export-button" href={`/api/admin/export${companyFilter ? `?company=${encodeURIComponent(companyFilter)}` : ''}`}>导出 ZIP ↓</a>
            </div>
          </div>

          {visible.length ? (
            <div className="submission-grid">
              {visible.map((item) => (
                <article className={`submission-card ${selected.includes(item.id) ? 'selected' : ''}`} key={item.id}>
                  <label className="select-box"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} /><span /></label>
                  {item.mediaType.startsWith('video/') ? (
                    <video src={`/api/admin/submissions/${item.id}/image?v=${item.updatedAt}`} controls muted playsInline />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/admin/submissions/${item.id}/image?v=${item.updatedAt}`} alt={item.title || '集训投稿'} />
                  )}
                  <div className="submission-copy">
                    <span className="company-chip">{item.company}</span>
                    <h3>{item.title || '未填写标题'}</h3>
                    <p>{item.description || '没有文字说明'}</p>
                    <small>{size(item.imageSize)} · {new Date(item.createdAt).toLocaleDateString('zh-CN')}</small>
                    <div><button onClick={() => setEditing({ ...item })}>编辑</button><button className="danger-text" onClick={() => deleteItems([item.id])}>删除</button></div>
                  </div>
                </article>
              ))}
            </div>
          ) : <div className="empty-state"><strong>还没有投稿</strong><p>从上传页面提交第一份素材后，这里会自动出现。</p></div>}
        </section>
      </div>

      {editing && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <form className="admin-edit-card" onSubmit={saveEdit}>
            <button type="button" className="modal-close" onClick={() => setEditing(null)}>×</button>
            <p className="eyebrow"><span /> EDIT SUBMISSION</p>
            <h2>编辑投稿信息</h2>
            <label><span>所属连队</span><select value={editing.company} onChange={(event) => setEditing({ ...editing, company: event.target.value })}>{COMPANIES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>标题</span><input value={editing.title} maxLength={60} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label>
            <label><span>说明</span><textarea value={editing.description} maxLength={300} onChange={(event) => setEditing({ ...editing, description: event.target.value })} /></label>
            <button className="admin-primary" disabled={busy}>{busy ? '正在保存…' : '保存修改'} <span>→</span></button>
          </form>
        </div>
      )}
    </main>
  );
}

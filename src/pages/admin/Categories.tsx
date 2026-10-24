import { type FormEvent, useState } from 'react';
import Icon from '../../components/Icon';
import { Alert, EmptyState, Loading, Spinner } from '../../components/common';
import { useUI } from '../../context/UIContext';
import { categoryApi, vocabularyApi } from '../../services';
import { apiErrorMessage } from '../../api/errors';
import type { CategoryResponse } from '../../models';
import { PageHead, useLoad } from './shared';

export default function AdminCategories() {
  const ui = useUI();
  const list = useLoad(async () => {
    const [cats, vocab] = await Promise.all([categoryApi.list(0, 200), vocabularyApi.list(0, 1000)]);
    return cats.content.map(c => ({ ...c, count: vocab.content.filter(v => v.categoryId === c.id).length }));
  });

  const edit = (c?: CategoryResponse) => ui.openModal(
    <CategoryForm category={c} onSaved={() => { ui.closeLayer(); list.reload(); ui.toast(c ? 'Topic updated' : 'Topic created'); }} />,
    c ? 'Edit topic' : 'New topic',
  );

  const remove = async (c: CategoryResponse & { count: number }) => {
    const ok = await ui.confirm({
      title: `Delete the topic “${c.name}”?`,
      body: c.count ? `It still holds ${c.count} ${c.count === 1 ? 'sign' : 'signs'}, and learners will lose this chapter.` : 'It has no signs yet.',
      confirmLabel: 'Delete topic', danger: true,
    });
    if (!ok) return;
    try { await categoryApi.remove(c.id); list.reload(); ui.toast('Topic deleted', 'trash'); }
    catch (err) { ui.toast(apiErrorMessage(err, 'Could not delete the topic'), 'alert'); }
  };

  return (
    <>
      <PageHead kicker="Admin · learning-service" title={<>Topics <em>&amp; chapters</em></>}>
        <button className="btn btn-lacquer btn-sm" onClick={() => edit()}><Icon name="plus" size={15} /> New topic</button>
      </PageHead>
      <p className="lede" style={{ marginTop: 0 }}>Each topic becomes a chapter on the learner’s journey, split into lessons of three signs.</p>
      {list.loading && !list.data ? <Loading /> : list.error ? <Alert>{list.error}</Alert> : list.data!.length === 0 ? (
        <EmptyState title="No topics yet" body="Create the first topic, then add signs to it." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th></th><th>Topic</th><th>Description</th><th>Signs</th><th></th></tr></thead>
            <tbody>
              {list.data!.map(c => (
                <tr key={c.id}>
                  <td style={{ width: 56 }}>{c.imageUrl ? <img className="thumb" src={c.imageUrl} alt="" /> : <span className="thumb" style={{ display: 'inline-block' }} />}</td>
                  <td className="word">{c.name}</td>
                  <td className="muted">{c.description}</td>
                  <td>{c.count}</td>
                  <td><div className="actions">
                    <button className="iconbtn" onClick={() => edit(c)} aria-label={`Edit ${c.name}`}><Icon name="edit" size={17} /></button>
                    <button className="iconbtn" onClick={() => remove(c)} aria-label={`Delete ${c.name}`}><Icon name="trash" size={17} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function CategoryForm({ category, onSaved }: { category?: CategoryResponse; onSaved: () => void }) {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [imageUrl, setImageUrl] = useState(category?.imageUrl || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('A topic needs a name.'); return; }
    setBusy(true); setError('');
    const body = { name: name.trim(), description: description.trim() || undefined, imageUrl: imageUrl.trim() || undefined };
    try {
      if (category) await categoryApi.update(category.id, body); else await categoryApi.create(body);
      onSaved();
    } catch (err) { setError(apiErrorMessage(err, 'Could not save the topic.')); setBusy(false); }
  };

  return (
    <form onSubmit={submit} noValidate>
      <p className="kicker">{category ? 'Edit topic' : 'New topic'}</p>
      <h2>{category ? category.name : 'Add a topic'}</h2>
      {error && <div style={{ margin: '12px 0' }}><Alert>{error}</Alert></div>}
      <div style={{ marginTop: 18 }}>
        <div className="field"><label htmlFor="cf-name">Name</label>
          <input id="cf-name" className="tinput" value={name} onChange={e => setName(e.target.value)} maxLength={255} placeholder="Greetings" autoFocus /></div>
        <div className="field"><label htmlFor="cf-desc">Description</label>
          <input id="cf-desc" className="tinput" value={description} onChange={e => setDescription(e.target.value)} maxLength={255} placeholder="The signs that open every conversation." /></div>
        <div className="field"><label htmlFor="cf-img">Image URL</label>
          <input id="cf-img" className="tinput" value={imageUrl} onChange={e => setImageUrl(e.target.value)} maxLength={500} placeholder="https://…" /></div>
      </div>
      <div className="form-actions"><button className="btn" disabled={busy}>{busy ? <Spinner /> : <Icon name="check" size={15} />} Save</button></div>
    </form>
  );
}

import { useEffect, useState } from 'react';
import { ArrowLeft, Clapperboard, ImagePlus, Pencil, Plus, Search } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { posterUrl } from '../lib/catalog';
import { supabase } from '../lib/supabase';
import { useAdminAuth } from './auth-context';
import { assertResult, uploadPoster } from './catalogue';
import { clearDraft, draftKey, readDraft, saveDraft } from './drafts';

const emptyMovie = { title: '', slug: '', tagline: '', synopsis: '', genre: '', rating: '', language: 'English', runtime_minutes: '', status: 'draft', featured: false, poster_path: '' };

export function AdminMovies() {
  const [movies, setMovies] = useState([]);
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: true, error: '' });
  useEffect(() => {
    let active = true;
    supabase.from('movies').select('id,slug,title,poster_path,genre,status,featured,updated_at')
      .order('updated_at', { ascending: false }).then(({ data, error }) => {
        if (active) { setMovies(data || []); setState({ loading: false, error: error?.message || '' }); }
      });
    return () => { active = false; };
  }, []);
  const shown = movies.filter((movie) => `${movie.title} ${movie.genre}`.toLowerCase().includes(query.toLowerCase()));
  return <main className="admin-content"><div className="admin-page-header admin-page-header--row"><div><p className="admin-overline">Catalogue / Films</p><h1>Movie library</h1><p>Build the stories guests will discover.</p></div>
    <Link className="admin-button admin-button--primary" to="/admin/movies/new"><Plus size={17} /> Add movie</Link></div>
    <div className="admin-toolbar"><label className="admin-search"><Search size={18} /><input placeholder="Search movies" value={query} onChange={(e) => setQuery(e.target.value)} /></label><span>{shown.length} movies</span></div>
    {state.error && <p className="admin-error" role="alert">{state.error}</p>}
    {state.loading ? <p>Loading movies…</p> : shown.length === 0 ? <div className="admin-empty"><Clapperboard size={32} /><h2>No movies found</h2><p>Add a film or adjust your search.</p></div> :
      <div className="admin-movie-grid">{shown.map((movie) => <Link to={`/admin/movies/${movie.id}`} className="admin-movie-card" key={movie.id}>
        <div className="admin-movie-art"><img src={posterUrl(movie.poster_path)} alt="" /><span className={`admin-status admin-status--${movie.status}`}>{movie.status}</span></div>
        <div><p>{movie.genre || 'Film'}</p><h2>{movie.title}</h2><span>{movie.featured ? 'Featured · ' : ''}Edit details <Pencil size={14} /></span></div></Link>)}</div>}
  </main>;
}

export function AdminMovieForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const { session } = useAdminAuth();
  const movieDraftKey = draftKey(session.user.id, 'movie', id);
  const [movie, setMovie] = useState(() => isNew ? readDraft(movieDraftKey)?.movie ?? emptyMovie : emptyMovie);
  const [poster, setPoster] = useState(null);
  const [backdrop, setBackdrop] = useState(null);
  const [savedId, setSavedId] = useState(() => isNew ? readDraft(movieDraftKey)?.savedId ?? null : null);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (isNew) return undefined;
    let active = true;
    supabase.from('movies').select('*').eq('id', id).single().then(({ data, error: requestError }) => {
      if (active) { if (data) setMovie(readDraft(movieDraftKey)?.movie ?? data); setError(requestError?.message || ''); setLoading(false); }
    });
    return () => { active = false; };
  }, [id, isNew, movieDraftKey]);

  const update = (key, value) => {
    const next = { ...movie, [key]: value };
    setMovie(next);
    saveDraft(movieDraftKey, { movie: next, savedId });
  };
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const slug = movie.slug.trim().toLowerCase();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) throw new Error('Use lowercase letters, numbers and hyphens for the URL slug.');
      if (movie.status === 'published' && !movie.poster_path && !poster) throw new Error('Upload a poster before publishing.');
      const publishAfterUpload = movie.status === 'published' && Boolean(poster) && !movie.poster_path;
      const values = { title: movie.title.trim(), slug, tagline: movie.tagline.trim() || null,
        synopsis: movie.synopsis.trim(), genre: movie.genre.trim() || null,
        rating: movie.rating.trim() || null, language: movie.language.trim(),
        runtime_minutes: movie.runtime_minutes ? Number(movie.runtime_minutes) : null,
        status: publishAfterUpload ? 'draft' : movie.status,
        featured: Boolean(movie.featured), updated_at: new Date().toISOString() };
      if (!values.title || !values.synopsis || !values.language) throw new Error('Title, synopsis and language are required.');
      const saved = isNew && !savedId
        ? assertResult(await supabase.from('movies').insert(values).select('id').single())
        : assertResult(await supabase.from('movies').update(values).eq('id', savedId || id).select('id').single());
      let nextMovie = movie;
      if (isNew && !savedId) {
        setSavedId(saved.id);
        saveDraft(movieDraftKey, { movie: nextMovie, savedId: saved.id });
      }
      if (poster) {
        const path = await uploadPoster(saved.id, poster);
        assertResult(await supabase.from('movies').update({ poster_path: path, updated_at: new Date().toISOString() }).eq('id', saved.id));
        nextMovie = { ...nextMovie, poster_path: path };
        setMovie(nextMovie);
        setPoster(null);
        saveDraft(movieDraftKey, { movie: nextMovie, savedId: saved.id });
      }
      if (backdrop) {
        const path = await uploadPoster(saved.id, backdrop);
        assertResult(await supabase.from('movies').update({ backdrop_path: path, updated_at: new Date().toISOString() }).eq('id', saved.id));
        nextMovie = { ...nextMovie, backdrop_path: path };
        setMovie(nextMovie);
        setBackdrop(null);
        saveDraft(movieDraftKey, { movie: nextMovie, savedId: saved.id });
      }
      if (publishAfterUpload) {
        assertResult(await supabase.from('movies').update({ status: 'published', updated_at: new Date().toISOString() }).eq('id', saved.id));
      }
      clearDraft(movieDraftKey);
      navigate('/admin/movies', { replace: true });
    } catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  }
  return <main className="admin-content"><div className="admin-page-header"><Link className="admin-back" to="/admin/movies"><ArrowLeft size={16} /> Movie library</Link>
    <p className="admin-overline">Catalogue / {isNew ? 'New film' : 'Edit film'}</p><h1>{isNew ? 'Add a movie' : movie.title}</h1><p>Keep credits, imagery and descriptions accurate and approved.</p></div>
    {loading ? <p>Loading film…</p> : <form className="admin-form-grid" onSubmit={save}>
      <section className="admin-panel"><h2>Film details</h2><div className="admin-fields">
        <label>Title<input required maxLength={160} value={movie.title} onChange={(e) => update('title', e.target.value)} /></label>
        <label>URL slug<input required maxLength={160} value={movie.slug} placeholder="the-movie-title" onChange={(e) => update('slug', e.target.value)} /></label>
        <label className="admin-field-wide">Tagline<input maxLength={180} value={movie.tagline || ''} onChange={(e) => update('tagline', e.target.value)} /></label>
        <label className="admin-field-wide">Synopsis<textarea required rows={5} value={movie.synopsis} onChange={(e) => update('synopsis', e.target.value)} /></label>
        <label>Genre<input value={movie.genre || ''} onChange={(e) => update('genre', e.target.value)} /></label>
        <label>Age rating<input value={movie.rating || ''} placeholder="15 / 12A / PG" onChange={(e) => update('rating', e.target.value)} /></label>
        <label>Language<input required value={movie.language} onChange={(e) => update('language', e.target.value)} /></label>
        <label>Runtime (minutes)<input type="number" min="1" value={movie.runtime_minutes || ''} onChange={(e) => update('runtime_minutes', e.target.value)} /></label>
      </div></section>
      <aside className="admin-form-side"><section className="admin-panel"><h2>Poster artwork</h2>
        <div className="admin-poster-preview">{movie.poster_path ? <img src={posterUrl(movie.poster_path)} alt="Current poster" /> : <ImagePlus size={36} />}</div>
        <label>Upload approved artwork<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPoster(e.target.files?.[0] || null)} /></label>
        <small>JPG, PNG or WebP · 5 MB max. Only artwork cleared by the distributor should be published. Re-select files after a page reload.</small>
        <label className="admin-backdrop-input">Optional wide backdrop<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setBackdrop(e.target.files?.[0] || null)} /></label>
        {movie.backdrop_path && <small>Current backdrop: {movie.backdrop_path}</small>}</section>
        <section className="admin-panel"><h2>Visibility</h2><label>Status<select value={movie.status} onChange={(e) => update('status', e.target.value)}>
          <option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option>
        </select></label><label className="admin-checkbox admin-featured-toggle"><input type="checkbox" checked={Boolean(movie.featured)} onChange={(e) => update('featured', e.target.checked)} /> Feature on site</label>
          <p className="admin-help">Publishing alone does not sell tickets. Add a future on-sale screening and active ticket tiers.</p></section>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <button className="admin-button admin-button--primary" disabled={busy}>{busy ? 'Saving…' : 'Save movie'}</button>
      </aside></form>}
  </main>;
}

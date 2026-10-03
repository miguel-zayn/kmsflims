import { useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function posterStyle(url) {
  return url ? { backgroundImage: `url("${url}")` } : {};
}

function MovieCard({ movie, onOpen }) {
  return (
    <button className="card" onClick={() => onOpen(movie.id)} aria-label={`Open ${movie.title}`}>
      <div className="poster" style={posterStyle(movie.poster_url)}>
        <span className="gen">{movie.genre || "Movie"}</span>
        {movie.type === "Series" && <span className="ser">SERIES</span>}
        <span className="play">▶</span>
      </div>
      <h4>{movie.title}</h4>
      <small>{movie.year || "—"} · {movie.type || "Movie"}</small>
    </button>
  );
}

function App() {
  const [movies, setMovies] = useState([]);
  const [featured, setFeatured] = useState(null);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [trailer, setTrailer] = useState(null);
  const [translation, setTranslation] = useState("");
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/movies?limit=50`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load movies");
        return r.json();
      })
      .then((data) => {
        if (!active) return;
        const list = data.movies || [];
        setMovies(list);
        setFeatured(list.find((m) => m.featured) || list[0] || null);
      })
      .catch((e) => {
        if (active) setError(e.message || "Could not connect to KMSFLIMS API.");
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const featuredMovies = useMemo(() => movies.filter((m) => m.featured), [movies]);
  const regularMovies = useMemo(() => movies.filter((m) => !m.featured), [movies]);

  async function openMovie(id) {
    setError("");
    setTrailer(null);
    setTranslation("");
    try {
      const r = await fetch(`${API_URL}/movies/${id}`);
      if (!r.ok) throw new Error("Movie details could not be loaded.");
      const data = await r.json();
      setSelected(data);
    } catch (e) {
      setError(e.message);
    }
  }

  async function searchMovies(event) {
    event?.preventDefault();
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setSearching(true);
    setError("");
    try {
      const r = await fetch(`${API_URL}/movies/search?q=${encodeURIComponent(q)}`);
      if (!r.ok) throw new Error("Search failed.");
      const data = await r.json();
      setResults(data.movies || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  }

  async function findTrailer(movie) {
    setTrailer({ loading: true });
    try {
      const r = await fetch(`${API_URL}/youtube/trailer?movie=${encodeURIComponent(movie.title)}`);
      const data = await r.json();
      if (!r.ok || !data.videoId) throw new Error(data.error || "No embeddable trailer found.");
      setTrailer({ videoId: data.videoId });
    } catch (e) {
      setTrailer({ error: e.message });
    }
  }

  async function translateDescription(movie) {
    if (!movie.description) return;
    setTranslating(true);
    setError("");
    try {
      const r = await fetch(`${API_URL}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: movie.description,
          source: "en",
          target: "rw",
          movie_id: movie.id
        })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Translation failed.");
      setTranslation(data.translatedText || "");
    } catch (e) {
      setError(e.message);
    } finally {
      setTranslating(false);
    }
  }

  function closeModal() {
    setSelected(null);
    setTrailer(null);
    setTranslation("");
  }

  return (
    <div>
      <header className="topbar">
        <a className="logo" href="#" onClick={() => { setSelected(null); setResults([]); }}>
          <img src="/logo.svg" alt="KMSFLIMS" />
        </a>

        <form className="search" onSubmit={searchMovies}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies, series or genres..."
            aria-label="Search movies"
          />
          <button type="submit">{searching ? "..." : "Search"}</button>
        </form>

        <div className="right">
          <a className="wa" href="https://wa.me/" target="_blank" rel="noreferrer">WhatsApp</a>
          <button className="menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <i /><i /><i />
          </button>
        </div>
      </header>

      {menuOpen && <div className="overlay" onClick={() => setMenuOpen(false)} />}
      <aside className={`side ${menuOpen ? "open" : ""}`}>
        <button className="close" onClick={() => setMenuOpen(false)}>×</button>
        <h2>KMSFLIMS</h2>
        <a href="#home" onClick={() => setMenuOpen(false)}>Home</a>
        <a href="#movies" onClick={() => setMenuOpen(false)}>Movies</a>
        <a href="#featured" onClick={() => setMenuOpen(false)}>Featured</a>
        <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
      </aside>

      {featured && (
        <section id="home" className="hero">
          <div className="hero-bg" style={posterStyle(featured.poster_url)} />
          <div className="hero-inner">
            <div className="hero-text">
              <div className="tags">
                <span className="tag red">FEATURED</span>
                <span className="tag">{featured.type}</span>
              </div>
              <h1>{featured.title}</h1>
              <div className="meta">{featured.year || "New"} · {featured.genre || "Drama"}</div>
              <span className="chip"><i /> Kinyarwanda-ready</span>
              <p className="desc">{featured.description_rw || featured.description || "Watch and discover movies on KMSFLIMS."}</p>
              <div className="btns">
                <button className="btn red" onClick={() => openMovie(featured.id)}>▶ Watch</button>
                <button className="btn ghost" onClick={() => openMovie(featured.id)}>More info</button>
              </div>
            </div>
            <div className="hero-stack">
              {movies.slice(0, 4).map((movie) => (
                <button key={movie.id} className="p" style={posterStyle(movie.poster_url)} onClick={() => openMovie(movie.id)} aria-label={movie.title} />
              ))}
            </div>
          </div>
        </section>
      )}

      <main>
        {error && <div className="empty">{error}</div>}

        {query.trim() && (
          <section className="results">
            <h2>Search results for “{query}”</h2>
            {searching ? <div className="empty">Searching...</div> :
              results.length ? <div className="grid">{results.map((m) => <MovieCard key={m.id} movie={m} onOpen={openMovie} />)}</div> :
              <div className="empty">No published movies matched your search.</div>}
          </section>
        )}

        {!query.trim() && !loading && (
          <>
            {featuredMovies.length > 0 && (
              <section id="featured" className="row">
                <h2>Featured</h2>
                <div className="grid">
                  {featuredMovies.map((movie) => <MovieCard key={movie.id} movie={movie} onOpen={openMovie} />)}
                </div>
              </section>
            )}

            <section id="movies" className="row">
              <h2>Latest Movies & Series</h2>
              {regularMovies.length ? (
                <div className="grid">{regularMovies.map((movie) => <MovieCard key={movie.id} movie={movie} onOpen={openMovie} />)}</div>
              ) : (
                <div className="empty">No additional movies have been published yet.</div>
              )}
            </section>
          </>
        )}

        {loading && <div className="empty">Loading KMSFLIMS...</div>}
      </main>

      {selected && (
        <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box">
            <button className="close" onClick={closeModal} aria-label="Close">×</button>
            <div className="player">
              {trailer?.videoId ? (
                <iframe
                  title={`${selected.movie.title} trailer`}
                  src={`https://www.youtube.com/embed/${trailer.videoId}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : selected.movie.video_url ? (
                <video src={selected.movie.video_url} controls poster={selected.movie.poster_url || undefined} />
              ) : (
                <div className="cover" style={posterStyle(selected.movie.poster_url)}>
                  <button className="btn red" onClick={() => findTrailer(selected.movie)}>▶ Find YouTube Trailer</button>
                </div>
              )}
            </div>

            <div className="m-info">
              <div className="tags">
                <span className="tag red">{selected.movie.type}</span>
                <span className="tag">{selected.movie.genre}</span>
                {selected.movie.year && <span className="tag">{selected.movie.year}</span>}
              </div>
              <h2>{selected.movie.title}</h2>
              <p className="desc">{selected.movie.description_rw || selected.movie.description || "No description available."}</p>

              {selected.movie.description && !selected.movie.description_rw && (
                <button className="btn green" onClick={() => translateDescription(selected.movie)}>
                  {translating ? "Translating..." : "Translate to Kinyarwanda"}
                </button>
              )}

              {translation && (
                <p className="desc"><strong>Kinyarwanda:</strong> {translation}</p>
              )}

              {trailer?.error && <p className="desc">{trailer.error}</p>}

              {selected.episodes?.length > 0 && (
                <>
                  <h3>Episodes</h3>
                  <div className="eps">
                    {selected.episodes.map((episode) => (
                      <button
                        key={episode.id}
                        className={selected.episode?.id === episode.id ? "on" : ""}
                        onClick={() => setSelected((s) => ({ ...s, episode }))}
                      >
                        Episode {episode.episode_number}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {selected.episode?.video_url && (
                <div className="player" style={{ marginTop: 20 }}>
                  <video src={selected.episode.video_url} controls poster={selected.movie.poster_url || undefined} />
                </div>
              )}

              {selected.movie.download_url && (
                <div className="btns">
                  <a className="btn green" href={selected.movie.download_url} target="_blank" rel="noreferrer">Download</a>
                  <button className="btn ghost" onClick={() => findTrailer(selected.movie)}>YouTube Trailer</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <footer id="about">
        <img src="/logo.svg" alt="" />
        <p>KMSFLIMS · Movies and entertainment with Kinyarwanda support.</p>
      </footer>
    </div>
  );
}

export default App;

'use client';
 
import { useState, useEffect, useCallback } from 'react';

interface Category {
  id: string;
  name: string;
  keywords: string[];
  location: string;
  radius: number;
  enabled: boolean;
  excludeTerms: string[];
  kleinanzeigenSection: string;
  excludeSections: string[];
  searchType: string;
  offerType: string;
}

const SECTIONS: Record<string, string> = {
  'alle': 'Alle Kategorien',
  'dienstleistungen': 'Dienstleistungen',
  'haus-garten': 'Haus & Garten',
  'elektronik': 'Elektronik',
  'auto-rad-boot': 'Auto, Rad & Boot',
  'immobilien': 'Immobilien',
  'jobs': 'Jobs',
  'familie-kind-baby': 'Familie, Kind & Baby',
  'freizeit-nachbarschaft': 'Freizeit & Nachbarschaft',
  'heimwerken': 'Heimwerken',
  'musik-film-buecher': 'Musik, Film & Bücher',
  'mode-beauty': 'Mode & Beauty',
  'haustiere': 'Haustiere',
  'unterricht-kurse': 'Unterricht & Kurse',
  'verschenken': 'Zu Verschenken',
};

export default function AdminPanel() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // New category form
  const [newName, setNewName] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [newLocation, setNewLocation] = useState('46286');
  const [newRadius, setNewRadius] = useState(50);
  const [newExclude, setNewExclude] = useState('Praktikant, Verstärkung, Festanstellung');
  const [newSection, setNewSection] = useState('alle');
  const [newExcludeSections, setNewExcludeSections] = useState<string[]>(['auto-rad-boot']);
  const [newSearchType, setNewSearchType] = useState('anbieter:privat');
  const [newOfferType, setNewOfferType] = useState('anzeige:gesuche');

  // Edit form
  const [editKeywords, setEditKeywords] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editRadius, setEditRadius] = useState(50);
  const [editExclude, setEditExclude] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);
  const [editSection, setEditSection] = useState('alle');
  const [editExcludeSections, setEditExcludeSections] = useState<string[]>([]);
  const [editSearchType, setEditSearchType] = useState('');
  const [editOfferType, setEditOfferType] = useState('');

  const authHeaders = useCallback(() => ({
    'Authorization': `Bearer ${password}`,
    'Content-Type': 'application/json',
  }), [password]);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/categories', {
        headers: authHeaders(),
      });
      if (res.status === 401) {
        setAuthenticated(false);
        setMessage('Invalid password');
        return;
      }
      const data = await res.json();
      setCategories(data.categories || []);
    } catch {
      setMessage('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (authenticated) fetchCategories();
  }, [authenticated, fetchCategories]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthenticated(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newKeywords.trim()) return;

    const res = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        name: newName.trim(),
        keywords: newKeywords.split(',').map((k) => k.trim()).filter(Boolean),
        location: newLocation,
        radius: newRadius,
        excludeTerms: newExclude.split(',').map((t) => t.trim()).filter(Boolean),
        kleinanzeigenSection: newSection,
        excludeSections: newExcludeSections,
        searchType: newSearchType,
        offerType: newOfferType,
      }),
    });

    if (res.ok) {
      setMessage('Category added!');
      setNewName('');
      setNewKeywords('');
      fetchCategories();
    } else {
      const data = await res.json();
      setMessage(data.error || 'Failed to add');
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditKeywords(cat.keywords.join(', '));
    setEditLocation(cat.location);
    setEditRadius(cat.radius);
    setEditExclude(cat.excludeTerms.join(', '));
    setEditEnabled(cat.enabled);
    setEditSection(cat.kleinanzeigenSection || 'alle');
    setEditExcludeSections(cat.excludeSections || []);
    setEditSearchType(cat.searchType || '');
    setEditOfferType(cat.offerType || '');
  };

  const handleUpdate = async (id: string) => {
    const res = await fetch(`/api/admin/categories?id=${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        keywords: editKeywords.split(',').map((k) => k.trim()).filter(Boolean),
        location: editLocation,
        radius: editRadius,
        excludeTerms: editExclude.split(',').map((t) => t.trim()).filter(Boolean),
        enabled: editEnabled,
        kleinanzeigenSection: editSection,
        excludeSections: editExcludeSections,
        searchType: editSearchType,
        offerType: editOfferType,
      }),
    });

    if (res.ok) {
      setMessage('Category updated!');
      setEditingId(null);
      fetchCategories();
    } else {
      setMessage('Failed to update');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

    const res = await fetch(`/api/admin/categories?id=${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });

    if (res.ok) {
      setMessage('Category deleted');
      fetchCategories();
    } else {
      setMessage('Failed to delete');
    }
  };

  const toggleEnabled = async (cat: Category) => {
    await fetch(`/api/admin/categories?id=${cat.id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ enabled: !cat.enabled }),
    });
    fetchCategories();
  };

  // Reusable select for Kleinanzeigen section
  const SectionSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#86bc25]"
    >
      {Object.entries(SECTIONS).map(([key, label]) => (
        <option key={key} value={key}>{label}</option>
      ))}
    </select>
  );

  const SearchTypeSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#86bc25]"
    >
      <option value="">Alle Anbieter</option>
      <option value="anbieter:privat">Nur Privat</option>
      <option value="anbieter:gewerblich">Nur Gewerblich</option>
    </select>
  );

  const OfferTypeSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#86bc25]"
    >
      <option value="">Alle Anzeigen</option>
      <option value="anzeige:angebote">Nur Angebote</option>
      <option value="anzeige:gesuche">Nur Gesuche</option>
    </select>
  );

  // Login screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-gray-800 mb-1">Admin Panel</h1>
          <p className="text-sm text-gray-500 mb-6">Enter admin password to manage categories</p>
          {message && <p className="text-red-500 text-sm mb-4">{message}</p>}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm mb-4 focus:outline-none focus:border-[#86bc25]"
            required
          />
          <button
            type="submit"
            className="w-full py-2.5 bg-[#86bc25] text-white rounded-lg font-semibold text-sm hover:bg-[#5a9a1a] transition-colors"
          >
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#86bc25] to-[#5a9a1a] text-white py-5 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Category Manager</h1>
            <p className="text-sm opacity-90">Add, edit, or remove search categories</p>
          </div>
          <a href="/" className="text-sm bg-white/20 px-4 py-2 rounded-lg hover:bg-white/30 transition-colors">
            &larr; Back to Browser
          </a>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Status message */}
        {message && (
          <div className="bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm mb-6 flex items-center justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage('')} className="text-green-500 hover:text-green-700">&times;</button>
          </div>
        )}

        {/* Add New Category */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Add New Category</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Category Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Heizung"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#86bc25]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Kleinanzeigen Section</label>
                <SectionSelect value={newSection} onChange={setNewSection} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Location &amp; Radius</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="PLZ"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#86bc25]"
                  />
                  <select
                    value={newRadius}
                    onChange={(e) => setNewRadius(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value={10}>10 km</option>
                    <option value={25}>25 km</option>
                    <option value={50}>50 km</option>
                    <option value={100}>100 km</option>
                    <option value={200}>200 km</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Advertiser Type</label>
                <SearchTypeSelect value={newSearchType} onChange={setNewSearchType} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Listing Type</label>
                <OfferTypeSelect value={newOfferType} onChange={setNewOfferType} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Search Keywords <span className="text-gray-400 font-normal">(comma-separated)</span>
              </label>
              <textarea
                value={newKeywords}
                onChange={(e) => setNewKeywords(e.target.value)}
                placeholder="Klimaanlage, Split Klimaanlage, Klima Montage, Wärmepumpe"
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#86bc25]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Exclude Terms <span className="text-gray-400 font-normal">(comma-separated — ads containing these words are hidden)</span>
              </label>
              <input
                type="text"
                value={newExclude}
                onChange={(e) => setNewExclude(e.target.value)}
                placeholder="Praktikant, Verstärkung, Festanstellung"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#86bc25]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Exclude Sections <span className="text-gray-400 font-normal">(ads from these Kleinanzeigen categories will be hidden)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SECTIONS).filter(([key]) => key !== 'alle').map(([key, label]) => (
                  <label key={key} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border cursor-pointer transition-colors ${
                    newExcludeSections.includes(key) ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600'
                  }`}>
                    <input
                      type="checkbox"
                      checked={newExcludeSections.includes(key)}
                      onChange={(e) => {
                        if (e.target.checked) setNewExcludeSections([...newExcludeSections, key]);
                        else setNewExcludeSections(newExcludeSections.filter(s => s !== key));
                      }}
                      className="w-3 h-3 accent-red-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#86bc25] text-white rounded-lg font-semibold text-sm hover:bg-[#5a9a1a] transition-colors"
            >
              Add Category
            </button>
          </form>
        </div>

        {/* Existing Categories */}
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Existing Categories ({categories.length})
        </h2>

        {loading && <p className="text-gray-400 text-sm">Loading...</p>}

        <div className="space-y-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className={`bg-white rounded-xl shadow-sm p-5 border-l-4 ${
                cat.enabled ? 'border-l-[#86bc25]' : 'border-l-gray-300'
              }`}
            >
              {editingId === cat.id ? (
                /* Edit Mode */
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-800">{cat.name}</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(cat.id)}
                        className="px-4 py-1.5 bg-[#86bc25] text-white rounded-lg text-sm font-medium hover:bg-[#5a9a1a]"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Keywords</label>
                    <textarea
                      value={editKeywords}
                      onChange={(e) => setEditKeywords(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#86bc25]"
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Kleinanzeigen Section</label>
                      <SectionSelect value={editSection} onChange={setEditSection} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Location &amp; Radius</label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={editLocation}
                          onChange={(e) => setEditLocation(e.target.value)}
                          className="flex-1 min-w-0 px-2 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                        <select
                          value={editRadius}
                          onChange={(e) => setEditRadius(Number(e.target.value))}
                          className="px-1 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                        >
                          <option value={10}>10km</option>
                          <option value={25}>25km</option>
                          <option value={50}>50km</option>
                          <option value={100}>100km</option>
                          <option value={200}>200km</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Advertiser</label>
                      <SearchTypeSelect value={editSearchType} onChange={setEditSearchType} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Listing Type</label>
                      <OfferTypeSelect value={editOfferType} onChange={setEditOfferType} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Exclude Terms</label>
                    <input
                      type="text"
                      value={editExclude}
                      onChange={(e) => setEditExclude(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2">Exclude Sections</label>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(SECTIONS).filter(([key]) => key !== 'alle').map(([key, label]) => (
                        <label key={key} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border cursor-pointer transition-colors ${
                          editExcludeSections.includes(key) ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-500'
                        }`}>
                          <input
                            type="checkbox"
                            checked={editExcludeSections.includes(key)}
                            onChange={(e) => {
                              if (e.target.checked) setEditExcludeSections([...editExcludeSections, key]);
                              else setEditExcludeSections(editExcludeSections.filter(s => s !== key));
                            }}
                            className="w-3 h-3 accent-red-500"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={editEnabled}
                      onChange={(e) => setEditEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#86bc25]"
                    />
                    Enabled (visible on frontend)
                  </label>
                </div>
              ) : (
                /* View Mode */
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-gray-800">{cat.name}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          cat.enabled
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {cat.enabled ? 'Active' : 'Disabled'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                        {SECTIONS[cat.kleinanzeigenSection] || 'Alle Kategorien'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleEnabled(cat)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          cat.enabled
                            ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        {cat.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => startEdit(cat)}
                        className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id, cat.name)}
                        className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div>
                      <span className="text-gray-400">Keywords: </span>
                      <span className="text-gray-700">{cat.keywords.join(', ')}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      <div>
                        <span className="text-gray-400">Location: </span>
                        <span className="text-gray-700">{cat.location} ({cat.radius} km)</span>
                      </div>
                      {cat.searchType && (
                        <div>
                          <span className="text-gray-400">Advertiser: </span>
                          <span className="text-gray-700">{cat.searchType === 'anbieter:privat' ? 'Privat' : 'Gewerblich'}</span>
                        </div>
                      )}
                      {cat.offerType && (
                        <div>
                          <span className="text-gray-400">Type: </span>
                          <span className="text-gray-700">{cat.offerType === 'anzeige:gesuche' ? 'Gesuche' : 'Angebote'}</span>
                        </div>
                      )}
                    </div>
                    {cat.excludeSections && cat.excludeSections.length > 0 && (
                      <div>
                        <span className="text-gray-400">Excluded Sections: </span>
                        <span className="text-red-600">{cat.excludeSections.map(s => SECTIONS[s] || s).join(', ')}</span>
                      </div>
                    )}
                    {cat.excludeTerms.length > 0 && (
                      <div>
                        <span className="text-gray-400">Exclude Terms: </span>
                        <span className="text-gray-700">{cat.excludeTerms.join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

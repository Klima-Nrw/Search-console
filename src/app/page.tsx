'use client';

import { useState, useEffect, useCallback } from 'react';

interface Ad {
  title: string;
  price: string;
  link: string;
  imageUrl: string;
  description: string;
  date: string;
  category: string;
}

interface CategoryInfo {
  id: string;
  name: string;
  count: number;
}

export default function Home() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAds = useCallback(async (categoryId?: string, query?: string) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (categoryId && categoryId !== 'all') params.set('category', categoryId);
      if (query) params.set('q', query);

      const res = await fetch(`/api/ads?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load ads');
      const data = await res.json();

      setAds(data.ads || []);
      if (data.categories) {
        setCategories(data.categories);
      }
    } catch (err) {
      setError('Could not load ads. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  const handleCategoryClick = (catId: string) => {
    setActiveCategory(catId);
    fetchAds(catId, search);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAds(activeCategory, search);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#86bc25] to-[#5a9a1a] text-white py-7 px-6 text-center">
        <h1 className="text-2xl md:text-3xl font-bold mb-1">Kleinanzeigen Browser</h1>
        <p className="text-sm md:text-base opacity-90">
          Curated classified ads from Kleinanzeigen &mdash; organized by category
        </p>
      </header>

      {/* Search Bar */}
      <div className="max-w-5xl mx-auto -mt-5 px-4 relative z-10">
        <form
          onSubmit={handleSearch}
          className="bg-white rounded-xl shadow-md p-4 flex flex-col sm:flex-row gap-3"
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search within results..."
            className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#86bc25] transition-colors"
          />
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#86bc25] text-white rounded-lg font-semibold text-sm hover:bg-[#5a9a1a] transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => handleCategoryClick('all')}
            className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
              activeCategory === 'all'
                ? 'bg-[#86bc25] text-white border-[#86bc25]'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-[#86bc25] hover:text-white hover:border-[#86bc25]'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                activeCategory === cat.id
                  ? 'bg-[#86bc25] text-white border-[#86bc25]'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-[#86bc25] hover:text-white hover:border-[#86bc25]'
              }`}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>

        {/* Results Info */}
        <p className="text-sm text-gray-500 mb-4">
          {loading ? 'Scraping Kleinanzeigen...' : `${ads.length} listings found`}
        </p>

        {/* Error */}
        {error && (
          <div className="text-center py-12 text-red-500">{error}</div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm animate-pulse">
                <div className="bg-gray-200 h-44" />
                <div className="p-4 space-y-3">
                  <div className="bg-gray-200 h-4 rounded w-3/4" />
                  <div className="bg-gray-200 h-3 rounded w-full" />
                  <div className="bg-gray-200 h-3 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Ads Grid */}
        {!loading && !error && ads.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">&#128270;</div>
            <p className="text-lg">No ads found. Try a different search or category.</p>
          </div>
        )}

        {!loading && !error && ads.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ads.map((ad, idx) => (
              <a
                key={`${ad.link}-${idx}`}
                href={ad.link}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all group flex flex-col"
              >
                {/* Image */}
                <div className="relative h-44 bg-gray-100 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ad.imageUrl}
                    alt={ad.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://static.kleinanzeigen.de/static/img/common/logo/logo-kleinanzeigen-horizontal.svg';
                    }}
                  />
                  <span className="absolute top-2 left-2 bg-[#86bc25]/90 text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    {ad.category}
                  </span>
                  {ad.price && (
                    <span className="absolute top-2 right-2 bg-black/70 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                      {ad.price}
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="p-3.5 flex-1 flex flex-col">
                  <h3 className="font-semibold text-gray-800 text-sm leading-snug line-clamp-2 mb-1.5">
                    {ad.title}
                  </h3>
                  {ad.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-2 flex-1">
                      {ad.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-400 mt-auto pt-2 border-t border-gray-50">
                    <span>{ad.date}</span>
                    <span className="text-[#86bc25] font-semibold group-hover:underline">
                      View on Kleinanzeigen &rarr;
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-gray-400 border-t border-gray-100 mt-8">
        All content and images belong to their respective owners and are sourced from{' '}
        <a
          href="https://www.kleinanzeigen.de/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#86bc25] hover:underline"
        >
          Kleinanzeigen
        </a>
        .
      </footer>
    </div>
  );
}

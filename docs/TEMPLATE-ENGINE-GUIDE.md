# 🚀 NextRush Template Engine - Practical Usage Guide

## Table of Contents

1. [Setup & Configuration](#setup--configuration)
2. [Real-World Examples](#real-world-examples)
3. [Complex Template Patterns](#complex-template-patterns)
4. [Performance Optimization](#performance-optimization)
5. [Advanced Integration](#advanced-integration)
6. [Production Best Practices](#production-best-practices)

## Setup & Configuration

### Basic Setup

```typescript
// app.ts
import { createApp } from 'nextrush';

const app = createApp();

// Configure template engine
app.setViews('./views', {
  cache: process.env.NODE_ENV === 'production',
  defaultExtension: '.html',
  syntax: 'auto',
  streaming: true,
  layouts: './views/layouts',
  partials: './views/partials',
  components: './views/components',
});

// Add custom helpers and filters
app.setTemplateEngine({
  helpers: {
    formatCurrency: (amount, currency = 'USD') => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(amount);
    },

    timeAgo: (date) => {
      const now = new Date();
      const diff = now.getTime() - new Date(date).getTime();
      const minutes = Math.floor(diff / 60000);

      if (minutes < 1) return 'just now';
      if (minutes < 60) return `${minutes}m ago`;

      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;

      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    },

    truncate: (text, length = 100) => {
      if (text.length <= length) return text;
      return text.substring(0, length) + '...';
    },

    slugify: (text) => {
      return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    },
  },

  filters: {
    sortBy: (array, key) => {
      return [...array].sort((a, b) => {
        const aVal = key.split('.').reduce((obj, k) => obj?.[k], a);
        const bVal = key.split('.').reduce((obj, k) => obj?.[k], b);
        return aVal > bVal ? 1 : -1;
      });
    },

    groupBy: (array, key) => {
      return array.reduce((groups, item) => {
        const group = key.split('.').reduce((obj, k) => obj?.[k], item);
        if (!groups[group]) groups[group] = [];
        groups[group].push(item);
        return groups;
      }, {});
    },

    chunk: (array, size) => {
      const chunks = [];
      for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
      }
      return chunks;
    },
  },
});

app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
```

## Real-World Examples

### 1. E-commerce Product Catalog

#### Main Layout (`views/layouts/main.html`)

```html
---
title: NextRush Store
description: Modern e-commerce platform
---

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{title}} - {{siteName}}</title>
    <meta name="description" content="{{description}}" />

    <!-- SEO & Social Meta -->
    <meta property="og:title" content="{{title}}" />
    <meta property="og:description" content="{{description}}" />
    <meta property="og:image" content="{{ogImage}}" />
    <meta name="twitter:card" content="summary_large_image" />

    <!-- Styles -->
    <link
      href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/css/custom.css" />

    <!-- JSON-LD Structured Data -->
    {{#if structuredData}}
    <script type="application/ld+json">
      {{{json structuredData}}}
    </script>
    {{/if}}
  </head>
  <body class="bg-gray-50">
    <!-- Navigation -->
    {{> navigation user=user cartCount=cart.itemCount}}

    <!-- Main Content -->
    <main class="min-h-screen">
      {{#if breadcrumbs}} {{> breadcrumbs items=breadcrumbs}} {{/if}}
      {{{content}}}
    </main>

    <!-- Footer -->
    {{> footer}}

    <!-- Scripts -->
    <script src="/js/alpine.min.js" defer></script>
    <script src="/js/app.js"></script>

    {{#if analytics}}
    <!-- Analytics -->
    <script>
      gtag('config', '{{analytics.gaId}}', {
        page_title: '{{title}}',
        page_location: '{{canonical}}',
      });
    </script>
    {{/if}}
  </body>
</html>
```

#### Product Grid Component (`views/components/ProductGrid.html`)

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
    {{#each (chunk products 4)}}
    <div class="grid grid-cols-4 gap-4">
        {{#each this}}
        <ProductCard
            product="{{this}}"
            showQuickView="{{../showQuickView}}"
            onSale="{{onSale}}"
            featured="{{featured}}"
        >
            <!-- Badges Slot -->
            <div slot="badges" class="absolute top-2 left-2 z-10">
                {{#if onSale}}
                <span class="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                    {{discount.percentage}}% OFF
                </span>
                {{/if}}

                {{#if featured}}
                <span class="bg-yellow-500 text-white px-2 py-1 rounded text-xs font-bold ml-1">
                    FEATURED
                </span>
                {{/if}}

                {{#if isNew}}
                <span class="bg-green-500 text-white px-2 py-1 rounded text-xs font-bold ml-1">
                    NEW
                </span>
                {{/if}}
            </div>

            <!-- Actions Slot -->
            <div slot="actions" class="mt-4 space-y-2">
                <button
                    class="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
                    onclick="addToCart('{{id}}')"
                    {{#unless inStock}}disabled{{/unless}}
                >
                    {{#if inStock}}
                        Add to Cart - {{formatCurrency price}}
                    {{else}}
                        Out of Stock
                    {{/if}}
                </button>

                <div class="flex space-x-2">
                    <button
                        class="flex-1 border border-gray-300 py-2 px-4 rounded hover:bg-gray-50 transition-colors"
                        onclick="addToWishlist('{{id}}')"
                    >
                        ♥ Wishlist
                    </button>

                    {{#if showQuickView}}
                    <button
                        class="flex-1 border border-gray-300 py-2 px-4 rounded hover:bg-gray-50 transition-colors"
                        onclick="quickView('{{id}}')"
                    >
                        👁 Quick View
                    </button>
                    {{/if}}
                </div>
            </div>
        </ProductCard>
        {{/each}}
    </div>
    {{/each}}
</div>

{{#unless products}}
<div class="text-center py-12">
    <div class="text-gray-400 text-6xl mb-4">📦</div>
    <h3 class="text-xl font-semibold text-gray-700 mb-2">No products found</h3>
    <p class="text-gray-500 mb-4">Try adjusting your search or filter criteria</p>
    <a href="/products" class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors">
        Browse All Products
    </a>
</div>
{{/unless}}
```

#### Individual Product Card (`views/components/ProductCard.html`)

```html
<div
  class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 relative"
>
  <!-- Product Image -->
  <div class="relative aspect-square overflow-hidden bg-gray-100">
    {{> slot "badges"}}

    <img
      src="{{product.images.[0].url}}"
      alt="{{product.name}}"
      class="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
      loading="lazy"
    />

    {{#if product.images.length > 1}}
    <div class="absolute bottom-2 right-2">
      <div class="bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
        +{{subtract product.images.length 1}} more
      </div>
    </div>
    {{/if}}
  </div>

  <!-- Product Info -->
  <div class="p-4">
    <!-- Brand & Category -->
    <div class="flex justify-between items-start mb-2">
      <span class="text-sm text-gray-500 uppercase tracking-wide">
        {{product.brand.name}}
      </span>
      <span class="text-xs text-gray-400"> {{product.category.name}} </span>
    </div>

    <!-- Product Name -->
    <h3 class="font-semibold text-gray-800 mb-2 line-clamp-2">
      <a
        href="/products/{{product.slug}}"
        class="hover:text-blue-600 transition-colors"
      >
        {{product.name}}
      </a>
    </h3>

    <!-- Rating & Reviews -->
    {{#if product.rating}}
    <div class="flex items-center mb-2">
      <div class="flex text-yellow-400">
        {{#repeat product.rating.stars}}⭐{{/repeat}} {{#repeat (subtract 5
        product.rating.stars)}}☆{{/repeat}}
      </div>
      <span class="text-sm text-gray-500 ml-2">
        ({{product.rating.count}} reviews)
      </span>
    </div>
    {{/if}}

    <!-- Price -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2">
        {{#if product.onSale}}
        <span class="text-lg font-bold text-red-600">
          {{formatCurrency product.salePrice}}
        </span>
        <span class="text-sm text-gray-500 line-through">
          {{formatCurrency product.price}}
        </span>
        {{else}}
        <span class="text-lg font-bold text-gray-800">
          {{formatCurrency product.price}}
        </span>
        {{/if}}
      </div>

      {{#if product.freeShipping}}
      <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
        Free Shipping
      </span>
      {{/if}}
    </div>

    <!-- Stock Status -->
    <div class="mb-3">
      {{#if product.inStock}} {{#if (lt product.stockCount 10)}}
      <p class="text-sm text-orange-600">
        Only {{product.stockCount}} left in stock
      </p>
      {{else}}
      <p class="text-sm text-green-600">In Stock</p>
      {{/if}} {{else}}
      <p class="text-sm text-red-600">Out of Stock</p>
      {{/if}}
    </div>

    <!-- Variations Preview -->
    {{#if product.variations}}
    <div class="mb-3">
      <div class="flex space-x-1">
        {{#each (take product.variations.colors 4)}}
        <div
          class="w-4 h-4 rounded-full border border-gray-300"
          style="background-color: {{hex}}"
          title="{{name}}"
        ></div>
        {{/each}} {{#if (gt product.variations.colors.length 4)}}
        <span class="text-xs text-gray-500 self-center">
          +{{subtract product.variations.colors.length 4}} more
        </span>
        {{/if}}
      </div>
    </div>
    {{/if}}

    <!-- Actions -->
    {{> slot "actions"}}
  </div>
</div>
```

#### Route Handler for Product Catalog

```typescript
// routes/products.ts
app.get('/products', async (req, res) => {
  const {
    category,
    brand,
    minPrice,
    maxPrice,
    sort = 'featured',
    page = 1,
    limit = 20,
    search,
  } = req.query;

  try {
    // Build filters
    const filters = {
      ...(category && { category }),
      ...(brand && { brand }),
      ...(minPrice && { 'price.gte': parseFloat(minPrice) }),
      ...(maxPrice && { 'price.lte': parseFloat(maxPrice) }),
      ...(search && {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ],
      }),
    };

    // Get products with pagination
    const products = await Product.find(filters)
      .populate('brand category')
      .sort(getSortOptions(sort))
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const totalProducts = await Product.countDocuments(filters);
    const totalPages = Math.ceil(totalProducts / limit);

    // Get filter options for sidebar
    const categories = await Category.find({ active: true }).sort('name');
    const brands = await Brand.find({ active: true }).sort('name');
    const priceRange = await Product.aggregate([
      {
        $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } },
      },
    ]);

    // Build breadcrumbs
    const breadcrumbs = [
      { name: 'Home', url: '/' },
      { name: 'Products', url: '/products', active: true },
    ];

    if (category) {
      const categoryDoc = await Category.findOne({ slug: category });
      if (categoryDoc) {
        breadcrumbs.push({
          name: categoryDoc.name,
          url: `/products?category=${category}`,
          active: true,
        });
      }
    }

    // Render with comprehensive data
    res.render('products/index', {
      title: search ? `Search: ${search}` : 'All Products',
      description: 'Discover our amazing collection of products',

      // Products data
      products,
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        pages: generatePaginationArray(parseInt(page), totalPages),
      },

      // Filters
      filters: {
        categories,
        brands,
        priceRange: priceRange[0] || { min: 0, max: 1000 },
        active: { category, brand, minPrice, maxPrice, search, sort },
      },

      // UI state
      showQuickView: true,
      breadcrumbs,

      // SEO
      canonical: `${process.env.BASE_URL}/products`,
      structuredData: generateProductListingSchema(products),

      // Analytics
      analytics: {
        gaId: process.env.GA_ID,
        event: 'view_item_list',
        items: products.map((p) => ({
          item_id: p._id,
          item_name: p.name,
          category: p.category.name,
          price: p.price,
        })),
      },
    });
  } catch (error) {
    console.error('Products page error:', error);
    res.status(500).render('errors/500', {
      title: 'Server Error',
      message: 'Failed to load products',
    });
  }
});

function getSortOptions(sort) {
  const sortMap = {
    featured: { featured: -1, createdAt: -1 },
    'price-low': { price: 1 },
    'price-high': { price: -1 },
    newest: { createdAt: -1 },
    rating: { 'rating.average': -1 },
    name: { name: 1 },
  };
  return sortMap[sort] || sortMap.featured;
}
```

### 2. Blog Platform with Dynamic Content

#### Blog Post Template (`views/blog/post.html`)

```html
---
layout: main
---

<article class="max-w-4xl mx-auto px-4 py-8">
  <!-- Hero Section -->
  <header class="mb-8">
    {{#if post.featuredImage}}
    <div class="relative aspect-video mb-6 rounded-lg overflow-hidden">
      <img
        src="{{post.featuredImage.url}}"
        alt="{{post.title}}"
        class="w-full h-full object-cover"
      />
      <div
        class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"
      ></div>
      <div class="absolute bottom-4 left-4 text-white">
        <p class="text-sm opacity-75">{{post.featuredImage.caption}}</p>
      </div>
    </div>
    {{/if}}

    <!-- Title & Meta -->
    <div class="text-center">
      <h1 class="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
        {{post.title}}
      </h1>

      {{#if post.subtitle}}
      <p class="text-xl text-gray-600 mb-6">{{post.subtitle}}</p>
      {{/if}}

      <!-- Author & Date -->
      <div class="flex items-center justify-center space-x-4 text-gray-500">
        <div class="flex items-center space-x-2">
          <img
            src="{{post.author.avatar}}"
            alt="{{post.author.name}}"
            class="w-10 h-10 rounded-full"
          />
          <div class="text-left">
            <p class="font-medium text-gray-900">{{post.author.name}}</p>
            <p class="text-sm">{{post.author.title}}</p>
          </div>
        </div>

        <div class="text-sm">
          <time datetime="{{iso post.publishedAt}}">
            {{formatDate post.publishedAt "MMMM DD, YYYY"}}
          </time>
          <span class="mx-2">•</span>
          <span>{{post.readTime}} min read</span>
        </div>
      </div>

      <!-- Tags -->
      {{#if post.tags}}
      <div class="flex flex-wrap justify-center gap-2 mt-4">
        {{#each post.tags}}
        <a
          href="/blog/tag/{{slug}}"
          class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm hover:bg-blue-200 transition-colors"
        >
          #{{name}}
        </a>
        {{/each}}
      </div>
      {{/if}}
    </div>
  </header>

  <!-- Table of Contents -->
  {{#if post.tableOfContents}}
  <aside class="bg-gray-50 p-6 rounded-lg mb-8">
    <h3 class="font-semibold text-gray-900 mb-4">Table of Contents</h3>
    <nav class="space-y-2">
      {{#each post.tableOfContents}}
      <a
        href="#{{anchor}}"
        class="block text-blue-600 hover:text-blue-800 transition-colors"
        style="margin-left: {{multiply level 1}}rem"
      >
        {{title}}
      </a>
      {{/each}}
    </nav>
  </aside>
  {{/if}}

  <!-- Article Content -->
  <div class="prose prose-lg max-w-none">{{{post.content}}}</div>

  <!-- Social Sharing -->
  <div class="border-t border-gray-200 pt-8 mt-8">
    <div class="flex items-center justify-between">
      <div class="flex items-center space-x-4">
        <span class="text-gray-600">Share this article:</span>
        <div class="flex space-x-2">
          <a
            href="https://twitter.com/intent/tweet?text={{encodeURIComponent post.title}}&url={{encodeURIComponent canonical}}"
            class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
            target="_blank"
            rel="noopener"
          >
            Twitter
          </a>
          <a
            href="https://www.facebook.com/sharer/sharer.php?u={{encodeURIComponent canonical}}"
            class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            target="_blank"
            rel="noopener"
          >
            Facebook
          </a>
          <a
            href="https://www.linkedin.com/sharing/share-offsite/?url={{encodeURIComponent canonical}}"
            class="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800 transition-colors"
            target="_blank"
            rel="noopener"
          >
            LinkedIn
          </a>
        </div>
      </div>

      <div class="text-sm text-gray-500">
        Last updated: {{timeAgo post.updatedAt}}
      </div>
    </div>
  </div>

  <!-- Author Bio -->
  {{#if post.author.bio}}
  <div class="bg-gray-50 rounded-lg p-6 mt-8">
    <div class="flex items-start space-x-4">
      <img
        src="{{post.author.avatar}}"
        alt="{{post.author.name}}"
        class="w-16 h-16 rounded-full"
      />
      <div class="flex-1">
        <h4 class="font-semibold text-gray-900 mb-2">
          About {{post.author.name}}
        </h4>
        <p class="text-gray-600 mb-4">{{post.author.bio}}</p>

        {{#if post.author.social}}
        <div class="flex space-x-4">
          {{#each post.author.social}}
          <a
            href="{{url}}"
            class="text-blue-600 hover:text-blue-800 transition-colors"
            target="_blank"
            rel="noopener"
          >
            {{platform}}
          </a>
          {{/each}}
        </div>
        {{/if}}
      </div>
    </div>
  </div>
  {{/if}}

  <!-- Related Posts -->
  {{#if relatedPosts}}
  <section class="mt-12">
    <h3 class="text-2xl font-bold text-gray-900 mb-6">Related Articles</h3>
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {{#each relatedPosts}}
      <article
        class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
      >
        {{#if featuredImage}}
        <img
          src="{{featuredImage.url}}"
          alt="{{title}}"
          class="w-full h-48 object-cover"
        />
        {{/if}}

        <div class="p-4">
          <h4 class="font-semibold text-gray-900 mb-2">
            <a
              href="/blog/{{slug}}"
              class="hover:text-blue-600 transition-colors"
            >
              {{truncate title 60}}
            </a>
          </h4>

          <p class="text-gray-600 text-sm mb-3">{{truncate excerpt 100}}</p>

          <div class="flex items-center justify-between text-sm text-gray-500">
            <span>{{timeAgo publishedAt}}</span>
            <span>{{readTime}} min read</span>
          </div>
        </div>
      </article>
      {{/each}}
    </div>
  </section>
  {{/if}}

  <!-- Comments Section -->
  {{#if enableComments}}
  <section class="mt-12 border-t border-gray-200 pt-8">
    <h3 class="text-2xl font-bold text-gray-900 mb-6">
      Comments ({{comments.length}})
    </h3>

    <!-- Comment Form -->
    <form class="bg-gray-50 p-6 rounded-lg mb-8">
      <div class="grid md:grid-cols-2 gap-4 mb-4">
        <input
          type="text"
          placeholder="Your Name"
          class="px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
        <input
          type="email"
          placeholder="Your Email"
          class="px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>

      <textarea
        placeholder="Your Comment"
        rows="4"
        class="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
        required
      ></textarea>

      <button
        type="submit"
        class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors"
      >
        Post Comment
      </button>
    </form>

    <!-- Comments List -->
    {{#if comments}}
    <div class="space-y-6">
      {{#each comments}} {{> comment comment=this depth=0}} {{/each}}
    </div>
    {{/if}}
  </section>
  {{/if}}
</article>

<!-- Structured Data -->
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "{{post.title}}",
    "description": "{{post.excerpt}}",
    "image": "{{post.featuredImage.url}}",
    "author": {
      "@type": "Person",
      "name": "{{post.author.name}}",
      "image": "{{post.author.avatar}}"
    },
    "publisher": {
      "@type": "Organization",
      "name": "{{siteName}}",
      "logo": "{{siteLogoUrl}}"
    },
    "datePublished": "{{iso post.publishedAt}}",
    "dateModified": "{{iso post.updatedAt}}",
    "url": "{{canonical}}"
  }
</script>
```

### 3. Dashboard with Real-time Data

#### Dashboard Layout (`views/dashboard/layout.html`)

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{title}} - Dashboard</title>
    <link
      href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="/css/dashboard.css" />
    <script
      src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js"
      defer
    ></script>
    <script src="/js/chart.min.js"></script>
  </head>
  <body class="bg-gray-100">
    <div x-data="dashboard()" class="flex h-screen">
      <!-- Sidebar -->
      {{> dashboard/sidebar user=user activeSection=activeSection}}

      <!-- Main Content -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Top Navigation -->
        {{> dashboard/header user=user notifications=notifications}}

        <!-- Content Area -->
        <main class="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
          <!-- Breadcrumbs -->
          {{#if breadcrumbs}}
          <nav class="mb-6">
            <ol class="flex space-x-2 text-sm text-gray-500">
              {{#each breadcrumbs}}
              <li>
                {{#if @last}}
                <span class="text-gray-900 font-medium">{{name}}</span>
                {{else}}
                <a href="{{url}}" class="hover:text-gray-700">{{name}}</a>
                <span class="mx-2">/</span>
                {{/if}}
              </li>
              {{/each}}
            </ol>
          </nav>
          {{/if}}

          <!-- Page Content -->
          {{{content}}}
        </main>
      </div>
    </div>

    <!-- WebSocket for Real-time Updates -->
    <script>
      const ws = new WebSocket('ws://localhost:3000/dashboard');

      ws.onmessage = function(event) {
          const data = JSON.parse(event.data);
          window.dispatchEvent(new CustomEvent('dashboard-update', { detail: data }));
      };

      function dashboard() {
          return {
              // Dashboard state
              sidebarOpen: false,
              notifications: @json(notifications),

              // Real-time data
              stats: @json(stats),

              // Methods
              toggleSidebar() {
                  this.sidebarOpen = !this.sidebarOpen;
              },

              updateStats(newStats) {
                  this.stats = { ...this.stats, ...newStats };
              },

              init() {
                  // Listen for real-time updates
                  window.addEventListener('dashboard-update', (event) => {
                      this.updateStats(event.detail);
                  });

                  // Auto-refresh data every 30 seconds
                  setInterval(() => {
                      fetch('/api/dashboard/stats')
                          .then(res => res.json())
                          .then(data => this.updateStats(data));
                  }, 30000);
              }
          }
      }
    </script>
  </body>
</html>
```

#### Analytics Dashboard (`views/dashboard/analytics.html`)

```html
---
layout: dashboard/layout
title: Analytics
activeSection: analytics
---

<div class="space-y-6">
  <!-- Stats Overview -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {{#each stats.overview}}
    <div class="bg-white rounded-lg shadow p-6">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-500">{{label}}</p>
          <p class="text-3xl font-bold text-gray-900">
            {{#if format}} {{formatNumber value format}} {{else}} {{formatNumber
            value}} {{/if}}
          </p>
        </div>
        <div class="text-{{color}}-500">
          <i class="{{icon}} text-2xl"></i>
        </div>
      </div>

      {{#if change}}
      <div class="mt-4 flex items-center">
        <span
          class="text-sm font-medium text-{{#if (gt change 0)}}green{{else}}red{{/if}}-600"
        >
          {{#if (gt change 0)}}+{{/if}}{{formatPercent change}}%
        </span>
        <span class="text-sm text-gray-500 ml-2">from last {{period}}</span>
      </div>
      {{/if}}
    </div>
    {{/each}}
  </div>

  <!-- Charts Row -->
  <div class="grid lg:grid-cols-2 gap-6">
    <!-- Revenue Chart -->
    <div class="bg-white rounded-lg shadow p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900">Revenue Trend</h3>
        <select class="text-sm border border-gray-300 rounded px-3 py-1">
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      <canvas id="revenueChart" width="400" height="200"></canvas>

      <script>
        const revenueCtx = document.getElementById('revenueChart').getContext('2d');
        new Chart(revenueCtx, {
            type: 'line',
            data: {
                labels: @json(charts.revenue.labels),
                datasets: [{
                    label: 'Revenue',
                    data: @json(charts.revenue.data),
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
      </script>
    </div>

    <!-- Traffic Sources -->
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Traffic Sources</h3>

      <div class="space-y-4">
        {{#each (sortBy stats.trafficSources 'percentage')}}
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div
              class="w-3 h-3 rounded-full"
              style="background-color: {{color}}"
            ></div>
            <span class="text-sm font-medium text-gray-900">{{name}}</span>
          </div>
          <div class="text-right">
            <span class="text-sm font-bold text-gray-900"
              >{{formatPercent percentage}}%</span
            >
            <p class="text-xs text-gray-500">
              {{formatNumber visitors}} visitors
            </p>
          </div>
        </div>

        <div class="w-full bg-gray-200 rounded-full h-2">
          <div
            class="h-2 rounded-full"
            style="width: {{percentage}}%; background-color: {{color}}"
          ></div>
        </div>
        {{/each}}
      </div>
    </div>
  </div>

  <!-- Recent Orders Table -->
  <div class="bg-white rounded-lg shadow">
    <div class="px-6 py-4 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900">Recent Orders</h3>
        <a
          href="/dashboard/orders"
          class="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          View all
        </a>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Order ID
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Customer
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Amount
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Status
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Date
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {{#each recentOrders}}
          <tr class="hover:bg-gray-50">
            <td
              class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600"
            >
              <a href="/dashboard/orders/{{id}}">#{{orderNumber}}</a>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <img
                  src="{{customer.avatar}}"
                  alt="{{customer.name}}"
                  class="w-8 h-8 rounded-full mr-3"
                />
                <div>
                  <p class="text-sm font-medium text-gray-900">
                    {{customer.name}}
                  </p>
                  <p class="text-sm text-gray-500">{{customer.email}}</p>
                </div>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
              {{formatCurrency total}}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span
                class="inline-flex px-2 py-1 text-xs font-semibold rounded-full
                                {{#eq status 'completed'}}bg-green-100 text-green-800{{/eq}}
                                {{#eq status 'pending'}}bg-yellow-100 text-yellow-800{{/eq}}
                                {{#eq status 'cancelled'}}bg-red-100 text-red-800{{/eq}}
                            "
              >
                {{capitalize status}}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{timeAgo createdAt}}
            </td>
          </tr>
          {{/each}}
        </tbody>
      </table>
    </div>
  </div>
</div>
```

## Complex Template Patterns

### 1. Nested Components with Slots

```html
<!-- Modal Component -->
<div
  x-data="{ open: false }"
  x-show="open"
  x-on:open-modal.window="open = true"
  x-on:close-modal.window="open = false"
  class="fixed inset-0 z-50 overflow-y-auto"
  style="display: none;"
>
  <div class="flex items-center justify-center min-h-screen px-4">
    <div
      x-show="open"
      x-transition
      class="fixed inset-0 bg-black opacity-50"
    ></div>

    <div
      x-show="open"
      x-transition
      class="bg-white rounded-lg shadow-xl max-w-md w-full relative"
    >
      <!-- Header Slot -->
      <header class="px-6 py-4 border-b border-gray-200">
        {{> slot "header"}}

        <button
          x-on:click="open = false"
          class="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </header>

      <!-- Body Slot -->
      <main class="px-6 py-4">{{> slot "body"}}</main>

      <!-- Footer Slot -->
      {{#if (hasSlot "footer")}}
      <footer class="px-6 py-4 border-t border-gray-200 bg-gray-50">
        {{> slot "footer"}}
      </footer>
      {{/if}}
    </div>
  </div>
</div>
```

### 2. Dynamic Form Generation

```html
<!-- Dynamic Form Component -->
<form
    class="space-y-6"
    action="{{action}}"
    method="{{method}}"
    {{#if enctype}}enctype="{{enctype}}"{{/if}}
>
    {{#each fields}}
    <div class="field-group">
        {{#eq type "text"}}
            {{> forms/text-field field=this}}
        {{/eq}}

        {{#eq type "email"}}
            {{> forms/email-field field=this}}
        {{/eq}}

        {{#eq type "password"}}
            {{> forms/password-field field=this}}
        {{/eq}}

        {{#eq type "select"}}
            {{> forms/select-field field=this}}
        {{/eq}}

        {{#eq type "checkbox"}}
            {{> forms/checkbox-field field=this}}
        {{/eq}}

        {{#eq type "radio"}}
            {{> forms/radio-group field=this}}
        {{/eq}}

        {{#eq type "file"}}
            {{> forms/file-field field=this}}
        {{/eq}}

        {{#eq type "textarea"}}
            {{> forms/textarea-field field=this}}
        {{/eq}}

        {{#eq type "custom"}}
            {{> (concat "forms/" template) field=this}}
        {{/eq}}
    </div>
    {{/each}}

    <!-- Form Actions -->
    <div class="flex justify-end space-x-4 pt-6 border-t border-gray-200">
        {{#if showCancel}}
        <button
            type="button"
            class="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
        >
            {{cancelText}}
        </button>
        {{/if}}

        <button
            type="submit"
            class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
            {{submitText}}
        </button>
    </div>
</form>
```

### 3. Advanced Data Tables

```html
<!-- Data Table Component -->
<div class="bg-white rounded-lg shadow overflow-hidden">
    <!-- Table Header -->
    <div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900">{{title}}</h3>

            <div class="flex items-center space-x-4">
                <!-- Search -->
                {{#if searchable}}
                <div class="relative">
                    <input
                        type="text"
                        placeholder="Search..."
                        class="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                    <div class="absolute left-3 top-2.5 text-gray-400">
                        🔍
                    </div>
                </div>
                {{/if}}

                <!-- Filters -->
                {{#if filters}}
                <select class="border border-gray-300 rounded px-3 py-2">
                    <option value="">All {{pluralize entityName}}</option>
                    {{#each filters}}
                    <option value="{{value}}">{{label}}</option>
                    {{/each}}
                </select>
                {{/if}}

                <!-- Actions -->
                {{#if actions}}
                <div class="flex space-x-2">
                    {{#each actions}}
                    <button
                        class="px-4 py-2 {{classes}} rounded hover:opacity-80"
                        onclick="{{onclick}}"
                    >
                        {{#if icon}}<i class="{{icon}} mr-2"></i>{{/if}}
                        {{label}}
                    </button>
                    {{/each}}
                </div>
                {{/if}}
            </div>
        </div>
    </div>

    <!-- Table -->
    <div class="overflow-x-auto">
        <table class="w-full">
            <thead class="bg-gray-50">
                <tr>
                    {{#if selectable}}
                    <th class="px-6 py-3 w-4">
                        <input type="checkbox" class="select-all">
                    </th>
                    {{/if}}

                    {{#each columns}}
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider {{classes}}">
                        <div class="flex items-center space-x-1">
                            <span>{{label}}</span>
                            {{#if sortable}}
                            <button class="text-gray-400 hover:text-gray-600">
                                ↕️
                            </button>
                            {{/if}}
                        </div>
                    </th>
                    {{/each}}

                    {{#if rowActions}}
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                    </th>
                    {{/if}}
                </tr>
            </thead>

            <tbody class="bg-white divide-y divide-gray-200">
                {{#each data}}
                <tr class="hover:bg-gray-50 {{#if highlighted}}bg-blue-50{{/if}}">
                    {{#if ../selectable}}
                    <td class="px-6 py-4 w-4">
                        <input type="checkbox" value="{{id}}" class="row-select">
                    </td>
                    {{/if}}

                    {{#each ../columns}}
                    <td class="px-6 py-4 {{classes}}">
                        {{#if template}}
                            {{> (lookup ../templates template) data=../this field=this}}
                        {{else if formatter}}
                            {{formatValue (lookup ../this key) formatter}}
                        {{else}}
                            {{lookup ../this key}}
                        {{/if}}
                    </td>
                    {{/each}}

                    {{#if ../rowActions}}
                    <td class="px-6 py-4 text-right text-sm font-medium">
                        <div class="flex items-center justify-end space-x-2">
                            {{#each ../rowActions}}
                            {{#if (checkCondition condition ../../this)}}
                            <button
                                class="{{classes}} hover:opacity-80"
                                onclick="{{onclick}}('{{../../this.id}}')"
                                {{#if tooltip}}title="{{tooltip}}"{{/if}}
                            >
                                {{#if icon}}<i class="{{icon}}"></i>{{else}}{{label}}{{/if}}
                            </button>
                            {{/if}}
                            {{/each}}
                        </div>
                    </td>
                    {{/if}}
                </tr>
                {{/each}}
            </tbody>
        </table>
    </div>

    <!-- Pagination -->
    {{#if pagination}}
    <div class="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div class="flex items-center justify-between">
            <div class="text-sm text-gray-700">
                Showing {{pagination.from}} to {{pagination.to}} of {{pagination.total}} results
            </div>

            <div class="flex space-x-2">
                {{#if pagination.hasPrev}}
                <a href="?page={{pagination.prevPage}}" class="px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50">
                    Previous
                </a>
                {{/if}}

                {{#each pagination.pages}}
                {{#if active}}
                <span class="px-3 py-2 bg-blue-600 text-white rounded text-sm">{{number}}</span>
                {{else}}
                <a href="?page={{number}}" class="px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50">
                    {{number}}
                </a>
                {{/if}}
                {{/each}}

                {{#if pagination.hasNext}}
                <a href="?page={{pagination.nextPage}}" class="px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50">
                    Next
                </a>
                {{/if}}
            </div>
        </div>
    </div>
    {{/if}}
</div>
```

## Performance Optimization

### 1. Template Caching Strategy

```typescript
// Advanced caching configuration
app.setTemplateEngine({
  cache: {
    enabled: process.env.NODE_ENV === 'production',
    ttl: 3600000, // 1 hour
    maxSize: 1000, // Max cached templates
    strategy: 'lru', // Least Recently Used

    // Cache invalidation
    invalidateOn: ['file-change', 'manual'],

    // Precompile templates at startup
    precompile: ['layouts/*.html', 'components/*.html', 'emails/*.html'],
  },

  // Streaming for large templates
  streaming: {
    enabled: true,
    threshold: 1024 * 100, // 100KB
    chunkSize: 1024 * 16, // 16KB chunks
  },
});
```

### 2. Lazy Loading Components

```html
<!-- Lazy Load Component -->
<div x-data="{ loaded: false }" x-intersect="loaded = true">
  <template x-if="loaded"> {{> heavy-component data=complexData}} </template>

  <template x-if="!loaded">
    <div class="animate-pulse bg-gray-200 h-64 rounded"></div>
  </template>
</div>
```

### 3. Optimized Rendering

```typescript
// Route with optimized rendering
app.get('/products/:category', async (req, res) => {
  const { category } = req.params;
  const { page = 1, limit = 20 } = req.query;

  try {
    // Use streaming for large product catalogs
    const shouldStream = limit > 50;

    // Parallel data fetching
    const [products, totalCount, categories, filters] = await Promise.all([
      Product.find({ category })
        .populate('brand category')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean(), // Use lean() for better performance

      Product.countDocuments({ category }),
      Category.find().lean(),
      getFilterOptions(category),
    ]);

    // Render with streaming if needed
    res.render(
      'products/category',
      {
        products,
        categories,
        filters,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(totalCount / limit),
        },
      },
      {
        streaming: shouldStream,
        layout: shouldStream ? 'layouts/streaming' : 'layouts/main',
      }
    );
  } catch (error) {
    console.error('Category page error:', error);
    res.status(500).render('errors/500');
  }
});
```

## Production Best Practices

### 1. Error Handling

```typescript
// Comprehensive error handling
app.setTemplateEngine({
  onError: (error, templatePath, data, options) => {
    console.error('Template Error:', {
      error: error.message,
      template: templatePath,
      stack: error.stack,
      data: Object.keys(data),
      timestamp: new Date().toISOString(),
    });

    // In development, show detailed error
    if (process.env.NODE_ENV === 'development') {
      return `
                <div style="background: #fee; border: 1px solid #fcc; padding: 20px; margin: 20px; border-radius: 4px;">
                    <h3 style="color: #c00; margin-top: 0;">Template Error</h3>
                    <p><strong>File:</strong> ${templatePath}</p>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <pre style="background: #f8f8f8; padding: 10px; overflow: auto;">${
                      error.stack
                    }</pre>
                    <details>
                        <summary>Template Data</summary>
                        <pre style="background: #f8f8f8; padding: 10px; overflow: auto;">${JSON.stringify(
                          data,
                          null,
                          2
                        )}</pre>
                    </details>
                </div>
            `;
    }

    // In production, render fallback template
    return '<div class="error">Something went wrong. Please try again later.</div>';
  },
});
```

### 2. Security Headers

```typescript
// Security-focused template rendering
app.get('*', (req, res, next) => {
  // Set security headers
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' https:"
  );

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  next();
});
```

### 3. Monitoring & Analytics

```typescript
// Template performance monitoring
app.setTemplateEngine({
  onRenderStart: (templatePath, data) => {
    console.time(`render-${templatePath}`);
  },

  onRenderEnd: (templatePath, data, html, renderTime) => {
    console.timeEnd(`render-${templatePath}`);

    // Log slow renders
    if (renderTime > 1000) {
      console.warn(
        `Slow template render: ${templatePath} took ${renderTime}ms`
      );
    }

    // Analytics
    if (process.env.ANALYTICS_ENABLED) {
      trackTemplateRender({
        template: templatePath,
        renderTime,
        outputSize: html.length,
        dataKeys: Object.keys(data).length,
      });
    }
  },
});
```

---

This guide demonstrates the power and flexibility of the NextRush Ultimate Template Engine through real-world examples, complex patterns, and production-ready implementations. The template engine handles everything from simple variable interpolation to complex e-commerce catalogs, dashboards, and dynamic forms while maintaining excellent performance and developer experience! 🚀

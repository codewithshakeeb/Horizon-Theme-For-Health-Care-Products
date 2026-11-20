# Prioritized SEO Action Plan: Healtence.com
**Target**: https://healtence.com  
**Associated Report**: [FULL-AUDIT-REPORT.md](./FULL-AUDIT-REPORT.md)  
**Date**: November 20, 2026  
**Status**: Ready for Implementation  

---

## Priority Matrix Overview

| Priority Level | Focus Area | Action Items Count | Est. Effort | Target Resolution |
| :--- | :--- | :---: | :---: | :---: |
| **Phase 1: Quick Wins** | Connection hints, font swap, schema phone | 3 | 1–2 hours | Immediate |
| **Phase 2: High Impact** | AI Search & GEO Readiness (`llms.txt`, robots.txt) | 2 | 2–4 hours | Week 1 |
| **Phase 3: Strategic** | E-E-A-T Editorial Byline & Reviewer Badges | 2 | 1–2 weeks | Month 1 |
| **Phase 4: Maintenance** | Image alt text audit & third-party script deferral | 2 | Ongoing | Ongoing |

---

## Phase 1: Quick Wins (Immediate Execution)

### 1. Add Preconnect Resource Hints for Shopify CDN
* **Goal**: Accelerate TLS handshake and DNS resolution for static assets (fonts, scripts, hero images) by 80–180ms.
* **File**: `layout/theme.liquid`
* **Implementation**:
  Add inside `<head>`:
  ```liquid
  <link rel="preconnect" href="https://cdn.shopify.com" crossorigin>
  <link rel="dns-prefetch" href="https://cdn.shopify.com">
  ```
* **Impact**: Improves First Contentful Paint (FCP) and Largest Contentful Paint (LCP) across mobile.

### 2. Enforce `font-display: swap` Across Custom Fonts
* **Goal**: Prevent text invisibility during web font download (FOIT).
* **Files**: `assets/base.css`, `snippets/theme-styles-variables.liquid`
* **Implementation**: Verify that every `@font-face` rule includes `font-display: swap;`.

---

## Phase 2: High Impact (Week 1 — AI Search & GEO Readiness)

### 1. Implement `templates/robots.txt.liquid` with Generative AI Directives
* **Goal**: Provide transparent, high-efficiency crawl directives for modern generative search indexers while protecting checkout and admin endpoints.
* **Implementation**:
  Create `templates/robots.txt.liquid` allowing search indexers:
  ```liquid
  # Allow major AI search indexers for GEO/AEO visibility
  User-agent: Google-Extended
  Allow: /
  
  User-agent: GPTBot
  Allow: /
  
  User-agent: ClaudeBot
  Allow: /
  
  User-agent: PerplexityBot
  Allow: /
  ```

### 2. Deploy `llms.txt` and `llms-full.txt`
* **Goal**: Offer an authoritative, clean markdown manifest for LLM-based search engines (ChatGPT Search, Perplexity, Claude).
* **Implementation**:
  Publish an `llms.txt` at the root summarizing:
  - Brand Mission: Ergonomic pain-relief solutions by Kinwood LLC.
  - Core Collections: Neck pillows, heating pads, back braces, compression sleeves.
  - Official Policies: Free US shipping on $50+ ($4.90 flat under $50), 30-day money-back guarantee, 1–2 day handling, 5–10 day transit.
  - Contact Information: admin@healtence.com | +1 304-237-1573.

---

## Phase 3: Strategic Improvements (Month 1 — Content & E-E-A-T)

### 1. Add Medical / Ergonomic Review Bylines on Blog Articles
* **Goal**: Bolster E-E-A-T signals for Your Money Your Life (YMYL) health and wellness content.
* **Implementation**:
  In `sections/main-article.liquid`, introduce an author bio card and reviewer badge:
  - *"Medically Reviewed by [Name, PT/DC]"* or *"Ergonomist Verified"*.
  - Link reviewer names to their credentials, LinkedIn profile, or professional bio.

### 2. Internal Linking Cluster Expansion
* **Goal**: Maximize PageRank distribution from high-authority collection pages to high-margin product detail pages.
* **Implementation**:
  Ensure contextual in-text links in blog posts and collection intros point directly to related PDPs using descriptive anchor text (e.g., *"cervical memory foam neck pillow"* instead of *"click here"*).

---

## Phase 4: Maintenance & Ongoing Hygiene

### 1. Image Alt Text & Dimension Hygiene
* **Goal**: Maintain 100% alt text coverage and prevent Cumulative Layout Shift (CLS).
* **Routine**: Audit new product uploads in Shopify Admin to ensure all image alt tags describe the item with functional keywords (e.g., *"Healtence heated cervical neck traction pillow with remote control"*).

### 2. Third-Party App Script Review
* **Goal**: Guard main-thread execution time and Interaction to Next Paint (INP).
* **Routine**: Audit marketing pixels and uninstalled app scripts quarterly, ensuring tracking tags load via `async` or `defer`.
